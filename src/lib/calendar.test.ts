import assert from "node:assert/strict";
import { test } from "node:test";
import { datesIn, shift } from "./calendar.ts";

test("minggu dimulai Senin, bulan berisi semua tanggalnya", () => {
  // 2026-10-28 hari Rabu.
  assert.deepEqual(datesIn("week", "2026-10-28"), [
    "2026-10-26",
    "2026-10-27",
    "2026-10-28",
    "2026-10-29",
    "2026-10-30",
    "2026-10-31",
    "2026-11-01",
  ]);
  assert.equal(datesIn("month", "2026-02-14").length, 28);
  assert.equal(datesIn("month", "2026-02-14")[0], "2026-02-01");
  assert.deepEqual(datesIn("day", "2026-10-28"), ["2026-10-28"]);
});

test("pindah hari, minggu, dan bulan", () => {
  assert.equal(shift("day", "2026-12-31", 1), "2027-01-01");
  assert.equal(shift("week", "2026-10-28", -1), "2026-10-21");
  assert.equal(shift("month", "2026-01-31", 1), "2026-02-01");
});
