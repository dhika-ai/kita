import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000d1";
const child = "00000000-0000-0000-0000-0000000000d3";
const art = "00000000-0000-0000-0000-0000000000d4";
const outsider = "00000000-0000-0000-0000-0000000000d5";

describe("M-05 tabel moments dan foto", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let familyId: string;
  let childId: string;
  let artId: string;

  const join = (user: string, name: string, role: string) => {
    const id = db.as(father, `select public.add_member('${name}', '${role}');`);
    const code = db.as(
      father,
      `select invite_code from public.members where id = '${id}';`,
    );
    db.as(user, `select public.join_family('${code}');`);
    return id;
  };
  const insertMoment = (user: string, memberId: string, journal: string) =>
    db.as(
      user,
      `insert into public.moments (family_id, member_id, journal)
       values ('${familyId}', '${memberId}', '${journal}') returning id;`,
    );
  const upload = (user: string, family: string) =>
    db.as(
      user,
      `insert into storage.objects (bucket_id, name)
       values ('moment-photos', '${family}/m1/foto.jpg') returning name;`,
    );

  before(() => {
    db = createTestDb();
    db.admin(
      `insert into auth.users (id) values ('${father}'), ('${child}'), ('${art}'), ('${outsider}');`,
    );
    db.as(father, "select public.create_family('Keluarga Budi', 'Budi');");
    familyId = db.as(father, "select (private.my_member()).family_id;");
    childId = join(child, "Andi", "child");
    artId = join(art, "Sari", "art");
    db.as(outsider, "select public.create_family('Keluarga Lain', 'Joko');");
  });

  after(() => db?.drop());

  test("ayah dan anak bisa menulis dan melihat semua moment keluarga", () => {
    insertMoment(child, childId, "Main bola");
    insertMoment(father, childId, "Andi juara kelas"); // lewat PIN di HP ayah
    assert.equal(db.as(father, "select count(*) from public.moments;"), "2");
    assert.equal(db.as(child, "select count(*) from public.moments;"), "2");
  });

  test("anak tidak bisa menulis atas nama orang lain", () => {
    const fatherId = db.as(father, "select (private.my_member()).id;");
    assert.throws(() => insertMoment(child, fatherId, "Bukan punyaku"));
  });

  test("akun ART ditolak di tabel moments", () => {
    assert.equal(db.as(art, "select count(*) from public.moments;"), "0");
    assert.throws(() => insertMoment(art, artId, "Tidak boleh"));
    assert.equal(
      db.as(art, "update public.moments set journal = 'diubah' returning id;"),
      "",
    );
  });

  test("akun ART dan keluarga lain ditolak di file foto moment", () => {
    assert.equal(upload(child, familyId), `${familyId}/m1/foto.jpg`);
    assert.equal(
      db.as(
        father,
        "select count(*) from storage.objects where bucket_id = 'moment-photos';",
      ),
      "1",
    );
    assert.equal(
      db.as(
        art,
        "select count(*) from storage.objects where bucket_id = 'moment-photos';",
      ),
      "0",
    );
    assert.throws(() => upload(art, familyId));
    assert.equal(
      db.as(
        outsider,
        "select count(*) from storage.objects where bucket_id = 'moment-photos';",
      ),
      "0",
    );
    assert.throws(() => upload(outsider, familyId));
  });

  test("moment tanpa jurnal dan tanpa foto ditolak", () => {
    assert.throws(() => insertMoment(child, childId, "  "));
  });
});
