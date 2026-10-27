import assert from "node:assert/strict";
import { test } from "node:test";
import { menuFor } from "./menu.ts";

const hrefs = (role: Parameters<typeof menuFor>[0]) =>
  menuFor(role).map((item) => item.href);

test("ayah dan ibu melihat menu anggota keluarga dan master data", () => {
  assert.deepEqual(hrefs("father"), [
    "/",
    "/dasbor",
    "/poin",
    "/hadiah",
    "/moments",
    "/pesan",
    "/tugas/baru",
    "/persetujuan",
    "/inventaris",
    "/keluarga",
    "/master-data",
    "/keuangan",
    "/cadangan",
    "/notifikasi",
    "/ganti",
  ]);
  assert.deepEqual(hrefs("mother"), [
    "/",
    "/dasbor",
    "/poin",
    "/hadiah",
    "/moments",
    "/pesan",
    "/tugas/baru",
    "/persetujuan",
    "/inventaris",
    "/keluarga",
    "/master-data",
    "/keuangan",
    "/cadangan",
    "/notifikasi",
    "/ganti",
  ]);
});

test("anak dan ART tidak melihat menu anggota keluarga dan master data", () => {
  assert.deepEqual(hrefs("child"), [
    "/",
    "/dasbor",
    "/poin",
    "/hadiah",
    "/moments",
    "/tugas/baru",
    "/notifikasi",
    "/ganti",
  ]);
  assert.deepEqual(hrefs("art"), [
    "/",
    "/dasbor",
    "/poin",
    "/hadiah",
    "/notifikasi",
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

test("semua peran melihat dasbor, kalender sudah dihapus (L-02)", () => {
  for (const role of ["father", "mother", "child", "art"] as const) {
    assert.ok(hrefs(role).includes("/dasbor"));
    assert.ok(!hrefs(role).includes("/kalender"));
  }
});

test("hanya ayah dan ibu yang melihat menu inventaris", () => {
  assert.ok(hrefs("mother").includes("/inventaris"));
  assert.ok(!hrefs("child").includes("/inventaris"));
  assert.ok(!hrefs("art").includes("/inventaris"));
});

test("ART tidak melihat menu moments", () => {
  assert.ok(hrefs("child").includes("/moments"));
  assert.ok(!hrefs("art").includes("/moments"));
});

test("hanya ayah dan ibu yang melihat menu pesan harian", () => {
  assert.ok(hrefs("father").includes("/pesan"));
  assert.ok(hrefs("mother").includes("/pesan"));
  assert.ok(!hrefs("child").includes("/pesan"));
  assert.ok(!hrefs("art").includes("/pesan"));
});

test("menu Keuangan hanya untuk ayah dan ibu (K-06)", () => {
  assert.ok(hrefs("father").includes("/keuangan"));
  assert.ok(hrefs("mother").includes("/keuangan"));
  assert.ok(!hrefs("child").includes("/keuangan"));
  assert.ok(!hrefs("art").includes("/keuangan"));
});

test("menu Telegram tidak tampil, diganti Notifikasi (P-03)", () => {
  for (const role of ["father", "mother", "child", "art"] as const) {
    assert.ok(!hrefs(role).includes("/telegram"));
    assert.ok(hrefs(role).includes("/notifikasi"));
  }
});

test("hanya ayah dan ibu yang melihat menu backup (B-01)", () => {
  assert.ok(hrefs("father").includes("/cadangan"));
  assert.ok(hrefs("mother").includes("/cadangan"));
  assert.ok(!hrefs("child").includes("/cadangan"));
  assert.ok(!hrefs("art").includes("/cadangan"));
});
