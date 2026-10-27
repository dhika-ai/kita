"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { buttonClass, Field } from "@/components/auth-form";
import { useMessages } from "@/i18n/language";
import { loadMyFamily } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const t = useMessages();
  // Ada kode berarti anggota datang dari link undangan (F-06): tidak membuat keluarga baru.
  const inviteCode = useSearchParams().get("kode");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");

    const { data, error } = await supabase.auth.signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
      options: {
        emailRedirectTo: `${location.origin}/masuk`,
        data: inviteCode
          ? { invite_code: inviteCode }
          : {
              family_name: String(form.get("familyName")),
              display_name: String(form.get("displayName")),
            },
      },
    });

    try {
      if (error) throw error;
      if (data.session) {
        // Konfirmasi email dimatikan: langsung buat keluarga dan masuk.
        await loadMyFamily(data.session.user);
        router.replace("/");
      } else {
        setSent(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">
        {inviteCode ? t.joinTitle : t.registerTitle}
      </h1>
      {inviteCode && !sent && <p>{t.joinIntro}</p>}
      {sent ? (
        <p role="status">{t.checkEmail}</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          {!inviteCode && (
            <>
              <Field label={t.familyName} name="familyName" />
              <Field label={t.fatherName} name="displayName" />
            </>
          )}
          <Field
            label={t.email}
            name="email"
            type="email"
            autoComplete="email"
          />
          <Field
            label={t.password}
            hint={t.passwordHint}
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
          />
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={buttonClass}>
            {t.register}
          </button>
        </form>
      )}
      <p className="text-sm">
        {t.haveAccount}{" "}
        <Link href="/masuk" className="underline">
          {t.login}
        </Link>
      </p>
    </main>
  );
}
