import assert from "node:assert/strict";
import { test } from "node:test";
import { messagesToShow } from "./daily-message.ts";

const message = (id: string, message_date: string, hour = "08") => ({
  id,
  message_date,
  created_at: `${message_date}T${hour}:00:00Z`,
  deleted_at: null as string | null,
});

const ids = (list: { id: string }[]) => list.map((m) => m.id);

test("pesan hari ini tampil, urut dari yang pertama ditulis", () => {
  const list = [
    message("lama", "2026-10-26"),
    message("ibu", "2026-10-27", "09"),
    message("ayah", "2026-10-27", "07"),
  ];
  assert.deepEqual(ids(messagesToShow(list, "2026-10-27")), ["ayah", "ibu"]);
});

test("hari ini kosong: pesan dari tanggal terakhir yang tampil", () => {
  const list = [message("a", "2026-10-20"), message("b", "2026-10-25")];
  assert.deepEqual(ids(messagesToShow(list, "2026-10-27")), ["b"]);
});

test("pesan terhapus diabaikan, belum ada pesan: kosong", () => {
  const deleted = { ...message("x", "2026-10-27"), deleted_at: "2026-10-27" };
  assert.deepEqual(messagesToShow([deleted], "2026-10-27"), []);
  assert.deepEqual(messagesToShow([], "2026-10-27"), []);
});
