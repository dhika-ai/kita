"use client";

import { useEffect, useState } from "react";
import { DailyMessageCard } from "@/components/daily-message-card";
import { MomentCard } from "@/components/moment-card";
import { ProgressCard } from "@/components/progress-card";
import { useLanguage, useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { addDays, datesIn, type CalendarView } from "@/lib/calendar";
import { sumRows, type DashboardRow, type Totals } from "@/lib/dashboard";
import { todayWib } from "@/lib/dates";
import { localDb } from "@/lib/local-db";
import type { Targets } from "@/lib/progress";
import { supabase } from "@/lib/supabase";
import { useLiveQuery } from "@/lib/use-live-query";

const periods: CalendarView[] = ["day", "week", "month"];

type Entry = {
  member_id: string;
  points: number;
  kind: string;
  created_at: string;
};
type Badge = {
  id: string;
  member_id: string;
  kind: "streak_7" | "area_specialist";
  area_id: string | null;
  earned_on: string;
};
type Extras = {
  trend: DashboardRow[];
  entries: Entry[];
  targets: (Targets & { member_id: string })[];
  badges: Badge[];
};

// T-12: dashboard dasar dari view dashboard_daily (T-11), jadi angkanya sama
// dengan perhitungan server. Butuh internet.
// M-08: Moment of the Week & Month pilihan orang tua (dari perangkat, tanpa ART).
// G-06: dasbor lengkap: Pesan Harian, grafik tren 14 hari, Progress Pribadi (pengganti
// leaderboard: anak/ART melihat miliknya, Ayah/Ibu semua anggota), dan lencana terbaru.
export default function DashboardPage() {
  const t = useMessages();
  const language = useLanguage();
  const session = useSession();
  const active = useActiveMember();
  const [me, setMe] = useState<MyFamily | null>();
  const [extras, setExtras] = useState<Extras>();
  const [period, setPeriod] = useState<CalendarView>("day");
  const [rows, setRows] = useState<DashboardRow[]>();
  const [error, setError] = useState("");
  const members = useLiveQuery(
    async () =>
      (await localDb.members.toArray()).filter(
        (m) => !m.deleted_at && m.is_active,
      ),
    [],
  );
  const areas = useLiveQuery(() => localDb.areas.toArray(), []);

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setMe, () => setMe(null));
  }, [session]);

  // Data tambahan G-06, dimuat sekali per kunjungan.
  useEffect(() => {
    if (!session) return;
    const today = todayWib();
    const from = [addDays(today, -13), datesIn("week", today)[0]]
      .concat(datesIn("month", today)[0])
      .sort()[0];
    void (async () => {
      if (!navigator.onLine) return;
      const [trend, ledger, goals, earned] = await Promise.all([
        supabase
          .from("dashboard_daily")
          .select("member_id, due_date, total, approved, waiting, late, points")
          .gte("due_date", addDays(today, -13))
          .lte("due_date", today),
        supabase
          .from("point_ledger")
          .select("member_id, points, kind, created_at")
          .gte("created_at", `${from}T00:00:00+07:00`),
        supabase
          .from("point_targets")
          .select("member_id, daily, weekly, monthly"),
        supabase
          .from("badges")
          .select("id, member_id, kind, area_id, earned_on")
          .order("earned_on", { ascending: false })
          .limit(5),
      ]);
      setExtras({
        trend: trend.data ?? [],
        entries: ledger.data ?? [],
        targets: goals.data ?? [],
        badges: earned.data ?? [],
      });
    })();
  }, [session]);

  const picks = useLiveQuery(async () => {
    const today = todayWib();
    const starts = {
      week: datesIn("week", today)[0],
      month: datesIn("month", today)[0],
    };
    const current = (await localDb.moment_picks.toArray()).filter(
      (p) => !p.deleted_at && p.period_start === starts[p.period],
    );
    const moments = await localDb.moments.bulkGet(
      current.map((p) => p.moment_id),
    );
    return current.flatMap((p, i) =>
      moments[i] ? [{ period: p.period, moment: moments[i] }] : [],
    );
  }, []);

  useEffect(() => {
    if (!session) return;
    const dates = datesIn(period, todayWib());
    void (async () => {
      // Tanpa cek ini, permintaan dicoba ulang beberapa detik sebelum gagal.
      const { data, error } = navigator.onLine
        ? await supabase
            .from("dashboard_daily")
            .select(
              "member_id, due_date, total, approved, waiting, late, points",
            )
            .gte("due_date", dates[0])
            .lte("due_date", dates[dates.length - 1])
        : { data: null, error: { message: t.needsOnline } };
      setError(error?.message ?? "");
      setRows(data ?? undefined);
    })();
  }, [session, period, t]);

  if (!session) return null;
  const today = todayWib();
  const role = active?.role ?? me?.role;
  const memberId = active?.id ?? me?.memberId;
  const isParent = role === "father" || role === "mother";
  const name = (id: string) =>
    members?.find((m) => m.id === id)?.display_name ?? "";
  const areaName = (id: string | null) => {
    const area = areas?.find((a) => a.id === id);
    return area ? (language === "en" ? area.name_en : area.name_id) : "";
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t.dashboard}</h1>
      <DailyMessageCard />
      <div className="flex gap-1">
        {periods.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`rounded-md border px-3 py-1 text-sm ${p === period ? "bg-foreground text-background" : ""}`}
          >
            {t[`period_${p}`]}
          </button>
        ))}
      </div>
      {picks && picks.length > 0 && (
        <ul className="grid gap-2 md:grid-cols-2">
          {picks.map(({ period, moment }) => (
            <MomentCard
              key={period}
              moment={moment}
              name={`${t[`momentOf_${period}`]} · ${
                members?.find((m) => m.id === moment.member_id)?.display_name ??
                ""
              }`}
            />
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {rows && (
        <>
          <h2 className="font-medium">{t.wholeFamily}</h2>
          <Cards totals={sumRows(rows)} />
          <ul className="flex flex-col gap-2">
            {members?.map((m) => {
              const totals = sumRows(rows.filter((r) => r.member_id === m.id));
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border p-3"
                >
                  <span className="font-medium">{m.display_name}</span>
                  <span className="text-sm">
                    {totals.completion_pct}% · {totals.points}{" "}
                    {t.points.toLowerCase()} · {totals.late}{" "}
                    {t.late.toLowerCase()}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs opacity-70">{t.pointsHint}</p>
        </>
      )}
      {extras && (
        <>
          <h2 className="font-medium">{t.trendTitle}</h2>
          <TrendChart rows={extras.trend} today={today} />
          {memberId && (
            <>
              <h2 className="font-medium">{t.progressTitle}</h2>
              <div className="grid gap-2 md:grid-cols-2">
                {members
                  ?.filter((m) => isParent || m.id === memberId)
                  .map((m) => (
                    <ProgressCard
                      key={m.id}
                      entries={extras.entries}
                      memberId={m.id}
                      today={today}
                      targets={extras.targets.find((g) => g.member_id === m.id)}
                      title={m.display_name}
                    />
                  ))}
              </div>
            </>
          )}
          <h2 className="font-medium">{t.latestBadges}</h2>
          {extras.badges.length === 0 && (
            <p className="text-sm opacity-70">{t.noBadges}</p>
          )}
          <ul className="flex flex-wrap gap-2">
            {extras.badges.map((b) => (
              <li
                key={b.id}
                className="rounded-full border border-amber-500 bg-amber-50 px-3 py-1 text-sm dark:bg-amber-950"
              >
                🏅 {name(b.member_id)} · {t[`badge_${b.kind}`]}
                {b.area_id && ` · ${areaName(b.area_id)}`}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function Cards({ totals }: { totals: Totals }) {
  const t = useMessages();
  const cards = [
    {
      label: t.completion,
      value: `${totals.completion_pct}%`,
      detail: `${totals.approved}/${totals.total}`,
    },
    { label: t.points, value: totals.points },
    { label: t.lateTasks, value: totals.late },
    { label: t.waitingApproval, value: totals.waiting },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-md border p-3">
          <div className="text-sm opacity-70">{card.label}</div>
          <div className="text-2xl font-bold">{card.value}</div>
          {card.detail && (
            <div className="text-xs opacity-70">{card.detail}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/** G-06: % tugas disetujui seluruh keluarga per hari, 14 hari terakhir. */
function TrendChart({ rows, today }: { rows: DashboardRow[]; today: string }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const points = days.map((date) => {
    const totals = sumRows(rows.filter((r) => r.due_date === date));
    return { date, totals };
  });
  return (
    <figure className="flex flex-col gap-1">
      <div className="flex h-32 items-end gap-0.5 border-b border-foreground/30">
        {points.map(({ date, totals }) => (
          <div
            key={date}
            title={`${date}: ${totals.completion_pct}% (${totals.approved}/${totals.total})`}
            className="group relative flex h-full flex-1 items-end"
          >
            <div
              className="w-full rounded-t bg-green-600 group-hover:bg-green-700"
              style={{
                height: totals.total
                  ? `${Math.max(totals.completion_pct, 1)}%`
                  : 0,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs opacity-70">
        <span>{days[0].slice(5)}</span>
        <span>{today.slice(5)}</span>
      </div>
      <table className="sr-only">
        <tbody>
          {points.map(({ date, totals }) => (
            <tr key={date}>
              <td>{date}</td>
              <td>{totals.completion_pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
