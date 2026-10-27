import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000f1";
const child = "00000000-0000-0000-0000-0000000000f3";
const outsider = "00000000-0000-0000-0000-0000000000f5";

describe("T-11 view dashboard", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let childId: string;
  const day = "2026-10-20";

  before(() => {
    db = createTestDb();
    db.admin(
      `insert into auth.users (id) values ('${father}'), ('${child}'), ('${outsider}');`,
    );
    db.as(father, "select public.create_family('Keluarga Budi', 'Budi');");
    childId = db.as(father, "select public.add_member('Andi', 'child');");
    const code = db.as(
      father,
      `select invite_code from public.members where id = '${childId}';`,
    );
    db.as(child, `select public.join_family('${code}');`);
    db.as(outsider, "select public.create_family('Keluarga Lain', 'Joko');");

    // Enam tugas Andi di satu tanggal (poin dari template seed yang berbeda-beda),
    // dengan status campuran. Satu disetujui tetapi poinnya baru berlaku jauh nanti.
    db.admin(`
      with picked as (
        select t.id, row_number() over (order by t.title_en) as n
        from public.task_templates t
        join public.members m on m.family_id = t.family_id and m.id = '${childId}'
        where t.recurrence is not null
        limit 6
      )
      insert into public.task_instances (family_id, template_id, assignee_id, due_date, status, counts_on)
      select m.family_id, p.id, m.id, '${day}',
        (array['approved', 'approved', 'approved', 'done', 'missed', 'open'])[p.n]::public.task_status,
        case p.n when 1 then date '${day}' + 1 when 2 then date '${day}' + 1 when 3 then date '2999-01-01' end
      from picked p join public.members m on m.id = '${childId}';`);
  });

  after(() => db?.drop());

  test("angka view sama dengan hitungan manual dari tabel tugas (DoD 2)", () => {
    const manual = db.admin(`
      select count(*) || ',' ||
        count(*) filter (where i.status = 'approved') || ',' ||
        count(*) filter (where i.status = 'done') || ',' ||
        count(*) filter (where i.status = 'missed' or i.status = 'open') || ',' ||
        round(100.0 * count(*) filter (where i.status = 'approved') / count(*)) || ',' ||
        coalesce(sum(t.points) filter (where i.status in ('approved', 'done')), 0)
      from public.task_instances i join public.task_templates t on t.id = i.template_id
      where i.assignee_id = '${childId}' and i.due_date = '${day}';`);
    assert.match(manual, /^6,3,1,2,50,\d+$/);
    assert.equal(
      db.as(
        father,
        `select total || ',' || approved || ',' || waiting || ',' || late || ',' || completion_pct || ',' || points
         from public.dashboard_daily where member_id = '${childId}' and due_date = '${day}';`,
      ),
      manual,
    );
  });

  // G-01: poin langsung masuk saat dicentang (bukan lagi H+1 setelah disetujui).
  test("poin dari tugas selesai dan disetujui, tanpa menunggu H+1", () => {
    const expected = db.admin(`
      select sum(t.points) from public.task_instances i join public.task_templates t on t.id = i.template_id
      where i.assignee_id = '${childId}' and i.status in ('approved', 'done');`);
    assert.equal(
      db.as(
        child,
        `select points from public.dashboard_daily where member_id = '${childId}' and due_date = '${day}';`,
      ),
      expected,
    );
  });

  test("keluarga lain tidak melihat angka dashboard ini", () => {
    assert.equal(
      db.as(outsider, "select count(*) from public.dashboard_daily;"),
      "0",
    );
  });
});
