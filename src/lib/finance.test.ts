import assert from "node:assert/strict";
import { test } from "node:test";
import { monthSummary } from "./finance.ts";

const post = (
  id: string,
  kind: "income" | "expense",
  monthly_budget: number | null,
  deleted_at: string | null = null,
) => ({ id, name: id, kind, monthly_budget, deleted_at });
const tx = (
  post_id: string,
  kind: "income" | "expense",
  amount: number,
  tx_date: string,
  deleted_at: string | null = null,
) => ({ post_id, kind, amount, tx_date, deleted_at });

const posts = [
  post("dapur", "expense", 1000000),
  post("listrik", "expense", 500000),
  post("lain", "expense", null),
  post("gaji", "income", null),
  post("lama", "expense", 100, "2026-10-01T00:00:00Z"),
];
const transactions = [
  tx("gaji", "income", 8000000, "2026-11-01"),
  tx("dapur", "expense", 700000, "2026-11-03"),
  tx("dapur", "expense", 400000, "2026-11-20"),
  tx("listrik", "expense", 450000, "2026-11-05"),
  tx("lain", "expense", 50000, "2026-11-06"),
  // Bulan lain dan transaksi terhapus tidak dihitung.
  tx("dapur", "expense", 999999, "2026-10-31"),
  tx("listrik", "expense", 999999, "2026-11-07", "2026-11-08T00:00:00Z"),
];

test("total pemasukan, pengeluaran, dan selisih satu bulan", () => {
  const s = monthSummary(transactions, posts, "2026-11");
  assert.equal(s.income, 8000000);
  assert.equal(s.expense, 1600000);
  assert.equal(s.net, 6400000);
});

test("pos di atas anggaran ditandai dan tampil paling atas", () => {
  const s = monthSummary(transactions, posts, "2026-11");
  const expense = s.rows.filter((r) => r.post.kind === "expense");
  assert.deepEqual(
    expense.map((r) => [r.post.id, r.total, r.over]),
    [
      ["dapur", 1100000, true],
      ["listrik", 450000, false],
      ["lain", 50000, false],
    ],
  );
});

test("tepat sama dengan anggaran belum dianggap melebihi", () => {
  const s = monthSummary(
    [tx("listrik", "expense", 500000, "2026-11-01")],
    posts,
    "2026-11",
  );
  assert.equal(s.rows.find((r) => r.post.id === "listrik")?.over, false);
});
