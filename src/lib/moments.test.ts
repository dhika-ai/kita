import assert from "node:assert/strict";
import { test } from "node:test";
import { pickId, suggestMoments } from "./moments.ts";

const moment = (
  id: string,
  moment_date: string,
  journal: string | null,
  photo_path: string | null,
  created_at = `${moment_date}T10:00:00Z`,
) => ({ id, moment_date, journal, photo_path, created_at });

test("saran mengutamakan foto + cerita, lalu cerita panjang, lalu terbaru", () => {
  const moments = [
    moment("a", "2026-10-26", "Pendek", null),
    moment("b", "2026-10-27", null, "f/b.jpg"),
    moment("c", "2026-10-27", "Cerita", "f/c.jpg"),
    moment("d", "2026-10-28", "Cerita yang lebih panjang", null),
    moment("e", "2026-10-28", "Pendek", null, "2026-10-28T12:00:00Z"),
  ];
  const ids = (list: { id: string }[]) => list.map((m) => m.id);
  const week = ["2026-10-26", "2026-10-27", "2026-10-28"];
  assert.deepEqual(ids(suggestMoments(moments, week)), ["c", "b", "d"]);
  assert.deepEqual(ids(suggestMoments(moments, week, 5)), [
    "c",
    "b",
    "d",
    "e",
    "a",
  ]);
});

test("saran hanya dari tanggal periode itu", () => {
  const moments = [
    moment("a", "2026-09-30", "Bulan lalu", "f/a.jpg"),
    moment("b", "2026-10-01", "Bulan ini", null),
  ];
  assert.deepEqual(
    suggestMoments(moments, ["2026-10-01", "2026-10-02"]).map((m) => m.id),
    ["b"],
  );
});

test("id pilihan per keluarga, periode, dan tanggal mulai", () => {
  assert.equal(pickId("f1", "month", "2026-10-01"), "f1:month:2026-10-01");
});
