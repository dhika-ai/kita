"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { buttonClass, Field, inputClass } from "@/components/auth-form";
import { useMessages } from "@/i18n/language";
import { loadMyFamily, useSession, type MyFamily, type Role } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const roles: Role[] = ["father", "mother", "child", "art"];

type Member = {
  id: string;
  display_name: string;
  role: Role;
  invite_code: string | null;
};

export default function FamilyPage() {
  const t = useMessages();
  const session = useSession();
  const [me, setMe] = useState<MyFamily | null>();
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Hanya ayah (pemilik akun keluarga) yang menambah anggota dan mengatur peran.
  const isFather = me?.role === "father";

  const load = useCallback(
    () =>
      supabase
        .from("members")
        .select("id, display_name, role, invite_code")
        .is("deleted_at", null)
        .order("created_at")
        .then(({ data, error }) => {
          if (error) setError(error.message);
          else setMembers(data);
        }),
    [],
  );

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setMe, (e) => setError(e.message));
    load();
  }, [session, load]);

  async function run(call: PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    setError("");
    const { error } = await call;
    if (error) setError(error.message);
    await load();
    setBusy(false);
    return !error;
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const ok = await run(
      supabase.rpc("add_member", {
        display_name: String(form.get("name")),
        role: String(form.get("role")),
      }),
    );
    if (ok) formElement.reset();
  }

  if (session === null) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <Link href="/masuk" className={buttonClass}>
          {t.login}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-6">
      <Link href="/" className="text-sm underline">
        {t.back}
      </Link>
      <h1 className="text-2xl font-bold">{t.familyMembers}</h1>
      <p className="text-sm opacity-70">{t.maxMembers}</p>

      <ul className="flex flex-col gap-3">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex flex-col gap-2 rounded-md border p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {member.display_name}
                {member.id === me?.memberId && ` (${t.you})`}
              </span>
              {isFather && member.id !== me?.memberId ? (
                <select
                  aria-label={`${t.role} ${member.display_name}`}
                  value={member.role}
                  disabled={busy}
                  onChange={(event) =>
                    run(
                      supabase.rpc("set_member_role", {
                        member_id: member.id,
                        role: event.target.value,
                      }),
                    )
                  }
                  className={inputClass}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {t[`role_${role}`]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm">{t[`role_${member.role}`]}</span>
              )}
            </div>
            {isFather && member.invite_code && (
              <InviteLink code={member.invite_code} />
            )}
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {isFather && members.length < 5 && (
        <form
          onSubmit={add}
          className="flex flex-col gap-3 rounded-md border p-3"
        >
          <h2 className="font-medium">{t.addMember}</h2>
          <Field label={t.memberName} name="name" />
          <label className="flex flex-col gap-1 text-sm">
            {t.role}
            <select name="role" defaultValue="child" className={inputClass}>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {t[`role_${role}`]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy} className={buttonClass}>
            {t.addMember}
          </button>
        </form>
      )}
    </main>
  );
}

function InviteLink({ code }: { code: string }) {
  const t = useMessages();
  const [copied, setCopied] = useState(false);
  const url = `${location.origin}/daftar?kode=${code}`;

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span>{t.inviteLink}</span>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          className={`${inputClass} min-w-0 flex-1 text-sm`}
        />
        <button
          type="button"
          onClick={() =>
            navigator.clipboard.writeText(url).then(() => setCopied(true))
          }
          className="rounded-md border px-3"
        >
          {copied ? t.copied : t.copy}
        </button>
      </div>
      <span className="text-xs opacity-70">{t.inviteHint}</span>
    </div>
  );
}
