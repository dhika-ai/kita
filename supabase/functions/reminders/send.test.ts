import assert from "node:assert/strict";
import { test } from "node:test";
import { sendAll } from "./send.ts";

const reminder = (member_id: string) => ({ member_id, chat_id: 1, text: "x" });

test("satu pesan gagal tidak menghentikan pesan lain, dan semua hasil dicatat", async () => {
  const logged: [string, string | null][] = [];
  const result = await sendAll(
    [reminder("a"), reminder("b"), reminder("c")],
    async ({ member_id }) => {
      if (member_id === "a") throw new Error("jaringan putus");
      return member_id === "b" ? "403 Forbidden: bot was blocked" : null;
    },
    async ({ member_id }, error) => logged.push([member_id, error]),
  );
  assert.deepEqual(result, { sent: 1, failed: 2 });
  assert.deepEqual(logged, [
    ["a", "Error: jaringan putus"],
    ["b", "403 Forbidden: bot was blocked"],
    ["c", null],
  ]);
});
