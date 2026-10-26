"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/auth-form";
import { useLanguage, useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { localDb } from "@/lib/local-db";
import { supabase } from "@/lib/supabase";
import { useLiveQuery } from "@/lib/use-live-query";

// Username bot (tanpa @), nilai publik. Tanpa ini hanya kode yang ditampilkan.
const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

// R-02: anggota yang sedang memakai aplikasi menghubungkan Telegram-nya dengan kode
// sekali pakai. Status terhubung ikut tersalin dari server (sync), jadi langsung
// berubah setelah bot menerima kodenya.
export default function TelegramPage() {
  const t = useMessages();
  const language = useLanguage();
  const session = useSession();
  const active = useActiveMember();
  const [me, setMe] = useState<MyFamily | null>();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setMe, () => setMe(null));
  }, [session]);

  const memberId = active?.id ?? me?.memberId;
  const member = useLiveQuery(
    async () => (memberId ? localDb.members.get(memberId) : undefined),
    [memberId],
  );

  async function connect() {
    if (!navigator.onLine) return setError(t.needsOnline);
    setBusy(true);
    setError("");
    const { data, error } = await supabase.rpc("create_telegram_link_code", {
      member_id: memberId,
      language,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setCode(data as string);
  }

  if (!session || !memberId) return null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t.telegram}</h1>
      <p className="text-sm opacity-70">{t.telegramHint}</p>
      {member?.telegram_connected && (
        <p className="rounded-md border p-3">{t.telegramConnected}</p>
      )}
      <button
        type="button"
        onClick={connect}
        disabled={busy}
        className={buttonClass}
      >
        {t.connectTelegram}
      </button>
      {code && (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          {botUsername && (
            <a
              href={`https://t.me/${botUsername}?start=${code}`}
              target="_blank"
              rel="noreferrer"
              className={buttonClass}
            >
              {t.openTelegram}
            </a>
          )}
          <p className="text-sm">{t.telegramCodeHint}</p>
          <code className="text-lg font-bold">/start {code}</code>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </main>
  );
}
