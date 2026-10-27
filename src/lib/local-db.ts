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
  auth_user_id: string | null;
  display_name: string;
  role: Role;
  invite_code: string | null;
  has_pin: boolean;
  pin_locked: boolean;
  telegram_connected?: boolean;
  telegram_mute_morning?: boolean;
  telegram_mute_evening?: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// Master data (T-03). Nama selalu ada dalam dua bahasa.
type Synced = {
  id: string;
  family_id: string;
  created_at: string;
  updated_at?: string;
  deleted_at: string | null;
};

export type LocalArea = Synced & {
  name_en: string;
  name_id: string;
  icon: string | null;
};

export type CategoryKind =
  | "cleaning"
  | "laundry"
  | "maintenance"
  | "inventory"
  | "cooking"
  | "personal_habit";

export type LocalCategory = Synced & {
  name_en: string;
  name_id: string;
  kind: CategoryKind;
};

export type SopStep = { en: string; id: string; photo_path: string | null };

export type LocalSop = Synced & {
  title_en: string;
  title_id: string;
  steps: SopStep[];
  photo_path: string | null;
};

export type ChoreType = "routine" | "periodic" | "adhoc";
export type Recurrence = "daily" | "weekly" | "monthly";

export type LocalTaskTemplate = Synced & {
  title_en: string;
  title_id: string;
  category_id: string;
  area_id: string;
  sop_id: string | null;
  chore_type: ChoreType;
  recurrence: Recurrence | null;
  /** 1 = Senin ... 7 = Minggu */
  weekdays: number[] | null;
  month_day: number | null;
  due_time: string | null;
  default_assignee_id: string | null;
  points: number;
  requires_approval: boolean;
};

export type TaskStatus = "open" | "done" | "approved" | "rejected" | "missed";

export type LocalTaskInstance = Synced & {
  template_id: string;
  assignee_id: string | null;
  assigned_by_id: string | null;
  due_date: string;
  status: TaskStatus;
  approved_by_id: string | null;
  approved_at: string | null;
  counts_on: string | null;
  rejection_reason: string | null;
};

export type LocalTaskCompletion = Synced & {
  instance_id: string;
  member_id: string;
  done_at: string;
  note: string | null;
  photo_path: string | null;
};

export type LocalInventoryItem = Synced & {
  name: string;
  area_id: string | null;
  unit: string;
  qty_on_hand: number;
  min_qty: number;
  restock_task_template_id: string | null;
};

// Moments (M-06): jurnal dan/atau foto harian.
export type LocalMoment = Synced & {
  member_id: string;
  moment_date: string;
  journal: string | null;
  photo_path: string | null;
};

// Moment of the Week & Month (M-08): id = "<family_id>:<period>:<period_start>".
export type LocalMomentPick = Synced & {
  period: "week" | "month";
  period_start: string;
  moment_id: string;
};

// Pesan Harian dari Ayah/Ibu (M-01, pengganti quote).
export type LocalDailyMessage = Synced & {
  author_id: string;
  message_date: string;
  body: string;
  photo_path: string | null;
};

// Keuangan (K-01): hanya disalin ke perangkat ayah/ibu. Nominal dalam Rupiah (bilangan bulat).
export type LocalAccount = Synced & {
  name: string;
  kind: "cash" | "bank" | "ewallet";
};

export type LocalBudgetPost = Synced & {
  name: string;
  kind: "income" | "expense";
  monthly_budget: number | null;
};

export type LocalTransaction = Synced & {
  kind: "income" | "expense";
  amount: number;
  post_id: string;
  account_id: string;
  tx_date: string;
  note: string | null;
  receipt_path: string | null;
  created_by: string;
};

/** Waktu `updated_at` terakhir yang sudah ditarik, per tabel. */
type PullState = { table: string; pulledUntil: string };

export const localDb = new Dexie("kita") as Dexie & {
  families: EntityTable<LocalFamily, "id">;
  members: EntityTable<LocalMember, "id">;
  areas: EntityTable<LocalArea, "id">;
  categories: EntityTable<LocalCategory, "id">;
  sops: EntityTable<LocalSop, "id">;
  task_templates: EntityTable<LocalTaskTemplate, "id">;
  task_instances: EntityTable<LocalTaskInstance, "id">;
  task_completions: EntityTable<LocalTaskCompletion, "id">;
  inventory_items: EntityTable<LocalInventoryItem, "id">;
  moments: EntityTable<LocalMoment, "id">;
  moment_picks: EntityTable<LocalMomentPick, "id">;
  daily_messages: EntityTable<LocalDailyMessage, "id">;
  accounts: EntityTable<LocalAccount, "id">;
  budget_posts: EntityTable<LocalBudgetPost, "id">;
  transactions: EntityTable<LocalTransaction, "id">;
  outbox: EntityTable<OutboxEntry, "seq">;
  pullState: EntityTable<PullState, "table">;
};

localDb.version(1).stores({
  families: "id",
  members: "id, family_id, created_at",
  outbox: "++seq",
  pullState: "table",
});

localDb.version(2).stores({
  areas: "id",
  categories: "id",
  sops: "id",
});

localDb.version(3).stores({
  task_templates: "id",
});

localDb.version(4).stores({
  task_instances: "id, due_date",
  task_completions: "id, instance_id",
});

localDb.version(5).stores({
  inventory_items: "id",
});

localDb.version(6).stores({
  moments: "id, moment_date",
});

localDb.version(7).stores({
  moment_picks: "id",
});

localDb.version(8).stores({
  daily_messages: "id, message_date",
});

localDb.version(9).stores({
  accounts: "id",
  budget_posts: "id",
  transactions: "id, tx_date",
});
