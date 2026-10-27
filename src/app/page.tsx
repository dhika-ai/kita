"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DailyMessageCard } from "@/components/daily-message-card";
import { LanguageSwitch } from "@/components/language-switch";
import { TodayTasks } from "@/components/today-tasks";
import { buttonClass } from "@/components/auth-form";
import { useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const t = useMessages();
  const session = useSession();
  // Anak atau ART yang masuk dengan PIN di perangkat ini (F-07).
  const active = useActiveMember();
  const [family, setFamily] = useState<MyFamily | null | undefined>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user)
      .then(setFamily)
      .catch((e) => setError(e instanceof Error ? e.message : t.errorGeneric));
  }, [session, t.errorGeneric]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
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
                {t.greeting}, {active?.displayName ?? family.displayName} ·{" "}
                {family.familyName}
              </p>
              <DailyMessageCard />
              <h2 className="self-start text-xl font-bold">{t.today}</h2>
              <TodayTasks
                me={{
                  id: active?.id ?? family.memberId,
                  role: active?.role ?? family.role,
                  familyId: family.familyId,
                }}
              />
            </>
          )}
          {!active && (
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
          )}
        </>
      )}
      <LanguageSwitch />
    </main>
  );
}
