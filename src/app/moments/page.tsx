"use client";

import { useEffect, useState } from "react";
import { buttonClass, inputClass } from "@/components/auth-form";
import { MomentCard, momentBucket } from "@/components/moment-card";
import { useLanguage, useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { datesIn, shift, type CalendarView } from "@/lib/calendar";
import { todayWib } from "@/lib/dates";
import { localDb } from "@/lib/local-db";
import { pickId, suggestMoments, type PickPeriod } from "@/lib/moments";
import { queueCompressedPhoto } from "@/lib/photo";
import { saveLocal } from "@/lib/sync/sync";
import { useLiveQuery } from "@/lib/use-live-query";

const views: CalendarView[] = ["day", "week", "month"];

// M-06: tulis jurnal dan/atau unggah foto hari ini. Semuanya disimpan di perangkat
// dulu lalu dikirim lewat antrean sync, jadi tetap bisa dipakai saat offline.
// ART tidak punya akses (dijaga juga di database, M-05).
// M-07: feed semua moment keluarga per hari, minggu, atau bulan.
// M-08: di tampilan minggu/bulan, aplikasi menyarankan moment dan orang tua memilih satu.
export default function MomentsPage() {
  const t = useMessages();
  const language = useLanguage();
  const [view, setView] = useState<CalendarView>("day");
  const [picked, setAnchor] = useState<string>();
  const session = useSession();
  const active = useActiveMember();
  const [me, setMe] = useState<MyFamily | null>();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setMe, () => setMe(null));
  }, [session]);

  const data = useLiveQuery(
    async () => ({
      moments: (await localDb.moments.toArray())
        .filter((m) => !m.deleted_at)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      members: await localDb.members.toArray(),
      picks: await localDb.moment_picks.toArray(),
    }),
    [],
  );

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
      ? await queueCompressedPhoto(momentBucket, `${me!.familyId}/${id}`, file)
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

  const today = todayWib();
  const anchor = picked ?? today;
  const dates = datesIn(view, anchor);
  const shown = (data?.moments ?? []).filter((m) =>
    dates.includes(m.moment_date),
  );
  const dayLabel = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString(
      language === "en" ? "en-GB" : "id-ID",
      { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" },
    );
  const name = (id: string) =>
    data?.members.find((m) => m.id === id)?.display_name ?? "";

  const period = view === "day" ? null : (view as PickPeriod);
  const currentPickId = period && pickId(me.familyId, period, dates[0]);
  const chosen = data?.moments.find(
    (m) => m.id === data.picks.find((p) => p.id === currentPickId)?.moment_id,
  );
  const isParent = role === "father" || role === "mother";
  const suggestions = isParent ? suggestMoments(shown, dates) : [];

  async function choose(momentId: string) {
    await saveLocal("moment_picks", {
      id: currentPickId!,
      family_id: me!.familyId,
      period: period!,
      period_start: dates[0],
      moment_id: momentId,
      created_at: new Date().toISOString(),
      deleted_at: null,
    });
  }

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

      <div className="flex gap-1">
        {views.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-md border px-3 py-1 text-sm ${v === view ? "bg-foreground text-background" : ""}`}
          >
            {t[`view_${v}`]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setAnchor(shift(view, anchor, -1))}
          className="rounded-md border px-3 py-1 text-sm"
          aria-label={t.previous}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => setAnchor(today)}
          className="rounded-md border px-3 py-1 text-sm"
        >
          {t.goToday}
        </button>
        <button
          type="button"
          onClick={() => setAnchor(shift(view, anchor, 1))}
          className="rounded-md border px-3 py-1 text-sm"
          aria-label={t.next}
        >
          ›
        </button>
        <span className="ml-2 text-sm">
          {dates[0]}
          {dates.length > 1 && ` – ${dates[dates.length - 1]}`}
        </span>
      </div>
      {period && (chosen || suggestions.length > 0) && (
        <section className="flex flex-col gap-2 rounded-md bg-foreground/5 p-3">
          <h2 className="font-medium">{t[`momentOf_${period}`]}</h2>
          {chosen ? (
            <ul>
              <MomentCard moment={chosen} name={name(chosen.member_id)} />
            </ul>
          ) : (
            <p className="text-sm opacity-70">{t.noPickYet}</p>
          )}
          {suggestions.length > 0 && (
            <>
              <h3 className="text-sm font-medium">{t.suggestions}</h3>
              <ul className="flex flex-col gap-3">
                {suggestions.map((m) => (
                  <MomentCard key={m.id} moment={m} name={name(m.member_id)}>
                    <button
                      type="button"
                      onClick={() => choose(m.id)}
                      disabled={m.id === chosen?.id}
                      className="self-start rounded-md border px-3 py-1 text-sm"
                    >
                      {m.id === chosen?.id ? t.picked : t.pick}
                    </button>
                  </MomentCard>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      {shown.length === 0 && <p className="opacity-70">{t.noMoments}</p>}
      {[...dates].reverse().map((date) => {
        const day = shown.filter((m) => m.moment_date === date);
        if (day.length === 0) return null;
        return (
          <section key={date} className="flex flex-col gap-2">
            <h2 className="font-medium">{dayLabel(date)}</h2>
            <ul className="flex flex-col gap-3">
              {day.map((m) => (
                <MomentCard key={m.id} moment={m} name={name(m.member_id)} />
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
