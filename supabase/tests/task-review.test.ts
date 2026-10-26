import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000f1";
const mother = "00000000-0000-0000-0000-0000000000f2";
const child = "00000000-0000-0000-0000-0000000000f3";

describe("T-08 persetujuan orang tua", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let familyId: string;
  let childId: string;

  const join = (user: string, name: string, role: string) => {
    const id = db.as(father, `select public.add_member('${name}', '${role}');`);
    const code = db.as(
      father,
      `select invite_code from public.members where id = '${id}';`,
    );
    db.as(user, `select public.join_family('${code}');`);
    return id;
  };
  const newTask = (dueDate = "2026-11-02") => {
    const templateId = db.as(
      father,
      `select public.create_task('Task', 'Tugas', (select id from public.categories where kind = 'cleaning'),
        (select id from public.areas limit 1), '${childId}', 10, due_date => '${dueDate}');`,
    );
    return db.as(
      father,
      `select id from public.task_instances where template_id = '${templateId}';`,
    );
  };
  const tick = (instance: string) =>
    db.as(
      child,
      `insert into public.task_completions (family_id, instance_id, member_id)
       values ('${familyId}', '${instance}', '${childId}');`,
    );
  const row = (instance: string, columns: string) =>
    db.as(
      father,
      `select ${columns} from public.task_instances where id = '${instance}';`,
    );

  before(() => {
    db = createTestDb();
    db.admin(
      `insert into auth.users (id) values ('${father}'), ('${mother}'), ('${child}');`,
    );
    familyId = db.as(
      father,
      "select public.create_family('Keluarga Budi', 'Budi');",
    );
    join(mother, "Sari", "mother");
    childId = join(child, "Andi", "child");
  });

  after(() => db?.drop());

  test("ibu menyetujui beberapa tugas sekaligus; dihitung mulai besok", () => {
    const a = newTask();
    const b = newTask();
    tick(a);
    tick(b);
    assert.equal(
      db.as(
        mother,
        `select public.review_tasks(array['${a}', '${b}']::uuid[], true);`,
      ),
      "2",
    );
    assert.equal(
      row(
        a,
        "status || '|' || (counts_on = (now() at time zone 'Asia/Jakarta')::date + 1) || '|' || (approved_by_id is not null)",
      ),
      "approved|true|true",
    );
  });

  test("tugas yang ditolak kembali ke open dengan alasan", () => {
    const task = newTask();
    tick(task);
    db.as(
      father,
      `select public.review_tasks(array['${task}']::uuid[], false, 'Lantai masih kotor');`,
    );
    assert.equal(
      row(task, "status || '|' || rejection_reason"),
      "open|Lantai masih kotor",
    );
    assert.throws(
      () =>
        db.as(
          father,
          `select public.review_tasks(array['${task}']::uuid[], false, ' ');`,
        ),
      /Alasan penolakan wajib/,
    );
  });

  test("hanya tugas yang sudah dicentang yang bisa disetujui", () => {
    const task = newTask();
    assert.equal(
      db.as(
        father,
        `select public.review_tasks(array['${task}']::uuid[], true);`,
      ),
      "0",
    );
    assert.equal(row(task, "status"), "open");
  });

  test("anak tidak bisa menyetujui", () => {
    const task = newTask();
    tick(task);
    assert.throws(
      () =>
        db.as(
          child,
          `select public.review_tasks(array['${task}']::uuid[], true);`,
        ),
      /Hanya ayah atau ibu/,
    );
  });

  test("tutup hari: yang belum direview tidak disetujui otomatis, yang belum dikerjakan jadi missed", () => {
    const done = newTask("2026-11-03");
    const open = newTask("2026-11-03");
    tick(done);
    db.admin("select private.close_day('2026-11-03');");
    assert.equal(row(done, "status"), "done");
    assert.equal(row(open, "status"), "missed");
  });

  test("centang setelah hari ditutup masuk sebagai done dan menunggu review", () => {
    const task = newTask("2026-11-04");
    db.admin("select private.close_day('2026-11-04');");
    tick(task);
    assert.equal(row(task, "status"), "done");
  });
});
