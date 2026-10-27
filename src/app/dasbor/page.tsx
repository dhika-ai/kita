"use client";

import { useEffect, useState } from "react";
import { MomentCard } from "@/components/moment-card";
import { useMessages } from "@/i18n/language";
import { useSession } from "@/lib/auth";
import { datesIn, type CalendarView } from "@/lib/calendar";
import { sumRows, type DashboardRow, type Totals } from "@/lib/dashboard";
import { todayWib } from "@/lib/dates";
import { localDb } from "@/lib/local-db";
import { supabase } from "@/lib/supabase";
import { useLiveQuery } from "@/lib/use-live-query";

const periods: CalendarView[] = ["day", "week", "month"];

// T-12: dashboard dasar dari view dashboard_daily (T-11), jadi angkanya sama
// dengan perhitungan server. Butuh internet.
// M-08: Moment of the Week & Month pilihan orang tua (dari perangkat, tanpa ART).
export default function DashboardPage() {
  const t = useMessages();
  const session = useSession();
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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t.dashboard}</h1>
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
