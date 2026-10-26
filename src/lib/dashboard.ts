// T-12: menjumlahkan baris view dashboard_daily (T-11) untuk satu periode.

export type DashboardRow = {
  member_id: string | null;
  due_date: string;
  total: number;
  approved: number;
  waiting: number;
  late: number;
  points: number;
};

export type Totals = Omit<DashboardRow, "member_id" | "due_date"> & {
  completion_pct: number;
};

/** Jumlah semua baris. % selesai dihitung ulang dari jumlahnya, sama seperti view. */
export function sumRows(rows: DashboardRow[]): Totals {
  const sum = (key: "total" | "approved" | "waiting" | "late" | "points") =>
    rows.reduce((n, row) => n + row[key], 0);
  const total = sum("total");
  const approved = sum("approved");
  return {
    total,
    approved,
    waiting: sum("waiting"),
    late: sum("late"),
    points: sum("points"),
    completion_pct: total ? Math.round((100 * approved) / total) : 0,
  };
}
