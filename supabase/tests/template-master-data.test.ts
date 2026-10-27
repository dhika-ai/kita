import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000f1";

describe(
  "T-04 template task wajib memakai master data aktif",
  { skip: skipReason },
  () => {
    let db: ReturnType<typeof createTestDb>;
    let familyId: string;
    let areaId: string;
    let categoryId: string;

    const insert = (category: string, area: string) =>
      db.as(
        father,
        `insert into public.task_templates (family_id, title_en, title_id, category_id, area_id, chore_type)
       values ('${familyId}', 'Test', 'Uji', '${category}', '${area}', 'adhoc') returning id;`,
      );

    before(() => {
      db = createTestDb();
      db.admin(`insert into auth.users (id) values ('${father}');`);
      familyId = db.as(
        father,
        "select public.create_family('Keluarga Budi', 'Budi');",
      );
      areaId = db.as(
        father,
        "select id from public.areas where name_en = 'Kitchen';",
      );
      categoryId = db.as(
        father,
        "select id from public.categories where name_en = 'Cleaning';",
      );
    });

    after(() => db?.drop());

    test("kategori dan area aktif diterima", () => {
      assert.match(insert(categoryId, areaId), /^[0-9a-f-]{36}$/);
    });

    test("kategori yang sudah dihapus ditolak", () => {
      const deleted = db.as(
        father,
        `insert into public.categories (family_id, name_en, name_id, kind)
       values ('${familyId}', 'Old', 'Lama', 'cleaning') returning id;`,
      );
      db.as(
        father,
        `update public.categories set deleted_at = now() where id = '${deleted}';`,
      );
      assert.throws(() => insert(deleted, areaId), /Kategori tidak ada/);
    });

    test("area yang sudah dihapus ditolak", () => {
      const deleted = db.as(
        father,
        `insert into public.areas (family_id, name_en, name_id)
       values ('${familyId}', 'Old', 'Lama') returning id;`,
      );
      db.as(
        father,
        `update public.areas set deleted_at = now() where id = '${deleted}';`,
      );
      assert.throws(() => insert(categoryId, deleted), /Area tidak ada/);
    });

    test("kategori atau area yang tidak ada ditolak", () => {
      assert.throws(
        () => insert("30000000-0000-0000-0000-000000000000", areaId),
        /Kategori tidak ada|foreign key/,
      );
    });
  },
);
