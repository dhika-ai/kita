"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClass, Field } from "@/components/auth-form";
import { useMessages } from "@/i18n/language";
import { setActiveMember, useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily, type Role } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type PinMember = { id: string; display_name: string; role: Role };

// F-07: anak dan ART memakai perangkat orang tua dengan PIN. Kembali ke pemilik akun
// butuh kata sandi akun, supaya anak tidak bisa memakai hak orang tua.
export default function SwitchUserPage() {
  const t = useMessages();
  const router = useRouter();
  const session = useSession();
  const active = useActiveMember();
  const [owner, setOwner] = useState<MyFamily | null>();
  const [pinMembers, setPinMembers] = useState<PinMember[]>([]);
  const [chosen, setChosen] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setOwner, (e) => setError(e.message));
    supabase
      .from("members")
      .select("id, display_name, role")
      .in("role", ["child", "art"])
      .eq("has_pin", true)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("created_at")
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setPinMembers(data);
      });
  }, [session]);

  function choose(id: string) {
    setChosen(id);
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !owner) return;
    const secret = String(new FormData(event.currentTarget).get("secret"));
    setBusy(true);
    setError("");

    if (chosen === owner.memberId) {
      const { error } = await supabase.auth.signInWithPassword({
        email: session.user.email!,
        password: secret,
      });
      setBusy(false);
      if (error) return setError(t.errorLogin);
      setActiveMember(null);
      return router.replace("/");
    }

    const member = pinMembers.find((m) => m.id === chosen)!;
    const { data, error } = await supabase.rpc("verify_member_pin", {
      member_id: member.id,
      pin: secret,
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (!data) return setError(t.wrongPin);
    setActiveMember({
      id: member.id,
      displayName: member.display_name,
      role: member.role,
    });
    router.replace("/");
  }

  const people = [
    ...(owner ? [{ id: owner.memberId, name: owner.displayName }] : []),
    ...pinMembers.map((m) => ({ id: m.id, name: m.display_name })),
  ];
  const currentId = active?.id ?? owner?.memberId;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 p-6">
      <Link href="/" className="text-sm underline">
        {t.back}
      </Link>
      <h1 className="text-2xl font-bold">{t.whoIsUsing}</h1>
      <ul className="flex flex-col gap-2">
        {people.map((person) => (
          <li key={person.id}>
            <button
              type="button"
              aria-pressed={person.id === chosen}
              disabled={person.id === currentId}
              onClick={() => choose(person.id)}
              className="w-full rounded-md border px-4 py-3 text-left aria-pressed:bg-foreground aria-pressed:text-background disabled:opacity-50"
            >
              {person.name}
            </button>
          </li>
        ))}
      </ul>
      {chosen && (
        <form key={chosen} onSubmit={submit} className="flex flex-col gap-3">
          {chosen === owner?.memberId ? (
            <Field
              label={t.ownerPassword}
              name="secret"
              type="password"
              autoComplete="current-password"
            />
          ) : (
            <Field
              label={t.pin}
              name="secret"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4,6}"
              autoComplete="off"
            />
          )}
          <button type="submit" disabled={busy} className={buttonClass}>
            {t.enter}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </main>
  );
}
