import Dexie, { type EntityTable } from "dexie";
import type { OutboxEntry } from "./sync/outbox";
import type { Role } from "./auth";

// Salinan data keluarga di perangkat (IndexedDB), supaya aplikasi tetap bisa dibuka
// dan dipakai saat offline.
export type LocalFamily = {
  id: string;
  name: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LocalMember = {
  id: string;
  family_id: string;
  display_name: string;
  role: Role;
  invite_code: string | null;
  has_pin: boolean;
  pin_locked: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Waktu `updated_at` terakhir yang sudah ditarik, per tabel. */
type PullState = { table: string; pulledUntil: string };

export const localDb = new Dexie("kita") as Dexie & {
  families: EntityTable<LocalFamily, "id">;
  members: EntityTable<LocalMember, "id">;
  outbox: EntityTable<OutboxEntry, "seq">;
  pullState: EntityTable<PullState, "table">;
};

localDb.version(1).stores({
  families: "id",
  members: "id, family_id, created_at",
  outbox: "++seq",
  pullState: "table",
});
