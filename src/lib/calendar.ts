// Rentang tanggal harian/mingguan/bulanan (dipakai Dasbor, Moments, Progress Pribadi).
// Tanggal selalu "YYYY-MM-DD". Halaman Kalender (T-09) dihapus di L-02.

export type CalendarView = "day" | "week" | "month";

const toDate = (date: string) => new Date(`${date}T00:00:00Z`);
const toString = (date: Date) => date.toISOString().slice(0, 10);

export function addDays(date: string, days: number) {
  const d = toDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toString(d);
}

/** Semua tanggal yang tampil: satu hari, Senin–Minggu, atau satu bulan penuh. */
export function datesIn(view: CalendarView, anchor: string) {
  const d = toDate(anchor);
  let start = anchor;
  let length = 1;
  if (view === "week") {
    start = addDays(anchor, -((d.getUTCDay() + 6) % 7));
    length = 7;
  } else if (view === "month") {
    start = `${anchor.slice(0, 8)}01`;
    length = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
  }
  return Array.from({ length }, (_, i) => addDays(start, i));
}

/** Tanggal patokan berikutnya/sebelumnya (step = 1 atau -1). */
export function shift(view: CalendarView, anchor: string, step: number) {
  if (view === "day") return addDays(anchor, step);
  if (view === "week") return addDays(anchor, 7 * step);
  const d = toDate(`${anchor.slice(0, 8)}01`);
  d.setUTCMonth(d.getUTCMonth() + step);
  return toString(d);
}
