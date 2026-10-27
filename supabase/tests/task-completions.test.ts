import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000f1";
const child = "00000000-0000-0000-0000-0000000000f3";
const art = "00000000-0000-0000-0000-0000000000f4";

describe("T-07 centang tugas selesai", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let familyId: string;
  let fatherId: string;
  let childId: string;
  let artId: string;
  let childTask: string;
  let artTask: string;

  const join = (user: string, name: string, role: string) => {
    const id = db.as(father, `select public.add_member('${name}', '${role}');`);
    const code = db.as(
      father,
      `select invite_code from public.members where id = '${id}';`,
    );
    db.as(user, `select public.join_family('${code}');`);
    return id;
  };
  const taskFor = (memberId: string) => {
    const templateId = db.as(
      father,
      `select public.create_task('Task', 'Tugas', (select id from public.categories limit 1),
        (select id from public.areas limit 1), '${memberId}');`,
    );
    return db.as(
      father,
      `select id from public.task_instances where template_id = '${templateId}';`,
    );
  };
  const tick = (user: string, id: string, instance: string, member: string) =>
    db.as(
      user,
      `insert into public.task_completions (id, family_id, instance_id, member_id, note)
       values ('${id}', '${familyId}', '${instance}', '${member}', 'Sudah')
       on conflict (id) do nothing;`,
    );
  const status = (instance: string) =>
    db.as(
      father,
      `select status from public.task_instances where id = '${instance}';`,
    );

  before(() => {
    db = createTestDb();
    db.admin(
      `insert into auth.users (id) values ('${father}'), ('${child}'), ('${art}');`,
    );
    familyId = db.as(
      father,
      "select public.create_family('Keluarga Budi', 'Budi');",
    );
    fatherId = db.as(father, "select (private.my_member()).id;");
    childId = join(child, "Andi", "child");
    artId = join(art, "Tini", "art");
    childTask = taskFor(childId);
    artTask = taskFor(artId);
  });

  after(() => db?.drop());

  test("anak mencentang tugasnya sendiri dan status menjadi done", () => {
    tick(child, "40000000-0000-0000-0000-000000000001", childTask, childId);
    assert.equal(status(childTask), "done");
  });

  test("centang yang terkirim dua kali dari antrean sync tidak membuat baris ganda", () => {
    tick(child, "40000000-0000-0000-0000-000000000001", childTask, childId);
    assert.equal(
      db.as(
        father,
        `select count(*) from public.task_completions where instance_id = '${childTask}';`,
      ),
      "1",
    );
  });

  test("anak tidak bisa mencentang tugas orang lain", () => {
    assert.throws(
      () =>
        tick(child, "40000000-0000-0000-0000-000000000002", artTask, childId),
      /row-level security/,
    );
    assert.throws(
      () => tick(child, "40000000-0000-0000-0000-000000000003", artTask, artId),
      /row-level security/,
    );
    assert.equal(status(artTask), "open");
  });

  test("ART mencentang tugasnya sendiri", () => {
    tick(art, "40000000-0000-0000-0000-000000000004", artTask, artId);
    assert.equal(status(artTask), "done");
  });

  test("orang tua bisa mencentang tugas siapa saja", () => {
    const task = taskFor(childId);
    tick(father, "40000000-0000-0000-0000-000000000005", task, fatherId);
    assert.equal(status(task), "done");
  });

  test("anggota tidak bisa mengubah status tugas secara langsung", () => {
    assert.throws(
      () =>
        db.as(
          child,
          `update public.task_instances set status = 'approved' where id = '${childTask}';`,
        ),
      /permission denied/,
    );
  });
});
