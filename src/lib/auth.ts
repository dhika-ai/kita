"use client";

import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/** Sesi login saat ini. `undefined` selama masih dicek. */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  return session;
}

export type Role = "father" | "mother" | "child" | "art";

export type MyFamily = {
  memberId: string;
  role: Role;
  familyName: string;
  displayName: string;
};

/**
 * Mengambil keluarga milik pengguna. Kalau ayah baru saja mendaftar dan belum punya
 * keluarga, keluarga dibuat dari nama yang ia isi saat daftar (disimpan di metadata akun).
 * Kalau ia mendaftar lewat link undangan, ia digabungkan ke keluarga pengundang.
 */
export async function loadMyFamily(user: User): Promise<MyFamily | null> {
  let member = await fetchMember(user.id);

  const { family_name, display_name, invite_code } = user.user_metadata;
  if (!member && (invite_code || (family_name && display_name))) {
    const { error } = invite_code
      ? await supabase.rpc("join_family", { invite_code })
      : await supabase.rpc("create_family", { family_name, display_name });
    member = await fetchMember(user.id);
    // Gagal karena keluarga sudah dibuat oleh permintaan lain yang berjalan bersamaan: tidak apa-apa.
    if (error && !member) throw error;
  }

  return member;
}

async function fetchMember(authUserId: string): Promise<MyFamily | null> {
  const { data, error } = await supabase
    .from("members")
    .select("id, role, display_name, families(name)")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const family = data.families as unknown as { name: string } | null;
  return {
    memberId: data.id,
    role: data.role,
    familyName: family?.name ?? "",
    displayName: data.display_name,
  };
}
