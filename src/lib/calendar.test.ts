import assert from "node:assert/strict";
import { test } from "node:test";
import { datesIn, scheduledOn, shift } from "./calendar.ts";

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

test("jadwal template sama dengan job harian", () => {
  const weekly = {
    recurrence: "weekly" as const,
    weekdays: [1, 4],
    month_day: null,
  };
  assert.ok(scheduledOn(weekly, "2026-10-26")); // Senin
  assert.ok(scheduledOn(weekly, "2026-10-29")); // Kamis
  assert.ok(!scheduledOn(weekly, "2026-10-28"));
  const monthly = {
    recurrence: "monthly",
    weekdays: null,
    month_day: 31,
  } as const;
  assert.ok(scheduledOn(monthly, "2026-02-28"));
  assert.ok(!scheduledOn(monthly, "2026-03-30"));
  assert.ok(scheduledOn(monthly, "2026-03-31"));
  assert.ok(
    !scheduledOn(
      { recurrence: null, weekdays: null, month_day: null },
      "2026-03-31",
    ),
  );
});
