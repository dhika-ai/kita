import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000f1";
const mother = "00000000-0000-0000-0000-0000000000f2";
const child = "00000000-0000-0000-0000-0000000000f3";
const outsider = "00000000-0000-0000-0000-0000000000f4";

describe("F-06 undang anggota dan atur peran", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let motherId: string;

  const inviteCode = (name: string) =>
    db.as(
      father,
      `select invite_code from public.members where display_name = '${name}';`,
    );

  before(() => {
    db = createTestDb();
    db.admin(
      `insert into auth.users (id) values ('${father}'), ('${mother}'), ('${child}'), ('${outsider}');`,
    );
    db.as(father, "select public.create_family('Keluarga Budi', 'Budi');");
  });

  after(() => db?.drop());

  test("ayah menambah anggota dan peran tersimpan", () => {
    motherId = db.as(father, "select public.add_member('Sari', 'mother');");
    db.as(father, "select public.add_member('Andi', 'child');");
    assert.equal(
      db.as(
        father,
        "select string_agg(display_name || ':' || role, ',' order by display_name) from public.members;",
      ),
      "Andi:child,Budi:father,Sari:mother",
    );
    assert.match(inviteCode("Sari"), /^[0-9a-f]{12}$/);
  });

  test("anggota bergabung lewat kode undangan, lalu kodenya hangus", () => {
    const code = inviteCode("Sari");
    db.as(mother, `select public.join_family('${code}');`);
    assert.equal(
      db.as(mother, "select (private.my_member()).display_name;"),
      "Sari",
    );
    assert.equal(inviteCode("Sari"), "");
    assert.throws(
      () => db.as(outsider, `select public.join_family('${code}');`),
      /tidak berlaku/,
    );
  });

  test("ibu juga bisa mengatur peran, tapi tidak perannya sendiri", () => {
    const artId = db.as(
      mother,
      "select public.add_member('Mbak Tini', 'child');",
    );
    db.as(mother, `select public.set_member_role('${artId}', 'art');`);
    assert.equal(
      db.as(mother, `select role from public.members where id = '${artId}';`),
      "art",
    );
    assert.throws(
      () =>
        db.as(mother, `select public.set_member_role('${motherId}', 'child');`),
      /peran sendiri/,
    );
  });

  test("anak tidak bisa menambah anggota atau mengatur peran", () => {
    db.as(child, `select public.join_family('${inviteCode("Andi")}');`);
    assert.throws(
      () => db.as(child, "select public.add_member('Teman', 'child');"),
      /Hanya ayah atau ibu/,
    );
    assert.throws(
      () =>
        db.as(child, `select public.set_member_role('${motherId}', 'child');`),
      /Hanya ayah atau ibu/,
    );
  });

  test("orang luar tidak bisa mengubah anggota keluarga lain", () => {
    db.as(outsider, "select public.create_family('Keluarga Lain', 'Joko');");
    assert.throws(
      () =>
        db.as(
          outsider,
          `select public.set_member_role('${motherId}', 'child');`,
        ),
      /tidak ditemukan/,
    );
  });

  test("anggota ke-6 ditolak", () => {
    db.as(father, "select public.add_member('Anak Kedua', 'child');");
    assert.throws(
      () => db.as(father, "select public.add_member('Anak Ketiga', 'child');"),
      /maksimal 5/,
    );
  });
});
