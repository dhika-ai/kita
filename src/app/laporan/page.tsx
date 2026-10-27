"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/auth-form";
import { useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { datesIn, shift } from "@/lib/calendar";
import { sumRows, type DashboardRow } from "@/lib/dashboard";
import { todayWib } from "@/lib/dates";
import { localDb } from "@/lib/local-db";
import { reportCsv } from "@/lib/report";
import { supabase } from "@/lib/supabase";
import { useLiveQuery } from "@/lib/use-live-query";

const views = ["week", "month"] as const;

// G-05: laporan tugas mingguan/bulanan, unduh CSV atau PDF (lewat cetak browser).
// Ayah/Ibu bisa melihat seluruh keluarga; anak dan ART hanya laporannya sendiri.
export default function ReportPage() {
  const t = useMessages();
  const session = useSession();
  const active = useActiveMember();
  const [me, setMe] = useState<MyFamily | null>();
  const [view, setView] = useState<(typeof views)[number]>("week");
  const [picked, setAnchor] = useState<string>();
  const [who, setWho] = useState("all");
  const [rows, setRows] = useState<DashboardRow[]>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setMe, () => setMe(null));
  }, [session]);

  const allMembers = useLiveQuery(
    async () =>
      (await localDb.members.toArray()).filter(
        (m) => !m.deleted_at && m.is_active,
      ),
    [],
  );

  useEffect(() => {
    if (!session) return;
    const dates = datesIn(view, picked ?? todayWib());
    const from = dates[0];
    const to = dates[dates.length - 1];
    void (async () => {
      const { data, error } = navigator.onLine
        ? await supabase
            .from("dashboard_daily")
            .select(
              "member_id, due_date, total, approved, waiting, late, points",
            )
            .gte("due_date", from)
            .lte("due_date", to)
        : { data: null, error: { message: t.needsOnline } };
      setError(error?.message ?? "");
      setRows(data ?? undefined);
    })();
  }, [session, view, picked, t]);

  const role = active?.role ?? me?.role;
  const memberId = active?.id ?? me?.memberId;
  if (!me || !memberId) return null;
  const anchor = picked ?? todayWib();
  const dates = datesIn(view, anchor);
  const from = dates[0];
  const to = dates[dates.length - 1];
  const isParent = role === "father" || role === "mother";
  const members = (allMembers ?? []).filter((m) =>
    isParent ? who === "all" || m.id === who : m.id === memberId,
  );
  const shown = (rows ?? []).filter((r) =>
    members.some((m) => m.id === r.member_id),
  );

  function downloadCsv() {
    const blob = new Blob([reportCsv(shown, members)], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `laporan-kita-${from}-${to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t.report}</h1>
      <div className="flex flex-wrap items-center gap-1 print:hidden">
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
          onClick={() => setAnchor(shift(view, anchor, 1))}
          className="rounded-md border px-3 py-1 text-sm"
          aria-label={t.next}
        >
          ›
        </button>
        {isParent && (
          <select
            value={who}
            onChange={(e) => setWho(e.target.value)}
            className="rounded-md border px-2 py-1 text-sm"
            aria-label={t.member}
          >
            <option value="all">{t.wholeFamily}</option>
            {allMembers?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="font-medium">
        {from} – {to}
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {rows && (
        <>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b [&>*]:pr-3">
                <th className="py-2">{t.member}</th>
                <th>{t.completion}</th>
                <th>{t.points}</th>
                <th>{t.late}</th>
                <th>{t.waitingApproval}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const totals = sumRows(
                  shown.filter((r) => r.member_id === m.id),
                );
                return (
                  <tr key={m.id} className="border-b [&>*]:pr-3">
                    <td className="py-2 font-medium">{m.display_name}</td>
                    <td>
                      {totals.completion_pct}% ({totals.approved}/{totals.total}
                      )
                    </td>
                    <td>{totals.points}</td>
                    <td>{totals.late}</td>
                    <td>{totals.waiting}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex gap-2 print:hidden">
            <button type="button" onClick={downloadCsv} className={buttonClass}>
              {t.downloadCsv}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md border px-4 py-2"
            >
              {t.downloadPdf}
            </button>
          </div>
          <p className="text-xs opacity-70 print:hidden">{t.pdfHint}</p>
        </>
      )}
    </main>
  );
}
