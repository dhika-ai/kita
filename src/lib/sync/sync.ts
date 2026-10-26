"use client";

import { localDb } from "../local-db";
import { supabase } from "../supabase";
import { pushOutbox, type Row } from "./outbox";

// Tabel yang disalin ke perangkat, beserta kolom yang boleh dibaca aplikasi.
const pulledTables = {
  families: "id, name, updated_at, deleted_at",
  members:
    "id, family_id, display_name, role, invite_code, has_pin, pin_locked, is_active, created_at, updated_at, deleted_at",
} as const;

type PulledTable = keyof typeof pulledTables;

/**
 * Menyimpan perubahan di perangkat dan memasukkannya ke antrean kirim.
 * Dipakai fitur yang menulis data (mulai dari Task Tracker). `row.id` dibuat di
 * perangkat (crypto.randomUUID()) supaya pengiriman ulang tidak membuat data ganda.
 */
export async function saveLocal(table: string, row: Row) {
  await localDb.transaction("rw", localDb.table(table), localDb.outbox, () => {
    localDb.table(table).put(row);
    localDb.outbox.add({ table, row });
  });
  void sync();
}

async function push() {
  return pushOutbox(
    {
      list: () => localDb.outbox.orderBy("seq").toArray(),
      remove: (seq) => localDb.outbox.delete(seq),
    },
    async ({ table, row }) => {
      const { error } = await supabase.from(table).upsert(row);
      if (error) throw error;
    },
  );
}

async function pull(table: PulledTable) {
  const state = await localDb.pullState.get(table);
  let query = supabase
    .from(table)
    .select(pulledTables[table])
    .order("updated_at");
  if (state) query = query.gt("updated_at", state.pulledUntil);

  const { data, error } = await query;
  if (error) throw error;
  if (data.length === 0) return;

  const rows = data as unknown as { updated_at: string }[];
  await localDb.transaction(
    "rw",
    localDb.table(table),
    localDb.pullState,
    () => {
      localDb.table(table).bulkPut(rows);
      localDb.pullState.put({
        table,
        pulledUntil: rows[rows.length - 1].updated_at,
      });
    },
  );
}

let running: Promise<void> | null = null;
let again = false;

/** Kirim antrean lalu tarik perubahan terbaru. Aman dipanggil berkali-kali. */
export function sync(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await push();
        for (const table of Object.keys(pulledTables) as PulledTable[]) {
          await pull(table);
        }
      } while (again);
    } catch (error) {
      console.warn("Sync: gagal, dicoba lagi nanti", error);
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Mulai sinkron otomatis: sekarang, saat kembali online, dan saat ada perubahan dari anggota lain. */
export function startSync() {
  void sync();
  window.addEventListener("online", sync);

  const channel = supabase.channel("kita-sync");
  for (const table of Object.keys(pulledTables)) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => {
        void sync();
      },
    );
  }
  channel.subscribe();

  return () => {
    window.removeEventListener("online", sync);
    void supabase.removeChannel(channel);
  };
}

/** Hapus salinan data di perangkat, misalnya saat keluar akun. */
export async function clearLocal() {
  await Promise.all(localDb.tables.map((table) => table.clear()));
}
