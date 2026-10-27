import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000b1";
const child = "00000000-0000-0000-0000-0000000000b3";
const outsider = "00000000-0000-0000-0000-0000000000b5";

describe("G-02 target poin", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let familyId: string;
  let childId: string;

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
  });

  after(() => db?.drop());

  test("orang tua memasang dan mengubah target, keluarga bisa melihat", () => {
    db.as(
      father,
      `insert into public.point_targets (family_id, member_id, daily, weekly)
       values ('${familyId}', '${childId}', 10, 50)
       on conflict (family_id, member_id) do update set daily = excluded.daily, weekly = excluded.weekly;`,
    );
    db.as(
      father,
      `insert into public.point_targets (family_id, member_id, daily, weekly, monthly)
       values ('${familyId}', '${childId}', 15, 60, 200)
       on conflict (family_id, member_id) do update
       set daily = excluded.daily, weekly = excluded.weekly, monthly = excluded.monthly;`,
    );
    assert.equal(
      db.as(
        child,
        "select daily || '/' || weekly || '/' || monthly from public.point_targets;",
      ),
      "15/60/200",
    );
    assert.equal(
      db.as(outsider, "select count(*) from public.point_targets;"),
      "0",
    );
  });

  test("anak tidak bisa memasang target sendiri", () => {
    assert.throws(() =>
      db.as(
        child,
        `insert into public.point_targets (family_id, member_id, daily)
         values ('${familyId}', '${childId}', 1);`,
      ),
    );
    db.as(child, "update public.point_targets set daily = 1;");
    assert.equal(
      db.as(father, "select daily from public.point_targets;"),
      "15",
    );
  });

  test("target harus lebih dari 0", () => {
    assert.throws(() =>
      db.as(
        father,
        `update public.point_targets set daily = 0 where member_id = '${childId}';`,
      ),
    );
  });
});
