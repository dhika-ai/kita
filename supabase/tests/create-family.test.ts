import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000f1";

describe("F-05 registrasi keluarga", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;

  before(() => {
    db = createTestDb();
    db.admin(`insert into auth.users (id) values ('${father}');`);
  });

  after(() => db?.drop());

  test("pengunjung yang belum login tidak bisa membuat keluarga", () => {
    assert.throws(
      () => db.anon("select public.create_family('Keluarga X', 'Ayah X');"),
      /permission denied/,
    );
  });

  test("nama kosong ditolak", () => {
    assert.throws(
      () => db.as(father, "select public.create_family(' ', 'Budi');"),
      /wajib diisi/,
    );
  });

  test("ayah membuat keluarga dan langsung menjadi anggota berperan father", () => {
    db.as(father, "select public.create_family(' Keluarga Budi ', 'Budi');");
    assert.equal(
      db.as(father, "select name from public.families;"),
      "Keluarga Budi",
    );
    assert.equal(
      db.as(father, "select display_name || '|' || role from public.members;"),
      "Budi|father",
    );
  });

  test("satu akun tidak bisa membuat keluarga kedua", () => {
    assert.throws(
      () => db.as(father, "select public.create_family('Lagi', 'Budi');"),
      /sudah terdaftar/,
    );
  });
});
