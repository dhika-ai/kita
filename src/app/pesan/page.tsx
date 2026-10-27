"use client";

import { useEffect, useState } from "react";
import { buttonClass, inputClass } from "@/components/auth-form";
import { StoragePhoto } from "@/components/storage-photo";
import { useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { todayWib } from "@/lib/dates";
import { localDb } from "@/lib/local-db";
import { queueCompressedPhoto } from "@/lib/photo";
import { saveLocal } from "@/lib/sync/sync";
import { useLiveQuery } from "@/lib/use-live-query";

const messageBucket = "message-photos";

// M-02: Ayah/Ibu menulis Pesan Harian (nilai atau fokus hari ini), boleh dengan foto.
// Disimpan di perangkat dulu lalu dikirim lewat antrean sync, jadi bisa dipakai offline.
export default function DailyMessagePage() {
  const t = useMessages();
  const session = useSession();
  const active = useActiveMember();
  const [me, setMe] = useState<MyFamily | null>();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setMe, () => setMe(null));
  }, [session]);

  const recent = useLiveQuery(
    async () =>
      (await localDb.daily_messages.toArray())
        .filter((m) => !m.deleted_at)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 10),
    [],
  );

  const role = active?.role ?? me?.role;
  if (!me) return null;
  if (role !== "father" && role !== "mother") {
    return <p className="p-6">{t.parentsOnly}</p>;
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = String(form.get("body")).trim();
    const file = form.get("photo") as File | null;
    if (!body) return;
    setBusy(true);
    const id = crypto.randomUUID();
    const photo_path = file?.size
      ? await queueCompressedPhoto(messageBucket, `${me!.familyId}/${id}`, file)
      : null;
    await saveLocal("daily_messages", {
      id,
      family_id: me!.familyId,
      author_id: me!.memberId,
      message_date: todayWib(),
      body,
      photo_path,
      created_at: new Date().toISOString(),
      deleted_at: null,
    });
    formElement.reset();
    setStatus(t.messageSaved);
    setBusy(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t.dailyMessage}</h1>
      <p className="text-sm opacity-70">{t.dailyMessageHint}</p>
      <form onSubmit={save} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t.messageBody}
          <textarea name="body" rows={3} required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t.photoOptional}
          <input name="photo" type="file" accept="image/*" />
        </label>
        <button type="submit" disabled={busy} className={buttonClass}>
          {t.sendMessage}
        </button>
        {status && <p className="text-sm">{status}</p>}
      </form>

      <h2 className="font-medium">{t.recentMessages}</h2>
      {recent?.length === 0 && <p className="opacity-70">{t.noMessages}</p>}
      <ul className="flex flex-col gap-3">
        {recent?.map((m) => (
          <li key={m.id} className="flex flex-col gap-2 rounded-md border p-3">
            <span className="text-sm opacity-70">{m.message_date}</span>
            {m.photo_path && (
              <StoragePhoto bucket={messageBucket} path={m.photo_path} />
            )}
            <p className="whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
