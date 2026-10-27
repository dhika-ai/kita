// B-01: isi backup dari export_backup (server) dan daftar foto yang ikut dikemas di ZIP.

export type Backup = {
  app: "kita";
  version: number;
  family_id: string;
  exported_at: string;
  tables: Record<string, Record<string, unknown>[]>;
};

export type PhotoFile = { bucket: string; path: string };

const photoColumns: [table: string, column: string, bucket: string][] = [
  ["sops", "photo_path", "sop-photos"],
  ["task_completions", "photo_path", "task-photos"],
  ["moments", "photo_path", "moment-photos"],
  ["daily_messages", "photo_path", "message-photos"],
  ["transactions", "receipt_path", "receipts"],
];

/** Semua foto yang dirujuk data backup, tanpa duplikat. */
export function photoFiles(backup: Backup): PhotoFile[] {
  const found = new Map<string, PhotoFile>();
  const add = (bucket: string, path: unknown) => {
    if (typeof path === "string" && path)
      found.set(`${bucket}/${path}`, { bucket, path });
  };
  for (const [table, column, bucket] of photoColumns)
    for (const row of backup.tables[table] ?? []) add(bucket, row[column]);
  // Foto per langkah SOP disimpan di dalam kolom steps.
  for (const sop of backup.tables.sops ?? [])
    for (const step of (sop.steps as { photo_path?: string }[]) ?? [])
      add("sop-photos", step.photo_path);
  return [...found.values()];
}

/** Nama file foto di dalam ZIP. */
export const zipPath = (file: PhotoFile) => `files/${file.bucket}/${file.path}`;

export function isBackup(value: unknown): value is Backup {
  const backup = value as Backup | null;
  return backup?.app === "kita" && typeof backup.tables === "object";
}
