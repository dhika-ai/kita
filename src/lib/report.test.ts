import assert from "node:assert/strict";
import { test } from "node:test";
import { reportCsv } from "./report.ts";

const row = (
  member_id: string,
  due_date: string,
  approved: number,
  total: number,
  points: number,
) => ({
  member_id,
  due_date,
  total,
  approved,
  waiting: 0,
  late: total - approved,
  points,
});

test("CSV per tanggal lalu total per anggota, angka sama dengan sumRows dasbor", () => {
  const csv = reportCsv(
    [
      row("a", "2026-10-27", 1, 2, 10),
      row("a", "2026-10-26", 2, 2, 20),
      row("b", "2026-10-26", 0, 1, 0),
    ],
    [
      { id: "a", display_name: "Andi" },
      { id: "b", display_name: "Budi, Sr." },
    ],
  );
  assert.equal(
    csv,
    [
      "date,member,total,approved,completion_pct,waiting,late,points",
      "2026-10-26,Andi,2,2,100,0,0,20",
      "2026-10-27,Andi,2,1,50,0,1,10",
      "total,Andi,4,3,75,0,1,30",
      '2026-10-26,"Budi, Sr.",1,0,0,0,1,0',
      'total,"Budi, Sr.",1,0,0,0,1,0',
      "",
    ].join("\n"),
  );
});

test("anggota tanpa tugas tetap punya baris total nol", () => {
  assert.equal(
    reportCsv([], [{ id: "a", display_name: "Andi" }]),
    "date,member,total,approved,completion_pct,waiting,late,points\ntotal,Andi,0,0,0,0,0,0\n",
  );
});
