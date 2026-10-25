import assert from "node:assert/strict";
import test from "node:test";
import { messages } from "./messages.ts";

test("bahasa id dan en punya kunci yang sama", () => {
  assert.deepEqual(
    Object.keys(messages.en).sort(),
    Object.keys(messages.id).sort(),
  );
});

test("tidak ada teks kosong", () => {
  for (const [lang, dict] of Object.entries(messages)) {
    for (const [key, text] of Object.entries(dict)) {
      assert.ok(text.trim().length > 0, `${lang}.${key} kosong`);
    }
  }
});
