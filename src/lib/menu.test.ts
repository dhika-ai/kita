import assert from "node:assert/strict";
import { test } from "node:test";
import { menuFor } from "./menu.ts";

const hrefs = (role: Parameters<typeof menuFor>[0]) =>
  menuFor(role).map((item) => item.href);

test("ayah dan ibu melihat menu anggota keluarga dan master data", () => {
  assert.deepEqual(hrefs("father"), [
    "/",
    "/kalender",
    "/tugas/baru",
    "/persetujuan",
    "/inventaris",
    "/keluarga",
    "/master-data",
    "/ganti",
  ]);
  assert.deepEqual(hrefs("mother"), [
    "/",
    "/kalender",
    "/tugas/baru",
    "/persetujuan",
    "/inventaris",
    "/keluarga",
    "/master-data",
    "/ganti",
  ]);
});

test("anak dan ART tidak melihat menu anggota keluarga dan master data", () => {
  assert.deepEqual(hrefs("child"), ["/", "/kalender", "/tugas/baru", "/ganti"]);
  assert.deepEqual(hrefs("art"), ["/", "/kalender", "/ganti"]);
});

test("ART tidak melihat menu tambah tugas", () => {
  assert.ok(!hrefs("art").includes("/tugas/baru"));
});

test("hanya ayah dan ibu yang melihat menu persetujuan", () => {
  assert.ok(hrefs("father").includes("/persetujuan"));
  assert.ok(!hrefs("child").includes("/persetujuan"));
  assert.ok(!hrefs("art").includes("/persetujuan"));
});

test("semua peran melihat kalender", () => {
  for (const role of ["father", "mother", "child", "art"] as const) {
    assert.ok(hrefs(role).includes("/kalender"));
  }
});

test("hanya ayah dan ibu yang melihat menu inventaris", () => {
  assert.ok(hrefs("mother").includes("/inventaris"));
  assert.ok(!hrefs("child").includes("/inventaris"));
  assert.ok(!hrefs("art").includes("/inventaris"));
});
