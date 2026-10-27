"use client";

import { useMessages } from "@/i18n/language";
import { progressOf, type Targets } from "@/lib/progress";

type Entry = Parameters<typeof progressOf>[0][number];

/** G-02: Progress Pribadi satu anggota terhadap target harian/mingguan/bulanan. */
export function ProgressCard({
  entries,
  memberId,
  today,
  targets,
  title,
}: {
  entries: Entry[];
  memberId: string;
  today: string;
  targets: Targets | undefined;
  title?: string;
}) {
  const t = useMessages();
  return (
    <section className="flex flex-col gap-2 rounded-md border p-3">
      {title && <h3 className="text-sm font-medium">{title}</h3>}
      {progressOf(entries, memberId, today, targets).map((p) => (
        <div key={p.period} className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span>{t[`period_${p.period}`]}</span>
            <span>
              {p.target === null
                ? `${p.points} · ${t.noTarget}`
                : `${p.points}/${p.target} (${p.pct}%)`}
            </span>
          </div>
          {p.pct !== null && (
            <div
              role="progressbar"
              aria-label={t[`period_${p.period}`]}
              aria-valuenow={p.pct}
              className="h-2 rounded bg-black/10 dark:bg-white/20"
            >
              <div
                className="h-2 rounded bg-green-600"
                style={{ width: `${p.pct}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
