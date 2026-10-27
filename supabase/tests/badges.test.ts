import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000c1";
const child = "00000000-0000-0000-0000-0000000000c3";

describe("G-03 lencana", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let familyId: string;
  let childId: string;
  let templateId: string;

  // Tugas Andi pada tanggal tertentu, langsung dengan statusnya.
  const task = (date: string, status: string, template = templateId) =>
    db.admin(
      `insert into public.task_instances (family_id, template_id, assignee_id, due_date, status)
       values ('${familyId}', '${template}', '${childId}', '${date}', '${status}');`,
    );
  const award = (date: string) =>
    db.admin(`select private.award_badges('${date}');`);
  const badges = () =>
    db.as(
      child,
      "select coalesce(string_agg(kind || ':' || earned_on, ',' order by kind, earned_on), '') from public.badges;",
    );

  before(() => {
    db = createTestDb();
    db.admin(`insert into auth.users (id) values ('${father}'), ('${child}');`);
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
    templateId = db.as(
      father,
      `select public.create_task('Task', 'Tugas', (select id from public.categories where kind = 'cleaning'),
        (select id from public.areas order by name_id limit 1), '${childId}', 1, due_date => '2026-09-01');`,
    );
  });

  after(() => db?.drop());

  test("streak 7 hari hanya kalau 7 hari berturut-turut semua tugas selesai", () => {
    for (let d = 2; d <= 7; d++) task(`2026-09-0${d}`, "approved");
    // 1 Sep sudah ada dari create_task (status open), jadi 1–7 Sep belum streak.
    award("2026-09-07");
    assert.equal(badges(), "");
    task("2026-09-08", "done");
    award("2026-09-08");
    assert.equal(badges(), "streak_7:2026-09-08");
  });

  test("lencana tidak dobel saat diperiksa lagi", () => {
    task("2026-09-09", "approved");
    assert.equal(award("2026-09-09"), "0");
    assert.equal(badges(), "streak_7:2026-09-08");
  });

  test("spesialis area setelah 20 tugas selesai di satu area", () => {
    // Sudah 8 tugas selesai (2–9 Sep). Tambah 11 jadi 19: belum.
    for (let d = 10; d <= 20; d++) task(`2026-09-${d}`, "approved");
    award("2026-09-20");
    assert.doesNotMatch(badges(), /area_specialist/);
    task("2026-09-21", "approved");
    award("2026-09-21");
    award("2026-09-22");
    assert.equal(
      db.as(
        child,
        "select count(*) from public.badges where kind = 'area_specialist' and area_id is not null;",
      ),
      "1",
    );
  });

  test("anggota tidak bisa menulis lencana sendiri", () => {
    assert.throws(() =>
      db.as(
        child,
        `insert into public.badges (family_id, member_id, kind, earned_on)
         values ('${familyId}', '${childId}', 'streak_7', '2026-10-01');`,
      ),
    );
  });
});
