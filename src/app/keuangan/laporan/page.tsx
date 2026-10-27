"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/auth-form";
import { useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { todayWib } from "@/lib/dates";
import { financeCsv, monthSummary } from "@/lib/finance";
import { localDb } from "@/lib/local-db";
import { formatRupiah } from "@/lib/money";
import { useLiveQuery } from "@/lib/use-live-query";
import { MonthNav } from "../summary";

// K-05: laporan keuangan bulanan, unduh CSV atau PDF (lewat cetak browser).
// Hanya ayah dan ibu: anak/ART yang membuka URL ini ditolak, dan datanya memang
// tidak ada di perangkat mereka.
export default function FinanceReportPage() {
  const t = useMessages();
  const session = useSession();
  const active = useActiveMember();
  const [me, setMe] = useState<MyFamily | null>();
  const [picked, setMonth] = useState<string>();

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setMe, () => setMe(null));
  }, [session]);

  const data = useLiveQuery(
    async () => ({
      transactions: await localDb.transactions.toArray(),
      posts: await localDb.budget_posts.toArray(),
      accounts: await localDb.accounts.toArray(),
    }),
    [],
  );

  const role = active?.role ?? me?.role;
  if (me === undefined && session !== null) return null;
  if (!me || (role !== "father" && role !== "mother")) {
    return <p className="p-6">{t.parentsOnly}</p>;
  }
  if (!data) return null;
  const month = picked ?? todayWib().slice(0, 7);
  const s = monthSummary(data.transactions, data.posts, month);
  const shown = data.transactions
    .filter((x) => !x.deleted_at && x.tx_date.startsWith(month))
    .sort((a, b) => a.tx_date.localeCompare(b.tx_date));
  const name = (list: { id: string; name: string }[], id: string) =>
    list.find((x) => x.id === id)?.name ?? "";

  function downloadCsv() {
    const csv = financeCsv(
      data!.transactions,
      data!.posts,
      data!.accounts,
      month,
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `keuangan-kita-${month}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <Link href="/keuangan" className="text-sm underline print:hidden">
        ‹ {t.finance}
      </Link>
      <h1 className="text-2xl font-bold">
        {t.financeReport} · {me.familyName}
      </h1>
      <MonthNav month={month} onChange={setMonth} />
      <table className="w-full text-left text-sm">
        <tbody>
          {[
            [t.tx_income, s.income],
            [t.tx_expense, s.expense],
            [t.netBalance, s.net],
          ].map(([label, value]) => (
            <tr key={label} className="border-b">
              <th className="py-1 font-normal">{label}</th>
              <td className="text-right font-bold">
                {formatRupiah(Number(value))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="font-medium">{t.budgetPosts}</h2>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b [&>*]:pr-3">
            <th className="py-2">{t.budgetPost}</th>
            <th className="text-right">{t.total}</th>
            <th className="text-right">{t.monthlyBudget}</th>
          </tr>
        </thead>
        <tbody>
          {s.rows.map((r) => (
            <tr
              key={r.post.id}
              className={`border-b [&>*]:pr-3 ${r.over ? "font-bold text-red-600" : ""}`}
            >
              <td className="py-1">
                {r.post.name} ({t[`tx_${r.post.kind}`]}){r.over && " ⚠"}
              </td>
              <td className="text-right">{formatRupiah(r.total)}</td>
              <td className="text-right">
                {r.budget !== null ? formatRupiah(r.budget) : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="font-medium">{t.transactions}</h2>
      {shown.length === 0 && <p className="opacity-70">{t.empty}</p>}
      <table className="w-full text-left text-sm">
        <tbody>
          {shown.map((x) => (
            <tr key={x.id} className="border-b align-top [&>*]:pr-3">
              <td className="py-1 whitespace-nowrap">{x.tx_date}</td>
              <td>
                {name(data.posts, x.post_id)} ·{" "}
                {name(data.accounts, x.account_id)}
                {x.note && <div className="opacity-70">{x.note}</div>}
              </td>
              <td
                className={`text-right whitespace-nowrap ${x.kind === "income" ? "text-green-700" : ""}`}
              >
                {formatRupiah(x.kind === "income" ? x.amount : -x.amount)}
              </td>
            </tr>
          ))}
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
    </main>
  );
}
