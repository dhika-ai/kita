import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000e1";
const mother = "00000000-0000-0000-0000-0000000000e2";
const child = "00000000-0000-0000-0000-0000000000e3";
const art = "00000000-0000-0000-0000-0000000000e4";
const outsider = "00000000-0000-0000-0000-0000000000e5";

describe("M-08 Moment of the Week & Month", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let familyId: string;
  let childId: string;
  let first: string;
  let second: string;
  let foreign: string;

  const join = (user: string, name: string, role: string) => {
    const id = db.as(father, `select public.add_member('${name}', '${role}');`);
    const code = db.as(
      father,
      `select invite_code from public.members where id = '${id}';`,
    );
    db.as(user, `select public.join_family('${code}');`);
    return id;
  };
  const pick = (user: string, momentId: string, family = familyId) =>
    db.as(
      user,
      `insert into public.moment_picks (id, family_id, period, period_start, moment_id)
       values ('${family}:week:2026-10-26', '${family}', 'week', '2026-10-26', '${momentId}')
       on conflict (id) do update set moment_id = excluded.moment_id
       returning moment_id;`,
    );

  before(() => {
    db = createTestDb();
    db.admin(
      `insert into auth.users (id) values ('${father}'), ('${mother}'), ('${child}'), ('${art}'), ('${outsider}');`,
    );
    db.as(father, "select public.create_family('Keluarga Budi', 'Budi');");
    familyId = db.as(father, "select (private.my_member()).family_id;");
    join(mother, "Ani", "mother");
    childId = join(child, "Andi", "child");
    join(art, "Sari", "art");
    const add = (journal: string) =>
      db.as(
        child,
        `insert into public.moments (family_id, member_id, journal)
         values ('${familyId}', '${childId}', '${journal}') returning id;`,
      );
    first = add("Main bola");
    second = add("Juara kelas");
    db.as(outsider, "select public.create_family('Keluarga Lain', 'Joko');");
    const otherFamily = db.as(
      outsider,
      "select (private.my_member()).family_id;",
    );
    const otherMember = db.as(outsider, "select (private.my_member()).id;");
    foreign = db.as(
      outsider,
      `insert into public.moments (family_id, member_id, journal)
       values ('${otherFamily}', '${otherMember}', 'Liburan') returning id;`,
    );
  });

  after(() => db?.drop());

  test("ayah memilih, lalu ibu mengganti pilihan minggu yang sama", () => {
    assert.equal(pick(father, first), first);
    assert.equal(pick(mother, second), second);
    assert.equal(
      db.as(child, "select moment_id from public.moment_picks;"),
      second,
    );
  });

  test("anak dan ART tidak bisa memilih, ART juga tidak melihat pilihan", () => {
    assert.throws(() => pick(child, first));
    assert.throws(() => pick(art, first));
    assert.equal(db.as(art, "select count(*) from public.moment_picks;"), "0");
  });

  test("moment keluarga lain tidak bisa dipilih", () => {
    assert.throws(() => pick(father, foreign));
    assert.equal(
      db.as(outsider, "select count(*) from public.moment_picks;"),
      "0",
    );
  });

  test("id harus sesuai keluarga, periode, dan tanggal mulai", () => {
    assert.throws(() =>
      db.as(
        father,
        `insert into public.moment_picks (id, family_id, period, period_start, moment_id)
         values ('salah', '${familyId}', 'month', '2026-10-01', '${first}');`,
      ),
    );
  });
});
