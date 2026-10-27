import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000f1";

describe("T-02 data awal master data", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;

  before(() => {
    db = createTestDb();
    db.admin(`insert into auth.users (id) values ('${father}');`);
    db.as(father, "select public.create_family('Keluarga Budi', 'Budi');");
  });

  after(() => db?.drop());

  test("keluarga baru langsung punya area, kategori, dan contoh tugas", () => {
    assert.equal(db.as(father, "select count(*) from public.areas;"), "8");
    assert.equal(db.as(father, "select count(*) from public.categories;"), "6");
    assert.equal(
      db.as(father, "select count(*) from public.task_templates;"),
      "15",
    );
  });

  test("ada tugas rutin, periodik, dan ad-hoc", () => {
    assert.equal(
      db.as(
        father,
        "select string_agg(distinct chore_type::text, ',') from public.task_templates;",
      ),
      "adhoc,periodic,routine",
    );
  });

  test("semua nama tersedia dalam bahasa Inggris dan Indonesia", () => {
    assert.equal(
      db.as(
        father,
        `select count(*) from (
           select name_en, name_id from public.areas
           union all select name_en, name_id from public.categories
           union all select title_en, title_id from public.task_templates
         ) t where name_en = name_id or trim(name_id) = '';`,
      ),
      "0",
    );
  });

  test("anggota tidak bisa memanggil fungsi seed langsung", () => {
    assert.throws(
      () =>
        db.as(
          father,
          "select private.seed_family((private.my_member()).family_id);",
        ),
      /permission denied/,
    );
  });
});
