"use client";

import { useState } from "react";
import { useLanguage, useMessages } from "@/i18n/language";
import { todayWib } from "@/lib/dates";
import { monthSummary } from "@/lib/finance";
import { localDb } from "@/lib/local-db";
import { formatRupiah } from "@/lib/money";
import { useLiveQuery } from "@/lib/use-live-query";

/** "2026-11" + step bulan. */
export function shiftMonth(month: string, step: number) {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + step);
  return d.toISOString().slice(0, 7);
}

export function MonthNav({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  const t = useMessages();
  const language = useLanguage();
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString(
    language === "en" ? "en-GB" : "id-ID",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        aria-label={t.previous}
        onClick={() => onChange(shiftMonth(month, -1))}
        className="rounded-md border px-3 py-1"
      >
        ‹
      </button>
      <span className="font-medium">{label}</span>
      <button
        type="button"
        aria-label={t.next}
        onClick={() => onChange(shiftMonth(month, 1))}
        className="rounded-md border px-3 py-1"
      >
        ›
      </button>
    </div>
  );
}

/** K-04: ringkasan bulanan, pos yang melebihi anggaran ditandai merah. Dari perangkat. */
export function Summary() {
  const t = useMessages();
  const [month, setMonth] = useState(() => todayWib().slice(0, 7));
  const data = useLiveQuery(
    async () => ({
      transactions: await localDb.transactions.toArray(),
      posts: await localDb.budget_posts.toArray(),
    }),
    [],
  );
  if (!data) return null;
  const s = monthSummary(data.transactions, data.posts, month);
  const cards = [
    { label: t.tx_income, value: s.income },
    { label: t.tx_expense, value: s.expense },
    { label: t.netBalance, value: s.net },
  ];

  return (
    <div className="flex flex-col gap-4">
      <MonthNav month={month} onChange={setMonth} />
      <div className="grid grid-cols-3 gap-2">
        {cards.map((card) => (
          <div key={card.label} className="rounded-md border p-2">
            <div className="text-xs opacity-70">{card.label}</div>
            <div className="text-sm font-bold sm:text-lg">
              {formatRupiah(card.value)}
            </div>
          </div>
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {s.rows.map(({ post, total, budget, over }) => (
          <li
            key={post.id}
            className={`flex flex-col gap-1 rounded-md border p-3 text-sm ${over ? "border-red-600 bg-red-50 dark:bg-red-950" : ""}`}
          >
            <div className="flex justify-between gap-2">
              <span>
                {post.name}
                <span className="ml-2 opacity-70">{t[`tx_${post.kind}`]}</span>
              </span>
              <span className={over ? "font-bold text-red-600" : ""}>
                {formatRupiah(total)}
                {budget !== null && ` / ${formatRupiah(budget)}`}
              </span>
            </div>
            {budget !== null && (
              <div
                role="progressbar"
                aria-label={post.name}
                aria-valuenow={total}
                aria-valuemax={budget}
                className="h-2 rounded bg-black/10 dark:bg-white/20"
              >
                <div
                  className={`h-2 rounded ${over ? "bg-red-600" : "bg-green-600"}`}
                  style={{
                    width: `${budget ? Math.min(100, (100 * total) / budget) : 100}%`,
                  }}
                />
              </div>
            )}
            {over && (
              <span role="status" className="font-medium text-red-600">
                ⚠ {t.overBudget} {formatRupiah(total - budget!)}
              </span>
            )}
          </li>
        ))}
      </ul>
      {s.rows.length === 0 && <p className="opacity-70">{t.empty}</p>}
    </div>
  );
}
