import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000f1";
const outsider = "00000000-0000-0000-0000-0000000000f4";

describe("F-07 login PIN anak dan ART", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let childId: string;
  let motherId: string;

  const verify = (pin: string) =>
    db.as(father, `select public.verify_member_pin('${childId}', '${pin}');`);

  before(() => {
    db = createTestDb();
    db.admin(
      `insert into auth.users (id) values ('${father}'), ('${outsider}');`,
    );
    db.as(father, "select public.create_family('Keluarga Budi', 'Budi');");
    childId = db.as(father, "select public.add_member('Andi', 'child');");
    motherId = db.as(father, "select public.add_member('Sari', 'mother');");
    db.as(outsider, "select public.create_family('Keluarga Lain', 'Joko');");
  });

  after(() => db?.drop());

  test("PIN harus 4-6 angka dan hanya untuk anak atau ART", () => {
    assert.throws(
      () =>
        db.as(father, `select public.set_member_pin('${childId}', '12a4');`),
      /4 sampai 6 angka/,
    );
    assert.throws(
      () =>
        db.as(father, `select public.set_member_pin('${motherId}', '1234');`),
      /hanya untuk anak dan ART/,
    );
  });

  test("PIN tersimpan sebagai hash, bukan teks asli", () => {
    db.as(father, `select public.set_member_pin('${childId}', '1234');`);
    assert.equal(
      db.as(
        father,
        `select has_pin from public.members where id = '${childId}';`,
      ),
      "t",
    );
    assert.match(
      db.admin(`select pin_hash from public.members where id = '${childId}';`),
      /^\$2a\$/,
    );
  });

  test("PIN benar masuk", () => {
    assert.equal(verify("1234"), "t");
  });

  test("keluarga lain tidak bisa mencoba PIN anak ini", () => {
    assert.throws(
      () =>
        db.as(
          outsider,
          `select public.verify_member_pin('${childId}', '1234');`,
        ),
      /tidak ditemukan/,
    );
  });

  test("5 kali salah terkunci, PIN benar pun ditolak sampai PIN baru dibuat", () => {
    for (let i = 0; i < 4; i++) assert.equal(verify("0000"), "f");
    assert.equal(
      db.as(
        father,
        `select pin_locked from public.members where id = '${childId}';`,
      ),
      "f",
    );
    assert.equal(verify("0000"), "f");
    assert.equal(
      db.as(
        father,
        `select pin_locked from public.members where id = '${childId}';`,
      ),
      "t",
    );
    assert.throws(() => verify("1234"), /terkunci/);

    db.as(father, `select public.set_member_pin('${childId}', '5678');`);
    assert.equal(verify("5678"), "t");
  });

  test("PIN benar mengulang hitungan salah dari nol", () => {
    for (let i = 0; i < 4; i++) verify("0000");
    assert.equal(verify("5678"), "t");
    for (let i = 0; i < 4; i++) verify("0000");
    assert.equal(
      db.as(
        father,
        `select pin_locked from public.members where id = '${childId}';`,
      ),
      "f",
    );
  });
});
