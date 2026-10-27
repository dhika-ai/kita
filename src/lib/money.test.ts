import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRupiah, parseRupiah } from "./money.ts";

test("format Rupiah dengan titik ribuan", () => {
  assert.equal(formatRupiah(1250000), "Rp\u00a01.250.000");
  assert.equal(formatRupiah(0), "Rp\u00a00");
});

test("isian nominal diterima dengan atau tanpa pemisah", () => {
  assert.equal(parseRupiah("1.250.000"), 1250000);
  assert.equal(parseRupiah("Rp 25000"), 25000);
  assert.ok(Number.isNaN(parseRupiah("abc")));
  assert.ok(Number.isNaN(parseRupiah("-5000")));
  assert.ok(Number.isNaN(parseRupiah("")));
});
