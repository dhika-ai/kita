import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000f1";
const mother = "00000000-0000-0000-0000-0000000000f2";
const child = "00000000-0000-0000-0000-0000000000f3";
const art = "00000000-0000-0000-0000-0000000000f4";
const outsider = "00000000-0000-0000-0000-0000000000f5";

describe("T-01 tabel master data", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let familyId: string;
  let areaId: string;
  let categoryId: string;
  let otherAreaId: string;

  const join = (user: string, name: string, role: string) => {
    const id = db.as(father, `select public.add_member('${name}', '${role}');`);
    const code = db.as(
      father,
      `select invite_code from public.members where id = '${id}';`,
    );
    db.as(user, `select public.join_family('${code}');`);
  };

  before(() => {
    db = createTestDb();
    db.admin(
      `insert into auth.users (id) values ('${father}'), ('${mother}'), ('${child}'), ('${art}'), ('${outsider}');`,
    );
    familyId = db.as(
      father,
      "select public.create_family('Keluarga Budi', 'Budi');",
    );
    join(mother, "Sari", "mother");
    join(child, "Andi", "child");
    join(art, "Tini", "art");
    db.as(outsider, "select public.create_family('Keluarga Lain', 'Joko');");
    otherAreaId = db.as(
      outsider,
      "insert into public.areas (family_id, name_en, name_id) select family_id, 'Garage', 'Garasi' from public.members returning id;",
    );
  });

  after(() => db?.drop());

  test("ayah dan ibu bisa menambah dan mengubah master data", () => {
    areaId = db.as(
      father,
      `insert into public.areas (family_id, name_en, name_id) values ('${familyId}', 'Kitchen', 'Dapur') returning id;`,
    );
    categoryId = db.as(
      mother,
      `insert into public.categories (family_id, name_en, name_id, kind) values ('${familyId}', 'Cleaning', 'Bersih-bersih', 'cleaning') returning id;`,
    );
    db.as(
      mother,
      `update public.areas set icon = 'kitchen' where id = '${areaId}';`,
    );
    db.as(
      father,
      `insert into public.sops (family_id, title_en, title_id, steps) values ('${familyId}', 'Wash dishes', 'Cuci piring', '[{"en":"Rinse","id":"Bilas"}]');`,
    );
    db.as(
      father,
      `insert into public.task_templates (family_id, title_en, title_id, category_id, area_id, chore_type, recurrence, weekdays, points)
       values ('${familyId}', 'Mop', 'Pel lantai', '${categoryId}', '${areaId}', 'routine', 'weekly', '{1,4}', 10);`,
    );
    db.as(
      mother,
      `insert into public.inventory_items (family_id, name, area_id, unit, qty_on_hand, min_qty)
       values ('${familyId}', 'Sabun cuci piring', '${areaId}', 'botol', 2, 1);`,
    );
    assert.equal(
      db.as(child, `select icon from public.areas where id = '${areaId}';`),
      "kitchen",
      "anak tetap bisa membaca",
    );
  });

  for (const [who, user] of [
    ["anak", child],
    ["ART", art],
  ] as const) {
    test(`${who} ditolak saat mengubah master data`, () => {
      for (const table of [
        "areas",
        "categories",
        "sops",
        "task_templates",
        "inventory_items",
      ]) {
        assert.throws(
          () =>
            db.as(
              user,
              table === "task_templates"
                ? // Data lengkap dan valid, supaya yang menolak memang RLS.
                  `insert into public.task_templates (family_id, title_en, title_id, category_id, area_id, chore_type)
                   values ('${familyId}', 'X', 'X', '${categoryId}', '${areaId}', 'adhoc');`
                : `insert into public.${table} (family_id) values ('${familyId}');`,
            ),
          /row-level security/,
          `${who} menambah ${table}`,
        );
      }
      // Update yang tidak lolos RLS tidak mengubah baris apa pun.
      db.as(
        user,
        `update public.areas set name_id = 'Diubah' where id = '${areaId}';`,
      );
      assert.equal(
        db.as(
          father,
          `select name_id from public.areas where id = '${areaId}';`,
        ),
        "Dapur",
      );
    });
  }

  test("keluarga lain tidak melihat dan tidak bisa mengubah master data ini", () => {
    assert.equal(
      db.as(
        outsider,
        `select count(*) from public.areas where family_id = '${familyId}';`,
      ),
      "0",
    );
    db.as(
      outsider,
      `update public.areas set name_id = 'Diubah' where id = '${areaId}';`,
    );
    assert.equal(
      db.as(father, `select name_id from public.areas where id = '${areaId}';`),
      "Dapur",
    );
    assert.throws(
      () =>
        db.as(
          outsider,
          `insert into public.areas (family_id, name_en, name_id) values ('${familyId}', 'X', 'X');`,
        ),
      /row-level security/,
    );
  });

  test("template task hanya bisa memakai area dan kategori milik keluarganya", () => {
    assert.throws(
      () =>
        db.as(
          father,
          `insert into public.task_templates (family_id, title_en, title_id, category_id, area_id, chore_type)
           values ('${familyId}', 'X', 'X', '${categoryId}', '${otherAreaId}', 'adhoc');`,
        ),
      /foreign key|Area tidak ada/,
    );
    assert.throws(
      () =>
        db.as(
          father,
          `insert into public.task_templates (family_id, title_en, title_id, area_id, chore_type)
           values ('${familyId}', 'X', 'X', '${areaId}', 'adhoc');`,
        ),
      /null value in column "category_id"|Kategori tidak ada/,
    );
  });

  test("jadwal mingguan wajib punya hari, bulanan wajib punya tanggal", () => {
    for (const schedule of [
      "'weekly', null, null",
      "'weekly', '{}', null",
      "'monthly', null, null",
    ]) {
      assert.throws(
        () =>
          db.as(
            father,
            `insert into public.task_templates (family_id, title_en, title_id, category_id, area_id, chore_type, recurrence, weekdays, month_day)
             values ('${familyId}', 'X', 'X', '${categoryId}', '${areaId}', 'routine', ${schedule});`,
          ),
        /check constraint/,
      );
    }
  });
});
