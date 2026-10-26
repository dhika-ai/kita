import assert from "node:assert/strict";
import { test } from "node:test";
import { sumRows } from "./dashboard.ts";

const row = (total: number, approved: number, points: number) => ({
  member_id: "m1",
  due_date: "2026-10-26",
  total,
  approved,
  waiting: 0,
  late: total - approved,
  points,
});

test("satu baris sama persis dengan angka view", () => {
  assert.deepEqual(sumRows([row(6, 3, 15)]), {
    total: 6,
    approved: 3,
    waiting: 0,
    late: 3,
    points: 15,
    completion_pct: 50,
  });
});

test("beberapa hari dijumlah, % dihitung dari jumlahnya", () => {
  const totals = sumRows([row(3, 1, 5), row(1, 1, 10)]);
  assert.equal(totals.completion_pct, 50);
  assert.equal(totals.points, 15);
});

test("tanpa tugas: 0%", () => {
  assert.equal(sumRows([]).completion_pct, 0);
});
