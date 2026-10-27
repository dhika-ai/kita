// G-02: Progress Pribadi. Poin anggota (dari point_ledger) dijumlah per hari, minggu
// (Senin–Minggu), dan bulan, lalu dibandingkan dengan target dari Ayah/Ibu. Poin yang
// ditukar hadiah (redeem) tidak mengurangi progress.

import { datesIn } from "./calendar.ts";

export const periods = ["daily", "weekly", "monthly"] as const;
export type Period = (typeof periods)[number];

type Entry = {
  member_id: string;
  points: number;
  kind?: string;
  created_at: string;
};
export type Targets = Partial<Record<Period, number | null>>;

const views = { daily: "day", weekly: "week", monthly: "month" } as const;
const dateWib = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

/** Poin, target, dan % tercapai (maks. 100) per periode yang memuat `today`. */
export function progressOf(
  entries: Entry[],
  memberId: string,
  today: string,
  targets: Targets | undefined,
) {
  return periods.map((period) => {
    const dates = datesIn(views[period], today);
    const points = entries
      .filter((e) => e.member_id === memberId && e.kind !== "redeem")
      .filter((e) => {
        const d = dateWib(e.created_at);
        return d >= dates[0] && d <= dates[dates.length - 1];
      })
      .reduce((n, e) => n + e.points, 0);
    const target = targets?.[period] ?? null;
    const pct = target
      ? Math.min(100, Math.max(0, Math.round((100 * points) / target)))
      : null;
    return { period, points, target, pct };
  });
}
