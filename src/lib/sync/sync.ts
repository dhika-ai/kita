"use client";

import { localDb } from "../local-db";
import { supabase } from "../supabase";
import { pushOutbox, type Row } from "./outbox";

// Tabel yang disalin ke perangkat, beserta kolom yang boleh dibaca aplikasi.
const pulledTables = {
  families: "id, name, updated_at, deleted_at",
  members:
    "id, family_id, auth_user_id, display_name, role, invite_code, has_pin, pin_locked, telegram_connected, telegram_mute_morning, telegram_mute_evening, is_active, created_at, updated_at, deleted_at",
  areas: "*",
  categories: "*",
  sops: "*",
  task_templates: "*",
  task_instances: "*",
  task_completions: "*",
  inventory_items: "*",
  moments: "*",
  moment_picks: "*",
} as const;

// Entri antrean untuk foto memakai nama tabel "storage/<bucket>" dan row { id: path, blob }.
const storagePrefix = "storage/";

// Tabel yang hanya ditambah, tidak pernah diubah: kiriman ulang cukup diabaikan
// (ON CONFLICT DO NOTHING), jadi tidak butuh izin update.
const appendOnly = new Set(["task_completions"]);

type PulledTable = keyof typeof pulledTables;

/**
 * Memasukkan foto ke antrean kirim (M-06), supaya foto yang diambil saat offline
 * terunggah setelah online. Panggil sebelum saveLocal untuk baris yang memakai
 * path ini, jadi fotonya terkirim lebih dulu.
 */
export async function queuePhoto(bucket: string, path: string, blob: Blob) {
  await localDb.outbox.add({
    table: storagePrefix + bucket,
    row: { id: path, blob },
  });
}

/** Foto yang masih menunggu diunggah, supaya bisa ditampilkan dari perangkat. */
export async function pendingPhoto(path: string) {
  const entries = await localDb.outbox.toArray();
  const entry = entries.find(
    (e) => e.table.startsWith(storagePrefix) && e.row.id === path,
  );
  return entry?.row.blob as Blob | undefined;
}

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
      if (table.startsWith(storagePrefix)) {
        const { error } = await supabase.storage
          .from(table.slice(storagePrefix.length))
          .upload(row.id, row.blob as Blob, { contentType: "image/jpeg" });
        // Sudah ada = kiriman sebelumnya berhasil tetapi entrinya belum terhapus.
        if (error && !/exists|duplicate/i.test(error.message)) throw error;
        return;
      }
      const { error } = await supabase
        .from(table)
        .upsert(row, { ignoreDuplicates: appendOnly.has(table) });
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
