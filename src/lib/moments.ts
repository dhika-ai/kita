// M-08: saran Moment of the Week & Month. Moment dengan foto dan cerita lebih dulu,
// lalu cerita yang lebih panjang, lalu yang terbaru.

type Candidate = {
  moment_date: string;
  journal: string | null;
  photo_path: string | null;
  created_at: string;
};

export type PickPeriod = "week" | "month";

const score = (m: Candidate) =>
  (m.photo_path ? 2 : 0) + (m.journal?.trim() ? 1 : 0);

/** Paling banyak `limit` moment terbaik di antara tanggal-tanggal ini. */
export function suggestMoments<T extends Candidate>(
  moments: T[],
  dates: string[],
  limit = 3,
) {
  return moments
    .filter((m) => dates.includes(m.moment_date))
    .sort(
      (a, b) =>
        score(b) - score(a) ||
        (b.journal?.length ?? 0) - (a.journal?.length ?? 0) ||
        b.created_at.localeCompare(a.created_at),
    )
    .slice(0, limit);
}

/** id pilihan: satu per keluarga, periode, dan tanggal mulai periode. */
export const pickId = (familyId: string, period: PickPeriod, start: string) =>
  `${familyId}:${period}:${start}`;
