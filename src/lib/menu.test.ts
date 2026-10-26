import assert from "node:assert/strict";
import { test } from "node:test";
import { menuFor } from "./menu.ts";

const hrefs = (role: Parameters<typeof menuFor>[0]) =>
  menuFor(role).map((item) => item.href);

test("ayah dan ibu melihat menu anggota keluarga dan master data", () => {
  assert.deepEqual(hrefs("father"), [
    "/",
    "/dasbor",
    "/kalender",
    "/tugas/baru",
    "/persetujuan",
    "/inventaris",
    "/keluarga",
    "/master-data",
    "/telegram",
    "/ganti",
  ]);
  assert.deepEqual(hrefs("mother"), [
    "/",
    "/dasbor",
    "/kalender",
    "/tugas/baru",
    "/persetujuan",
    "/inventaris",
    "/keluarga",
    "/master-data",
    "/telegram",
    "/ganti",
  ]);
});

test("anak dan ART tidak melihat menu anggota keluarga dan master data", () => {
  assert.deepEqual(hrefs("child"), [
    "/",
    "/dasbor",
    "/kalender",
    "/tugas/baru",
    "/telegram",
    "/ganti",
  ]);
  assert.deepEqual(hrefs("art"), [
    "/",
    "/dasbor",
    "/kalender",
    "/telegram",
    "/ganti",
  ]);
});

test("ART tidak melihat menu tambah tugas", () => {
  assert.ok(!hrefs("art").includes("/tugas/baru"));
});

test("hanya ayah dan ibu yang melihat menu persetujuan", () => {
  assert.ok(hrefs("father").includes("/persetujuan"));
  assert.ok(!hrefs("child").includes("/persetujuan"));
  assert.ok(!hrefs("art").includes("/persetujuan"));
});

test("semua peran melihat dasbor dan kalender", () => {
  for (const role of ["father", "mother", "child", "art"] as const) {
    assert.ok(hrefs(role).includes("/dasbor"));
    assert.ok(hrefs(role).includes("/kalender"));
  }
});

test("hanya ayah dan ibu yang melihat menu inventaris", () => {
  assert.ok(hrefs("mother").includes("/inventaris"));
  assert.ok(!hrefs("child").includes("/inventaris"));
  assert.ok(!hrefs("art").includes("/inventaris"));
});
