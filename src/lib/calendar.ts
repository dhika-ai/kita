// T-09: rentang tanggal kalender dan jadwal template (sama dengan
// private.generate_task_instances di database). Tanggal selalu "YYYY-MM-DD".

export type CalendarView = "day" | "week" | "month";

type Schedule = {
  recurrence: "daily" | "weekly" | "monthly" | null;
  weekdays: number[] | null;
  month_day: number | null;
};

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

/** Apakah template rutin dijadwalkan di tanggal ini. */
export function scheduledOn(template: Schedule, date: string) {
  const d = toDate(date);
  if (template.recurrence === "daily") return true;
  if (template.recurrence === "weekly") {
    return (template.weekdays ?? []).includes(d.getUTCDay() || 7);
  }
  if (template.recurrence === "monthly" && template.month_day) {
    const lastDay = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    return d.getUTCDate() === Math.min(template.month_day, lastDay);
  }
  return false;
}
