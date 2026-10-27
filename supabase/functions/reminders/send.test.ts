import assert from "node:assert/strict";
import { test } from "node:test";
import { sendAll, type Subscription } from "./send.ts";

const hp = (endpoint: string): Subscription => ({
  endpoint,
  p256dh: "k",
  auth: "a",
});
const reminder = (member_id: string, ...endpoints: string[]) => ({
  member_id,
  text: `pesan ${member_id}`,
  subscriptions: endpoints.map(hp),
});

test("satu pesan gagal tidak menghentikan pesan lain, dan semua hasil dicatat", async () => {
  const logged: [string, string | null][] = [];
  const result = await sendAll(
    [reminder("a", "hp-a"), reminder("b", "hp-b"), reminder("c", "hp-c")],
    async ({ endpoint }) => {
      if (endpoint === "hp-a") throw new Error("jaringan putus");
      return endpoint === "hp-b" ? "403 Forbidden" : null;
    },
    async () => {},
    async ({ member_id }, error) => logged.push([member_id, error]),
  );
  assert.deepEqual(result, { sent: 1, failed: 2 });
  assert.deepEqual(logged, [
    ["a", "Error: jaringan putus"],
    ["b", "403 Forbidden"],
    ["c", null],
  ]);
});

test("pengingat si kecil terkirim ke semua HP; cukup satu HP yang menerima", async () => {
  const pushed: string[] = [];
  const forgotten: string[] = [];
  const logged: [string, string | null][] = [];
  const result = await sendAll(
    [reminder("andi", "hp-ayah", "hp-ibu")],
    async ({ endpoint }, text) => {
      pushed.push(`${endpoint}: ${text}`);
      return endpoint === "hp-ibu" ? "gone" : null;
    },
    async ({ endpoint }) => forgotten.push(endpoint),
    async ({ member_id }, error) => logged.push([member_id, error]),
  );
  assert.deepEqual(pushed, ["hp-ayah: pesan andi", "hp-ibu: pesan andi"]);
  assert.deepEqual(forgotten, ["hp-ibu"]);
  assert.deepEqual(logged, [["andi", null]]);
  assert.deepEqual(result, { sent: 1, failed: 0 });
});

test("semua HP gagal: tercatat gagal supaya dicoba ulang", async () => {
  const logged: (string | null)[] = [];
  await sendAll(
    [reminder("budi", "hp-1", "hp-2")],
    async ({ endpoint }) => (endpoint === "hp-1" ? "gone" : "500 error"),
    async () => {},
    async (_, error) => logged.push(error),
  );
  assert.deepEqual(logged, ["langganan kedaluwarsa; 500 error"]);
});
