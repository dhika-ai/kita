import assert from "node:assert/strict";
import { test } from "node:test";
import {
  languageOf,
  linkReply,
  startCode,
  startReply,
  webhookSecret,
} from "./bot.ts";

const start = (language_code?: string) => ({
  message: { chat: { id: 1 }, text: "/start", from: { language_code } },
});

test("/start dibalas dalam bahasa Telegram pengguna, default Indonesia", () => {
  assert.equal(languageOf(start("en-US")), "en");
  assert.equal(languageOf(start("id")), "id");
  assert.equal(languageOf(start()), "id");
  assert.match(startReply("id"), /Hubungkan Telegram/);
  assert.match(startReply("en"), /Connect Telegram/);
});

test("rahasia webhook tetap untuk token yang sama dan memenuhi aturan Telegram", async () => {
  const a = await webhookSecret("123:abc");
  assert.equal(a, await webhookSecret("123:abc"));
  assert.notEqual(a, await webhookSecret("123:abd"));
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("kode diambil dari /start <kode>", () => {
  assert.equal(startCode("/start AB12CD34"), "AB12CD34");
  assert.equal(startCode("/start@KitaBot AB12CD34"), "AB12CD34");
  assert.equal(startCode("/start"), null);
  assert.equal(startCode(undefined), null);
});

test("balasan sambung memakai bahasa anggota", () => {
  assert.match(
    linkReply({ display_name: "Andi", language: "id" }, "en"),
    /^Terhubung! Andi/,
  );
  assert.match(
    linkReply({ display_name: "Budi", language: "en" }, "id"),
    /^Connected! Budi/,
  );
  assert.match(linkReply(undefined, "id"), /kedaluwarsa/);
});
