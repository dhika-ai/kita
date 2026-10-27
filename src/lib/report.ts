// G-05: laporan tugas mingguan/bulanan. Angkanya dari view dashboard_daily (T-11),
// dijumlah dengan sumRows yang sama dengan Dasbor, jadi hasilnya selalu sama.

import { sumRows, type DashboardRow } from "./dashboard.ts";

type Member = { id: string; display_name: string };

const columns = [
  "date",
  "member",
  "total",
  "approved",
  "completion_pct",
  "waiting",
  "late",
  "points",
] as const;

const cell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** CSV: satu baris per anggota per tanggal, lalu baris "total" per anggota untuk periode itu. */
export function reportCsv(rows: DashboardRow[], members: Member[]) {
  const lines: (string | number)[][] = [[...columns]];
  for (const m of members) {
    const own = rows
      .filter((r) => r.member_id === m.id)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    for (const r of own) {
      const t = sumRows([r]);
      lines.push([
        r.due_date,
        m.display_name,
        t.total,
        t.approved,
        t.completion_pct,
        t.waiting,
        t.late,
        t.points,
      ]);
    }
    const t = sumRows(own);
    lines.push([
      "total",
      m.display_name,
      t.total,
      t.approved,
      t.completion_pct,
      t.waiting,
      t.late,
      t.points,
    ]);
  }
  return lines.map((line) => line.map(cell).join(",")).join("\n") + "\n";
}
