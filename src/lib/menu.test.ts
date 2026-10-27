import assert from "node:assert/strict";
import { test } from "node:test";
import { menuFor } from "./menu.ts";

const hrefs = (role: Parameters<typeof menuFor>[0]) =>
  menuFor(role).map((item) => item.href);

test("ayah dan ibu melihat menu anggota keluarga", () => {
  assert.deepEqual(hrefs("father"), ["/", "/keluarga", "/ganti"]);
  assert.deepEqual(hrefs("mother"), ["/", "/keluarga", "/ganti"]);
});

test("anak dan ART tidak melihat menu anggota keluarga", () => {
  assert.deepEqual(hrefs("child"), ["/", "/ganti"]);
  assert.deepEqual(hrefs("art"), ["/", "/ganti"]);
});
