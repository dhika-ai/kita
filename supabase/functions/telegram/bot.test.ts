import assert from "node:assert/strict";
import { test } from "node:test";
import { languageOf, startReply, webhookSecret } from "./bot.ts";

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
