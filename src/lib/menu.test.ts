import assert from "node:assert/strict";
import { test } from "node:test";
import { menuFor } from "./menu.ts";

const hrefs = (role: Parameters<typeof menuFor>[0]) =>
  menuFor(role).map((item) => item.href);

test("ayah dan ibu melihat menu anggota keluarga dan master data", () => {
  assert.deepEqual(hrefs("father"), [
    "/",
    "/tugas/baru",
    "/persetujuan",
    "/keluarga",
    "/master-data",
    "/ganti",
  ]);
  assert.deepEqual(hrefs("mother"), [
    "/",
    "/tugas/baru",
    "/persetujuan",
    "/keluarga",
    "/master-data",
    "/ganti",
  ]);
});

test("anak dan ART tidak melihat menu anggota keluarga dan master data", () => {
  assert.deepEqual(hrefs("child"), ["/", "/tugas/baru", "/ganti"]);
  assert.deepEqual(hrefs("art"), ["/", "/ganti"]);
});

test("ART tidak melihat menu tambah tugas", () => {
  assert.ok(!hrefs("art").includes("/tugas/baru"));
});

test("hanya ayah dan ibu yang melihat menu persetujuan", () => {
  assert.ok(hrefs("father").includes("/persetujuan"));
  assert.ok(!hrefs("child").includes("/persetujuan"));
  assert.ok(!hrefs("art").includes("/persetujuan"));
});
