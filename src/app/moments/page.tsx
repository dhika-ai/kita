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

const bucket = "moment-photos";

// M-06: tulis jurnal dan/atau unggah foto hari ini. Semuanya disimpan di perangkat
// dulu lalu dikirim lewat antrean sync, jadi tetap bisa dipakai saat offline.
// ART tidak punya akses (dijaga juga di database, M-05).
export default function MomentsPage() {
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

  const data = useLiveQuery(async () => {
    const today = todayWib();
    return {
      moments: (
        await localDb.moments.where("moment_date").equals(today).toArray()
      )
        .filter((m) => !m.deleted_at)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      members: await localDb.members.toArray(),
    };
  }, []);

  const role = active?.role ?? me?.role;
  const memberId = active?.id ?? me?.memberId;
  if (!me || !memberId) return null;
  if (role === "art") {
    return <p className="p-6">{t.noAccess}</p>;
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const journal = String(form.get("journal")).trim();
    const file = form.get("photo") as File | null;
    if (!journal && !file?.size) return setStatus(t.momentEmpty);
    setBusy(true);
    const id = crypto.randomUUID();
    const photo_path = file?.size
      ? await queueCompressedPhoto(bucket, `${me!.familyId}/${id}`, file)
      : null;
    await saveLocal("moments", {
      id,
      family_id: me!.familyId,
      member_id: memberId!,
      moment_date: todayWib(),
      journal: journal || null,
      photo_path,
      created_at: new Date().toISOString(),
      deleted_at: null,
    });
    formElement.reset();
    setStatus(t.momentSaved);
    setBusy(false);
  }

  const name = (id: string) =>
    data?.members.find((m) => m.id === id)?.display_name ?? "";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t.moments}</h1>
      <p className="text-sm opacity-70">{t.momentsHint}</p>
      <form onSubmit={save} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t.journal}
          <textarea name="journal" rows={3} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t.photo}
          <input name="photo" type="file" accept="image/*" />
        </label>
        <button type="submit" disabled={busy} className={buttonClass}>
          {t.saveMoment}
        </button>
        {status && <p className="text-sm">{status}</p>}
      </form>

      <h2 className="font-medium">{t.todayMoments}</h2>
      {data?.moments.length === 0 && (
        <p className="opacity-70">{t.noMoments}</p>
      )}
      <ul className="flex flex-col gap-3">
        {data?.moments.map((m) => (
          <li key={m.id} className="flex flex-col gap-2 rounded-md border p-3">
            <span className="text-sm font-medium">{name(m.member_id)}</span>
            {m.photo_path && (
              <StoragePhoto bucket={bucket} path={m.photo_path} />
            )}
            {m.journal && <p className="whitespace-pre-wrap">{m.journal}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
