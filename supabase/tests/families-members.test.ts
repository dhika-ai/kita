import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const userA = "00000000-0000-0000-0000-00000000000a";
const userB = "00000000-0000-0000-0000-00000000000b";
const userNoFamily = "00000000-0000-0000-0000-0000000000cc";
const familyA = "10000000-0000-0000-0000-00000000000a";
const familyB = "10000000-0000-0000-0000-00000000000b";

describe("F-04 keluarga dan anggota", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;

  before(() => {
    db = createTestDb();
    db.admin(`
      insert into auth.users (id) values ('${userA}'), ('${userB}'), ('${userNoFamily}');
      insert into public.families (id, name) values ('${familyA}', 'Keluarga A'), ('${familyB}', 'Keluarga B');
      insert into public.members (family_id, auth_user_id, display_name, role) values
        ('${familyA}', '${userA}', 'Ayah A', 'father'),
        ('${familyA}', null, 'Anak A', 'child'),
        ('${familyB}', '${userB}', 'Ayah B', 'father'),
        ('${familyB}', null, 'Ibu B', 'mother'),
        ('${familyB}', null, 'ART B', 'art');
    `);
  });

  after(() => db?.drop());

  test("anggota keluarga A hanya melihat keluarga A", () => {
    assert.equal(
      db.as(userA, "select name from public.families;"),
      "Keluarga A",
    );
    assert.equal(
      db.as(
        userA,
        `select count(*) from public.families where id = '${familyB}';`,
      ),
      "0",
    );
  });

  test("anggota keluarga A tidak bisa membaca anggota keluarga B", () => {
    assert.equal(
      db.as(
        userA,
        "select display_name from public.members order by display_name;",
      ),
      "Anak A\nAyah A",
    );
    assert.equal(
      db.as(
        userA,
        `select count(*) from public.members where family_id = '${familyB}';`,
      ),
      "0",
    );
  });

  test("my_member() mengembalikan anggota milik pengguna yang login", () => {
    assert.equal(
      db.as(userB, "select (public.my_member()).display_name;"),
      "Ayah B",
    );
    assert.equal(
      db.as(userNoFamily, "select (public.my_member()).id is null;"),
      "t",
    );
  });

  test("pengguna tanpa keluarga tidak melihat data apa pun", () => {
    assert.equal(
      db.as(userNoFamily, "select count(*) from public.families;"),
      "0",
    );
    assert.equal(
      db.as(userNoFamily, "select count(*) from public.members;"),
      "0",
    );
  });

  test("pengunjung yang belum login ditolak", () => {
    assert.throws(
      () => db.anon("select * from public.families;"),
      /permission denied/,
    );
    assert.throws(
      () => db.anon("select * from public.members;"),
      /permission denied/,
    );
  });

  test("anggota tidak bisa mengubah data langsung", () => {
    assert.throws(
      () =>
        db.as(
          userA,
          `update public.families set name = 'X' where id = '${familyA}';`,
        ),
      /permission denied/,
    );
    assert.throws(
      () =>
        db.as(
          userA,
          `insert into public.members (family_id, display_name, role) values ('${familyB}', 'Penyusup', 'child');`,
        ),
      /permission denied/,
    );
  });

  test("anggota aktif maksimal 5 per keluarga", () => {
    db.admin(`
      insert into public.members (family_id, display_name, role) values
        ('${familyB}', 'Anak B1', 'child'),
        ('${familyB}', 'Anak B2', 'child');
    `);
    assert.throws(
      () =>
        db.admin(
          `insert into public.members (family_id, display_name, role) values ('${familyB}', 'Anak B3', 'child');`,
        ),
      /maksimal 5/,
    );
  });

  test("anggota yang dihapus tidak dihitung", () => {
    db.admin(
      `update public.members set deleted_at = now() where display_name = 'Anak B2';`,
    );
    db.admin(
      `insert into public.members (family_id, display_name, role) values ('${familyB}', 'Anak B3', 'child');`,
    );
    assert.equal(
      db.admin(
        `select count(*) from public.members where family_id = '${familyB}' and deleted_at is null;`,
      ),
      "5",
    );
  });
});
