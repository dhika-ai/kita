import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000f1";
const child = "00000000-0000-0000-0000-0000000000f3";
const art = "00000000-0000-0000-0000-0000000000f4";

describe(
  "T-06 tugas ad-hoc dan kebiasaan pribadi",
  { skip: skipReason },
  () => {
    let db: ReturnType<typeof createTestDb>;
    let childId: string;
    let artId: string;
    let area: string;
    let cleaning: string;
    let habit: string;

    const join = (user: string, name: string, role: string) => {
      const id = db.as(
        father,
        `select public.add_member('${name}', '${role}');`,
      );
      const code = db.as(
        father,
        `select invite_code from public.members where id = '${id}';`,
      );
      db.as(user, `select public.join_family('${code}');`);
      return id;
    };

    const createTask = (user: string, args: string) =>
      db.as(user, `select public.create_task(${args});`);

    before(() => {
      db = createTestDb();
      db.admin(
        `insert into auth.users (id) values ('${father}'), ('${child}'), ('${art}');`,
      );
      db.as(father, "select public.create_family('Keluarga Budi', 'Budi');");
      childId = join(child, "Andi", "child");
      artId = join(art, "Tini", "art");
      area = db.as(
        father,
        "select id from public.areas where name_en = 'Bedroom';",
      );
      cleaning = db.as(
        father,
        "select id from public.categories where kind = 'cleaning';",
      );
      habit = db.as(
        father,
        "select id from public.categories where kind = 'personal_habit';",
      );
    });

    after(() => db?.drop());

    test("orang tua membuat tugas ad-hoc untuk anggota lain", () => {
      const templateId = createTask(
        father,
        `'Tidy toys', 'Rapikan mainan', '${cleaning}', '${area}', '${childId}', 5, due_date => '2026-11-02'`,
      );
      assert.equal(
        db.as(
          father,
          `select t.chore_type || '|' || i.due_date || '|' || i.status || '|' || (i.assigned_by_id = (private.my_member()).id)
         from public.task_instances i join public.task_templates t on t.id = i.template_id
         where t.id = '${templateId}';`,
        ),
        "adhoc|2026-11-02|open|true",
      );
    });

    test("anak membuat kebiasaan pribadi untuk dirinya sendiri, tanpa poin", () => {
      const templateId = createTask(
        child,
        `'', 'Baca buku 15 menit', '${habit}', '${area}', '${childId}', 50, 'daily'`,
      );
      assert.equal(
        db.as(
          child,
          `select title_en || '|' || points || '|' || recurrence from public.task_templates where id = '${templateId}';`,
        ),
        "Baca buku 15 menit|0|daily",
      );
    });

    test("anak tidak bisa membuat tugas rumah tangga", () => {
      assert.throws(
        () =>
          createTask(
            child,
            `'Mop', 'Pel', '${cleaning}', '${area}', '${childId}'`,
          ),
        /bukan tugas rumah tangga/,
      );
    });

    test("anak tidak bisa membuat tugas untuk orang lain", () => {
      assert.throws(
        () =>
          createTask(
            child,
            `'Read', 'Baca', '${habit}', '${area}', '${artId}'`,
          ),
        /untuk dirinya sendiri/,
      );
    });

    test("ART tidak bisa membuat tugas", () => {
      assert.throws(
        () =>
          createTask(art, `'Read', 'Baca', '${habit}', '${area}', '${artId}'`),
        /tidak bisa membuat tugas/,
      );
    });

    test("tugas tetap wajib memakai kategori dan area dari master data", () => {
      assert.throws(
        () =>
          createTask(
            father,
            `'X', 'X', '30000000-0000-0000-0000-000000000000', '${area}', '${childId}'`,
          ),
        /Kategori tidak ada|foreign key/,
      );
    });
  },
);
