import assert from "node:assert/strict";
import { test } from "node:test";
import { isBackup, photoFiles, zipPath, type Backup } from "./backup.ts";

const backup: Backup = {
  app: "kita",
  version: 1,
  family_id: "f1",
  exported_at: "2026-10-27T00:00:00Z",
  tables: {
    sops: [
      {
        photo_path: "f1/sop.jpg",
        steps: [{ photo_path: "f1/step.jpg" }, { photo_path: null }],
      },
    ],
    task_completions: [{ photo_path: "f1/a.jpg" }, { photo_path: null }],
    moments: [{ photo_path: "f1/m.jpg" }],
    daily_messages: [],
    transactions: [{ receipt_path: "f1/r.jpg" }, { receipt_path: "f1/r.jpg" }],
  },
};

test("semua foto dari backup ikut, tanpa duplikat", () => {
  assert.deepEqual(photoFiles(backup).map(zipPath).sort(), [
    "files/moment-photos/f1/m.jpg",
    "files/receipts/f1/r.jpg",
    "files/sop-photos/f1/sop.jpg",
    "files/sop-photos/f1/step.jpg",
    "files/task-photos/f1/a.jpg",
  ]);
});

test("file selain backup KITA dikenali", () => {
  assert.equal(isBackup(backup), true);
  assert.equal(isBackup({ app: "lain", tables: {} }), false);
  assert.equal(isBackup(null), false);
});
