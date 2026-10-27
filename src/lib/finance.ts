// K-04: ringkasan keuangan satu bulan dari transaksi di perangkat.
// K-05: laporan keuangan bulanan sebagai CSV.

import { csvCell } from "./report.ts";

type Post = {
  id: string;
  name: string;
  kind: "income" | "expense";
  monthly_budget: number | null;
  deleted_at: string | null;
};
type Transaction = {
  kind: "income" | "expense";
  amount: number;
  post_id: string;
  account_id?: string;
  tx_date: string;
  note?: string | null;
  deleted_at: string | null;
};

/** `month` = "YYYY-MM". Pos dengan pengeluaran di atas anggaran ditandai `over`. */
export function monthSummary(
  transactions: Transaction[],
  posts: Post[],
  month: string,
) {
  const inMonth = transactions.filter(
    (x) => !x.deleted_at && x.tx_date.startsWith(month),
  );
  const sum = (list: Transaction[]) => list.reduce((n, x) => n + x.amount, 0);
  const income = sum(inMonth.filter((x) => x.kind === "income"));
  const expense = sum(inMonth.filter((x) => x.kind === "expense"));
  const rows = posts
    .map((post) => {
      const total = sum(inMonth.filter((x) => x.post_id === post.id));
      const budget = post.kind === "expense" ? post.monthly_budget : null;
      return {
        post,
        total,
        budget,
        over: budget !== null && total > budget,
      };
    })
    // Pos yang dihapus tetap tampil kalau bulan itu ada transaksinya.
    .filter((row) => !row.post.deleted_at || row.total > 0)
    .sort(
      (a, b) =>
        a.post.kind.localeCompare(b.post.kind) ||
        Number(b.over) - Number(a.over) ||
        b.total - a.total,
    );
  return { income, expense, net: income - expense, rows };
}

/**
 * CSV laporan keuangan: satu baris per transaksi (urut tanggal), lalu total per pos,
 * lalu total pemasukan, pengeluaran, dan selisih. Nominal dalam Rupiah tanpa pemisah.
 */
export function financeCsv(
  transactions: Transaction[],
  posts: Post[],
  accounts: { id: string; name: string }[],
  month: string,
) {
  const name = (list: { id: string; name: string }[], id?: string) =>
    list.find((x) => x.id === id)?.name ?? "";
  const s = monthSummary(transactions, posts, month);
  const lines: (string | number)[][] = [
    ["date", "type", "post", "account", "note", "amount"],
    ...transactions
      .filter((x) => !x.deleted_at && x.tx_date.startsWith(month))
      .sort((a, b) => a.tx_date.localeCompare(b.tx_date))
      .map((x) => [
        x.tx_date,
        x.kind,
        name(posts, x.post_id),
        name(accounts, x.account_id),
        x.note ?? "",
        x.kind === "income" ? x.amount : -x.amount,
      ]),
    [],
    ["post", "type", "total", "monthly_budget", "over_budget"],
    ...s.rows.map((r) => [
      r.post.name,
      r.post.kind,
      r.total,
      r.budget ?? "",
      r.over ? "yes" : "no",
    ]),
    [],
    ["income", s.income],
    ["expense", s.expense],
    ["net", s.net],
  ];
  return lines.map((line) => line.map(csvCell).join(",")).join("\n") + "\n";
}
