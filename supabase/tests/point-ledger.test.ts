import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000a1";
const child = "00000000-0000-0000-0000-0000000000a3";
const outsider = "00000000-0000-0000-0000-0000000000a5";

describe("G-01 buku poin", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let familyId: string;
  let childId: string;

  const newTask = (points: number) => {
    const templateId = db.as(
      father,
      `select public.create_task('Task', 'Tugas', (select id from public.categories where kind = 'cleaning'),
        (select id from public.areas limit 1), '${childId}', ${points}, due_date => '2026-11-02');`,
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
  const balance = () =>
    db.as(
      child,
      `select coalesce(sum(balance), 0) from public.point_balances where member_id = '${childId}';`,
    );
  const review = (instance: string, approve: boolean) =>
    db.as(
      father,
      `select public.review_tasks(array['${instance}']::uuid[], ${approve}, ${approve ? "null" : "'Belum bersih'"});`,
    );

  before(() => {
    db = createTestDb();
    db.admin(
      `insert into auth.users (id) values ('${father}'), ('${child}'), ('${outsider}');`,
    );
    familyId = db.as(
      father,
      "select public.create_family('Keluarga Budi', 'Budi');",
    );
    childId = db.as(father, "select public.add_member('Andi', 'child');");
    const code = db.as(
      father,
      `select invite_code from public.members where id = '${childId}';`,
    );
    db.as(child, `select public.join_family('${code}');`);
    db.as(outsider, "select public.create_family('Keluarga Lain', 'Joko');");
  });

  after(() => db?.drop());

  test("poin langsung masuk saat dicentang, tidak dobel saat disetujui", () => {
    const a = newTask(10);
    assert.equal(balance(), "0");
    tick(a);
    assert.equal(balance(), "10");
    review(a, true);
    assert.equal(balance(), "10");
  });

  test("ditolak saat cek acak: poin ditarik, centang ulang memberi poin lagi", () => {
    const b = newTask(5);
    tick(b);
    assert.equal(balance(), "15");
    review(b, false);
    assert.equal(balance(), "10");
    tick(b);
    assert.equal(balance(), "15");
    assert.equal(
      db.as(
        father,
        `select string_agg(kind || ':' || points, ',' order by created_at) from public.point_ledger where instance_id = '${b}';`,
      ),
      "task:5,revoked:-5,task:5",
    );
  });

  test("total ledger tugas = jumlah poin tugas selesai/disetujui = poin dasbor", () => {
    const fromTasks = db.admin(
      `select sum(t.points) from public.task_instances i join public.task_templates t on t.id = i.template_id
       where i.assignee_id = '${childId}' and i.status in ('done', 'approved');`,
    );
    const fromLedger = db.as(
      father,
      `select sum(points) from public.point_ledger where member_id = '${childId}' and kind in ('task', 'revoked');`,
    );
    const fromDashboard = db.as(
      father,
      `select sum(points) from public.dashboard_daily where member_id = '${childId}';`,
    );
    assert.equal(fromLedger, fromTasks);
    assert.equal(fromDashboard, fromTasks);
  });

  test("koreksi orang tua dengan catatan; anak tidak bisa mengoreksi", () => {
    db.as(
      father,
      `select public.correct_points('${childId}', -3, 'Lupa matikan lampu');`,
    );
    assert.equal(balance(), "12");
    assert.throws(() =>
      db.as(child, `select public.correct_points('${childId}', 100, 'Bonus');`),
    );
    assert.throws(() =>
      db.as(father, `select public.correct_points('${childId}', 5, '  ');`),
    );
  });

  test("tidak ada yang bisa menulis ledger langsung; keluarga lain tidak melihat", () => {
    assert.throws(() =>
      db.as(
        father,
        `insert into public.point_ledger (family_id, member_id, points, kind)
         values ('${familyId}', '${childId}', 999, 'correction');`,
      ),
    );
    assert.equal(
      db.as(outsider, "select count(*) from public.point_ledger;"),
      "0",
    );
  });
});
