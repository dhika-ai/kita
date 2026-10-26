import assert from "node:assert/strict";
import { test } from "node:test";
import { pushOutbox, type OutboxEntry, type OutboxStore } from "./outbox.ts";

// Antrean di memori, meniru tabel outbox di IndexedDB.
function memoryOutbox(entries: OutboxEntry[]): OutboxStore & {
  entries: OutboxEntry[];
} {
  const store = {
    entries: entries.map((entry, i) => ({ ...entry, seq: i + 1 })),
    list: async () => [...store.entries],
    remove: async (seq: number) => {
      store.entries = store.entries.filter((entry) => entry.seq !== seq);
    },
  };
  return store;
}

// Server tiruan yang menyimpan dengan upsert berdasarkan id, seperti Supabase.
function fakeServer() {
  const rows = new Map<string, Record<string, unknown>>();
  let online = false;
  return {
    rows,
    setOnline: (value: boolean) => (online = value),
    send: async (entry: OutboxEntry) => {
      if (!online) throw new TypeError("Failed to fetch");
      rows.set(`${entry.table}/${entry.row.id}`, entry.row);
    },
  };
}

test("perubahan saat offline tetap di antrean, lalu terkirim setelah online", async () => {
  const outbox = memoryOutbox([
    { table: "tasks", row: { id: "a", done: true } },
    { table: "tasks", row: { id: "b", done: false } },
  ]);
  const server = fakeServer();

  assert.equal(await pushOutbox(outbox, server.send), 0);
  assert.equal(outbox.entries.length, 2);
  assert.equal(server.rows.size, 0);

  server.setOnline(true);
  assert.equal(await pushOutbox(outbox, server.send), 2);
  assert.equal(outbox.entries.length, 0);
  assert.equal(server.rows.size, 2);
});

test("entri yang terkirim dua kali tidak membuat data ganda", async () => {
  const server = fakeServer();
  server.setOnline(true);
  const entry = { table: "tasks", row: { id: "a", done: true } };

  // Aplikasi tertutup setelah mengirim tapi sebelum entri dihapus: entri dikirim lagi.
  await pushOutbox(memoryOutbox([entry]), server.send);
  await pushOutbox(memoryOutbox([entry]), server.send);

  assert.equal(server.rows.size, 1);
});

test("perubahan berurutan pada baris yang sama berakhir di nilai terakhir", async () => {
  const server = fakeServer();
  server.setOnline(true);
  await pushOutbox(
    memoryOutbox([
      { table: "tasks", row: { id: "a", done: true } },
      { table: "tasks", row: { id: "a", done: false } },
    ]),
    server.send,
  );
  assert.deepEqual(server.rows.get("tasks/a"), { id: "a", done: false });
});

test("berhenti di kegagalan pertama supaya urutan terjaga", async () => {
  const outbox = memoryOutbox([
    { table: "tasks", row: { id: "a" } },
    { table: "tasks", row: { id: "b" } },
  ]);
  let calls = 0;
  const sent = await pushOutbox(outbox, async () => {
    calls++;
    throw new TypeError("Failed to fetch");
  });
  assert.equal(sent, 0);
  assert.equal(calls, 1);
  assert.deepEqual(
    outbox.entries.map((entry) => entry.row.id),
    ["a", "b"],
  );
});
