"use client";

import Link from "next/link";
import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { buttonClass, Field, inputClass } from "@/components/auth-form";
import { useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily, type Role } from "@/lib/auth";
import { localDb, type LocalMember } from "@/lib/local-db";
import { supabase } from "@/lib/supabase";
import { sync } from "@/lib/sync/sync";

const roles: Role[] = ["father", "mother", "child", "art"];

type Member = LocalMember;

export default function FamilyPage() {
  const t = useMessages();
  const session = useSession();
  const [me, setMe] = useState<MyFamily | null>();
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Saat anak atau ART memakai perangkat dengan PIN, halaman ini hanya untuk dilihat.
  const active = useActiveMember();
  const myRole = active?.role ?? me?.role;
  const myId = active?.id ?? me?.memberId;
  const isParent = myRole === "father" || myRole === "mother";

  // Daftar anggota dibaca dari salinan di perangkat (F-10), jadi tetap tampil saat offline.
  useEffect(() => {
    const subscription = liveQuery(() =>
      localDb.members.orderBy("created_at").toArray(),
    ).subscribe((rows) =>
      setMembers(rows.filter((member) => !member.deleted_at)),
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setMe, (e) => setError(e.message));
  }, [session]);

  async function run(call: PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    setError("");
    const { error } = await call;
    if (error) setError(error.message);
    await sync();
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
                {member.id === myId && ` (${t.you})`}
              </span>
              {isParent && member.id !== myId ? (
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
            {isParent && (member.role === "child" || member.role === "art") && (
              <PinForm
                member={member}
                onSave={(pin) =>
                  run(
                    supabase.rpc("set_member_pin", {
                      member_id: member.id,
                      pin,
                    }),
                  )
                }
              />
            )}
            {isParent && member.invite_code && (
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

      {isParent && members.length < 5 && (
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

function PinForm({
  member,
  onSave,
}: {
  member: Member;
  onSave: (pin: string) => Promise<boolean>;
}) {
  const t = useMessages();
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const ok = await onSave(String(new FormData(formElement).get("pin")));
    setSaved(ok);
    if (ok) formElement.reset();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1 text-sm">
      <span>
        {t.pin}:{" "}
        {member.pin_locked ? (
          <strong className="text-red-600">{t.pinLocked}</strong>
        ) : member.has_pin ? (
          "••••"
        ) : (
          t.noPin
        )}
        {saved && ` · ${t.pinSaved}`}
      </span>
      <div className="flex gap-2">
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{4,6}"
          required
          autoComplete="new-password"
          aria-label={`${t.pin} ${member.display_name}`}
          placeholder={t.pinHint}
          className={`${inputClass} min-w-0 flex-1 text-sm`}
        />
        <button type="submit" className="rounded-md border px-3">
          {t.savePin}
        </button>
      </div>
    </form>
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
