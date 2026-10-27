import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000a1";
const child = "00000000-0000-0000-0000-0000000000a3";
const outsider = "00000000-0000-0000-0000-0000000000a5";

describe("P-01 langganan push notification", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let fatherId: string;
  let childId: string;
  let outsiderId: string;

  const subscribe = (user: string, endpoint: string, ids: string[]) =>
    db.as(
      user,
      `select public.set_push_subscription('${endpoint}', 'key', 'secret',
        array[${ids.map((id) => `'${id}'`).join(",")}]::uuid[], 'en');`,
    );
  const members = (user: string, endpoint: string) =>
    db
      .as(user, `select * from public.push_members('${endpoint}') order by 1;`)
      .split("\n")
      .filter(Boolean);

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
    outsiderId = db.as(outsider, "select (private.my_member()).id;");
  });

  after(() => db?.drop());

  test("HP ayah menerima pengingat ayah dan si kecil", () => {
    subscribe(father, "https://push/hp-ayah", [fatherId, childId]);
    assert.deepEqual(
      members(father, "https://push/hp-ayah"),
      [fatherId, childId].sort(),
    );
    assert.equal(
      db.admin(`select language from public.members where id = '${childId}';`),
      "en",
    );
  });

  test("menyimpan ulang mengganti pilihan anggota di HP itu", () => {
    subscribe(father, "https://push/hp-ayah", [childId]);
    assert.deepEqual(members(father, "https://push/hp-ayah"), [childId]);
  });

  test("anak hanya bisa berlangganan untuk dirinya sendiri", () => {
    subscribe(child, "https://push/hp-andi", [childId]);
    assert.deepEqual(members(child, "https://push/hp-andi"), [childId]);
    assert.throws(() => subscribe(child, "https://push/hp-andi", [fatherId]));
  });

  test("orang luar tidak bisa berlangganan atau melihat anggota keluarga lain", () => {
    assert.throws(() => subscribe(outsider, "https://push/hp-joko", [childId]));
    assert.deepEqual(members(outsider, "https://push/hp-ayah"), []);
    subscribe(outsider, "https://push/hp-joko", [outsiderId]);
    assert.deepEqual(members(outsider, "https://push/hp-joko"), [outsiderId]);
  });

  test("tabel langganan tidak bisa dibaca langsung dari aplikasi", () => {
    assert.throws(() =>
      db.as(father, "select count(*) from public.push_subscriptions;"),
    );
  });
});
