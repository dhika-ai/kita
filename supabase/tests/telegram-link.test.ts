import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000a1";
const child = "00000000-0000-0000-0000-0000000000a3";
const outsider = "00000000-0000-0000-0000-0000000000a5";

describe("R-02 hubungkan Telegram", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let fatherId: string;
  let childId: string;

  // Bot memanggil fungsi ini sebagai service_role.
  const link = (code: string, chatId: number) =>
    db.admin(`begin; set local role service_role;
      select display_name || ',' || language from public.link_telegram('${code}', ${chatId});
      commit;`);
  const connected = (memberId: string) =>
    db.as(
      father,
      `select telegram_connected from public.members where id = '${memberId}';`,
    );

  before(() => {
    db = createTestDb();
    db.admin(
      `insert into auth.users (id) values ('${father}'), ('${child}'), ('${outsider}');`,
    );
    db.as(father, "select public.create_family('Keluarga Budi', 'Budi');");
    fatherId = db.as(father, "select (private.my_member()).id;");
    childId = db.as(father, "select public.add_member('Andi', 'child');");
    const invite = db.as(
      father,
      `select invite_code from public.members where id = '${childId}';`,
    );
    db.as(child, `select public.join_family('${invite}');`);
    db.as(outsider, "select public.create_family('Keluarga Lain', 'Joko');");
  });

  after(() => db?.drop());

  test("kode sekali pakai menyimpan chat_id tanpa nomor HP", () => {
    const code = db.as(
      father,
      `select public.create_telegram_link_code('${fatherId}', 'en');`,
    );
    assert.match(code, /^[0-9A-F]{8}$/);
    assert.equal(connected(fatherId), "f");
    assert.equal(link(code.toLowerCase(), 111), "Budi,en");
    assert.equal(connected(fatherId), "t");
    assert.equal(
      db.admin(
        `select telegram_chat_id from public.members where id = '${fatherId}';`,
      ),
      "111",
    );
    // Kode yang sama tidak bisa dipakai lagi.
    assert.equal(link(code, 222), "");
  });

  test("kode kedaluwarsa dan kode asal ditolak", () => {
    const code = db.as(
      child,
      `select public.create_telegram_link_code('${childId}', 'id');`,
    );
    db.admin(
      `update private.telegram_link_codes set expires_at = now() - interval '1 minute';`,
    );
    assert.equal(link(code, 333), "");
    assert.equal(link("NGAWUR00", 333), "");
    assert.equal(connected(childId), "f");
  });

  test("ayah/ibu boleh membuat kode untuk anggota keluarga, anak dan orang luar tidak", () => {
    assert.match(
      db.as(
        father,
        `select public.create_telegram_link_code('${childId}', 'id');`,
      ),
      /^[0-9A-F]{8}$/,
    );
    assert.throws(() =>
      db.as(
        child,
        `select public.create_telegram_link_code('${fatherId}', 'id');`,
      ),
    );
    assert.throws(() =>
      db.as(
        outsider,
        `select public.create_telegram_link_code('${childId}', 'id');`,
      ),
    );
  });

  test("aplikasi tidak bisa memanggil link_telegram atau membaca chat_id", () => {
    assert.throws(() =>
      db.as(father, "select * from public.link_telegram('ABCDEF12', 1);"),
    );
    assert.throws(() =>
      db.as(father, "select telegram_chat_id from public.members;"),
    );
  });
});
