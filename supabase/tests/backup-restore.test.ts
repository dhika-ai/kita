import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000c1";
const child = "00000000-0000-0000-0000-0000000000c3";
const outsider = "00000000-0000-0000-0000-0000000000c5";

describe("B-01 backup & restore", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let familyId: string;
  let childId: string;
  let instanceId: string;

  const balance = () =>
    db.as(
      father,
      `select coalesce(sum(points), 0) from public.point_ledger where member_id = '${childId}';`,
    );
  const exportBackup = (who = father) =>
    db.as(who, "select public.export_backup();");
  const restore = (backup: string, who = father) =>
    db.as(who, `select public.restore_backup($json$${backup}$json$::jsonb);`);

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
    db.admin(
      `update public.members set pin_hash = 'rahasia', telegram_chat_id = 7 where id = '${childId}';`,
    );

    const templateId = db.as(
      father,
      `select public.create_task('Task', 'Sapu lantai', (select id from public.categories where kind = 'cleaning'),
        (select id from public.areas limit 1), '${childId}', 10, due_date => '2026-11-02');`,
    );
    instanceId = db.as(
      father,
      `select id from public.task_instances where template_id = '${templateId}';`,
    );
    db.as(
      child,
      `insert into public.task_completions (family_id, instance_id, member_id)
       values ('${familyId}', '${instanceId}', '${childId}');`,
    );
  });

  after(() => db?.drop());

  test("backup berisi data keluarga sendiri tanpa PIN dan chat Telegram", () => {
    const backup = JSON.parse(exportBackup());
    assert.equal(backup.family_id, familyId);
    assert.equal(backup.tables.families.length, 1);
    assert.equal(backup.tables.members.length, 2);
    assert.equal(backup.tables.task_completions.length, 1);
    assert.ok(backup.tables.categories.length > 0);
    for (const m of backup.tables.members) {
      assert.equal("pin_hash" in m, false);
      assert.equal("telegram_chat_id" in m, false);
      assert.equal(m.family_id, familyId);
    }
    assert.equal(backup.tables.push_subscriptions, undefined);
  });

  test("restore mengembalikan data yang dihapus/diubah tanpa menggandakan poin", () => {
    const backup = exportBackup();
    assert.equal(balance(), "10");

    db.admin(`
      delete from public.task_completions where instance_id = '${instanceId}';
      delete from public.point_ledger where member_id = '${childId}';
      update public.task_instances set status = 'open' where id = '${instanceId}';
      update public.members set display_name = 'Salah' where id = '${childId}';`);
    assert.equal(balance(), "0");

    const counts = JSON.parse(restore(backup));
    assert.equal(counts.task_completions, 1);
    assert.equal(balance(), "10");
    // PIN dan chat Telegram tidak ikut backup, jadi tetap seperti sebelumnya.
    assert.equal(
      db.admin(
        `select display_name || ' ' || (pin_hash is not null) || ' ' || telegram_chat_id
         from public.members where id = '${childId}';`,
      ),
      "Andi true 7",
    );
    assert.equal(
      db.as(
        father,
        `select count(*) from public.task_completions where instance_id = '${instanceId}';`,
      ),
      "1",
    );

    // Restore ulang tidak mengubah apa pun.
    restore(backup);
    assert.equal(balance(), "10");
  });

  test("anak tidak bisa membuat atau memulihkan backup", () => {
    const backup = exportBackup();
    assert.throws(() => exportBackup(child), /Hanya ayah dan ibu/);
    assert.throws(() => restore(backup, child), /Hanya ayah dan ibu/);
  });

  test("backup keluarga lain dan file asing ditolak", () => {
    const backup = exportBackup();
    assert.throws(() => restore(backup, outsider), /keluarga lain/);
    assert.throws(() => restore('{"app":"lain"}'), /bukan backup KITA/);
  });
});
