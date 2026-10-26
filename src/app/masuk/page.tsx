"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass, Field } from "@/components/auth-form";
import { useMessages } from "@/i18n/language";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const t = useMessages();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    setBusy(false);
    if (error) setError(t.errorLogin);
    else router.replace("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">{t.loginTitle}</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label={t.email} name="email" type="email" autoComplete="email" />
        <Field
          label={t.password}
          name="password"
          type="password"
          autoComplete="current-password"
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={buttonClass}>
          {t.login}
        </button>
      </form>
      <p className="text-sm">
        {t.noAccount}{" "}
        <Link href="/daftar" className="underline">
          {t.register}
        </Link>
      </p>
    </main>
  );
}
