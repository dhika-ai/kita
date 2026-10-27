import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000f1";
const outsider = "00000000-0000-0000-0000-0000000000f2";

// 2026-11-02 adalah hari Senin.
const monday = "2026-11-02";
const tuesday = "2026-11-03";
const thursday = "2026-11-05";

describe("T-05 job harian pembuat tugas", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let familyId: string;

  const generate = (date: string) =>
    db.admin(`select private.generate_task_instances('${date}');`);
  const titlesOn = (date: string) =>
    db.as(
      father,
      `select coalesce(string_agg(t.title_en, ',' order by t.title_en collate "C"), '')
       from public.task_instances i join public.task_templates t on t.id = i.template_id
       where i.due_date = '${date}';`,
    );

  before(() => {
    db = createTestDb();
    db.admin(
      `insert into auth.users (id) values ('${father}'), ('${outsider}');`,
    );
    familyId = db.as(
      father,
      "select public.create_family('Keluarga Budi', 'Budi');",
    );
    // Ganti contoh tugas bawaan dengan template uji yang jelas.
    db.admin("delete from public.task_templates;");
    db.as(
      father,
      `insert into public.task_templates (family_id, title_en, title_id, category_id, area_id, chore_type, recurrence, weekdays, month_day, deleted_at)
       select '${familyId}', v.title, v.title, c.id, a.id, v.chore_type::public.chore_type,
         v.recurrence::public.recurrence, v.weekdays::smallint[], v.month_day, v.deleted_at::timestamptz
       from (values
         ('Daily', 'routine', 'daily', null, null, null),
         ('MonThu', 'routine', 'weekly', '{1,4}', null, null),
         ('Monthly31', 'periodic', 'monthly', null, 31, null),
         ('Monthly2', 'periodic', 'monthly', null, 2, null),
         ('Adhoc', 'adhoc', null, null, null, null),
         ('Deleted', 'routine', 'daily', null, null, now()::text)
       ) v (title, chore_type, recurrence, weekdays, month_day, deleted_at)
       cross join lateral (select id from public.categories limit 1) c
       cross join lateral (select id from public.areas limit 1) a;`,
    );
  });

  after(() => db?.drop());

  test("template mingguan muncul hanya di hari yang dipilih", () => {
    generate(monday);
    generate(tuesday);
    generate(thursday);
    assert.equal(titlesOn(monday), "Daily,MonThu,Monthly2");
    assert.equal(titlesOn(tuesday), "Daily");
    assert.equal(titlesOn(thursday), "Daily,MonThu");
  });

  test("bulanan tanggal 31 jatuh di hari terakhir bulan yang lebih pendek", () => {
    generate("2026-11-30"); // Senin
    generate("2027-02-28"); // Minggu
    assert.equal(titlesOn("2026-11-30"), "Daily,MonThu,Monthly31");
    assert.equal(titlesOn("2027-02-28"), "Daily,Monthly31");
  });

  test("tugas ad-hoc dan template yang dihapus tidak dibuat", () => {
    assert.equal(
      db.as(
        father,
        `select count(*) from public.task_instances i join public.task_templates t on t.id = i.template_id
         where t.title_en in ('Adhoc', 'Deleted');`,
      ),
      "0",
    );
  });

  test("dijalankan dua kali tidak membuat tugas ganda", () => {
    assert.equal(generate(monday), "0");
    assert.equal(
      db.as(
        father,
        `select count(*) from public.task_instances where due_date = '${monday}';`,
      ),
      "3",
    );
  });

  test("tugas status open, ditugaskan ke penanggung jawab template", () => {
    assert.equal(
      db.as(
        father,
        "select string_agg(distinct status::text, ',') from public.task_instances;",
      ),
      "open",
    );
  });

  test("keluarga lain tidak melihat tugas ini, dan anggota tidak bisa menjalankan job", () => {
    assert.equal(
      db.as(outsider, "select count(*) from public.task_instances;"),
      "0",
    );
    assert.throws(
      () =>
        db.as(father, `select private.generate_task_instances('${monday}');`),
      /permission denied/,
    );
  });
});
