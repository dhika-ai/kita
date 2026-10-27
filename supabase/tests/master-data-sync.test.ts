import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000f1";

describe("T-03 master data lewat sync", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let familyId: string;

  before(() => {
    db = createTestDb();
    db.admin(`insert into auth.users (id) values ('${father}');`);
    familyId = db.as(
      father,
      "select public.create_family('Keluarga Budi', 'Budi');",
    );
  });

  after(() => db?.drop());

  test("updated_at diisi server walau perangkat mengirim waktu lama", () => {
    const id = "20000000-0000-0000-0000-000000000001";
    db.as(
      father,
      `insert into public.areas (id, family_id, name_en, name_id, updated_at)
       values ('${id}', '${familyId}', 'Attic', 'Loteng', '2000-01-01')
       on conflict (id) do update set name_en = excluded.name_en;`,
    );
    assert.equal(
      db.as(
        father,
        `select updated_at > now() - interval '1 minute' from public.areas where id = '${id}';`,
      ),
      "t",
    );
  });

  test("upsert yang sama dua kali tidak membuat baris ganda", () => {
    const upsert = `insert into public.categories (id, family_id, name_en, name_id, kind)
      values ('20000000-0000-0000-0000-000000000002', '${familyId}', 'Garden', 'Kebun', 'maintenance')
      on conflict (id) do update set name_en = excluded.name_en, name_id = excluded.name_id;`;
    db.as(father, upsert);
    db.as(father, upsert);
    assert.equal(
      db.as(
        father,
        "select count(*) from public.categories where name_en = 'Garden';",
      ),
      "1",
    );
  });
});
