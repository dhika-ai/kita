"use client";

import { StoragePhoto } from "@/components/storage-photo";
import { useMessages } from "@/i18n/language";
import { messageBucket, messagesToShow } from "@/lib/daily-message";
import { todayWib } from "@/lib/dates";
import { localDb } from "@/lib/local-db";
import { useLiveQuery } from "@/lib/use-live-query";

/** M-03: Pesan Harian dari Ayah/Ibu di Beranda. Dibaca dari perangkat, jadi tampil saat offline. */
export function DailyMessageCard() {
  const t = useMessages();
  const today = todayWib();
  const data = useLiveQuery(
    async () => ({
      messages: messagesToShow(await localDb.daily_messages.toArray(), today),
      members: await localDb.members.toArray(),
    }),
    [today],
  );
  if (!data?.messages.length) return null;
  const date = data.messages[0].message_date;
  const name = (id: string) =>
    data.members.find((m) => m.id === id)?.display_name ?? "";

  return (
    <section className="flex w-full flex-col gap-3 rounded-md bg-foreground/5 p-4 text-left">
      <h2 className="font-bold">
        {date === today ? t.dailyMessage : `${t.lastMessage} · ${date}`}
      </h2>
      {data.messages.map((m) => (
        <div key={m.id} className="flex flex-col gap-2">
          {m.photo_path && (
            <StoragePhoto bucket={messageBucket} path={m.photo_path} />
          )}
          <p className="whitespace-pre-wrap text-lg">{m.body}</p>
          <span className="text-sm opacity-70">— {name(m.author_id)}</span>
        </div>
      ))}
    </section>
  );
}
