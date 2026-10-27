"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { buttonClass } from "@/components/auth-form";
import { useMessages } from "@/i18n/language";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const t = useMessages();
  const session = useSession();
  const [family, setFamily] = useState<MyFamily | null | undefined>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user)
      .then(setFamily)
      .catch((e) => setError(e instanceof Error ? e.message : t.errorGeneric));
  }, [session, t.errorGeneric]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-4xl font-bold">KITA</h1>
      {session === undefined ? (
        <p>{t.loading}</p>
      ) : session === null ? (
        <>
          <p className="max-w-md text-base opacity-80">{t.appTagline}</p>
          <div className="flex gap-2">
            <Link href="/masuk" className={buttonClass}>
              {t.login}
            </Link>
            <Link href="/daftar" className="rounded-md border px-4 py-2">
              {t.register}
            </Link>
          </div>
        </>
      ) : (
        <>
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : family === undefined ? (
            <p>{t.loading}</p>
          ) : family === null ? (
            <p>{t.noFamily}</p>
          ) : (
            <>
              <p className="text-lg">
                {t.greeting}, {family.displayName} · {family.familyName}
              </p>
              <Link href="/keluarga" className="underline">
                {t.familyMembers}
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setFamily(undefined);
              supabase.auth.signOut();
            }}
            className="rounded-md border px-4 py-2"
          >
            {t.logout}
          </button>
        </>
      )}
      <LanguageSwitch />
    </main>
  );
}
