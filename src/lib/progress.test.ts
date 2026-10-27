import assert from "node:assert/strict";
import { test } from "node:test";
import { progressOf } from "./progress.ts";

const entries = [
  // Selasa 27 Okt 2026, 06.00 WIB
  { member_id: "a", points: 10, created_at: "2026-10-26T23:00:00Z" },
  // Senin 26 Okt
  { member_id: "a", points: 20, created_at: "2026-10-26T03:00:00Z" },
  // Minggu 25 Okt: minggu lalu, tapi masih bulan ini
  { member_id: "a", points: 30, created_at: "2026-10-25T03:00:00Z" },
  { member_id: "a", points: -5, created_at: "2026-10-27T05:00:00Z" },
  {
    member_id: "a",
    points: -50,
    kind: "redeem",
    created_at: "2026-10-27T05:00:00Z",
  },
  { member_id: "b", points: 99, created_at: "2026-10-27T05:00:00Z" },
];

test("poin per hari, minggu, dan bulan dalam WIB", () => {
  const [daily, weekly, monthly] = progressOf(entries, "a", "2026-10-27", {
    daily: 10,
    weekly: 100,
    monthly: null,
  });
  assert.deepEqual(daily, { period: "daily", points: 5, target: 10, pct: 50 });
  assert.deepEqual(weekly, {
    period: "weekly",
    points: 25,
    target: 100,
    pct: 25,
  });
  assert.deepEqual(monthly, {
    period: "monthly",
    points: 55,
    target: null,
    pct: null,
  });
});

test("persen dibatasi 0 sampai 100", () => {
  const [daily] = progressOf(entries, "b", "2026-10-27", { daily: 50 });
  assert.equal(daily.pct, 100);
  const [neg] = progressOf(
    [{ member_id: "c", points: -3, created_at: "2026-10-27T05:00:00Z" }],
    "c",
    "2026-10-27",
    { daily: 10 },
  );
  assert.equal(neg.pct, 0);
});
