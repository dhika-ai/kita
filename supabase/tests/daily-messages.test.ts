import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000f1";
const mother = "00000000-0000-0000-0000-0000000000f2";
const child = "00000000-0000-0000-0000-0000000000f3";
const art = "00000000-0000-0000-0000-0000000000f4";
const outsider = "00000000-0000-0000-0000-0000000000f5";

describe("M-01 tabel pesan harian", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let familyId: string;
  let fatherId: string;
  let motherId: string;

  const join = (user: string, name: string, role: string) => {
    const id = db.as(father, `select public.add_member('${name}', '${role}');`);
    const code = db.as(
      father,
      `select invite_code from public.members where id = '${id}';`,
    );
    db.as(user, `select public.join_family('${code}');`);
    return id;
  };
  const write = (user: string, authorId: string, body: string) =>
    db.as(
      user,
      `insert into public.daily_messages (family_id, author_id, body)
       values ('${familyId}', '${authorId}', '${body}') returning id;`,
    );
  const upload = (user: string) =>
    db.as(
      user,
      `insert into storage.objects (bucket_id, name)
       values ('message-photos', '${familyId}/p1/foto.jpg') returning name;`,
    );

  before(() => {
    db = createTestDb();
    db.admin(
      `insert into auth.users (id) values ('${father}'), ('${mother}'), ('${child}'), ('${art}'), ('${outsider}');`,
    );
    db.as(father, "select public.create_family('Keluarga Budi', 'Budi');");
    familyId = db.as(father, "select (private.my_member()).family_id;");
    fatherId = db.as(father, "select (private.my_member()).id;");
    motherId = join(mother, "Ani", "mother");
    join(child, "Andi", "child");
    join(art, "Sari", "art");
    db.as(outsider, "select public.create_family('Keluarga Lain', 'Joko');");
  });

  after(() => db?.drop());

  test("ayah dan ibu menulis, seluruh keluarga membaca", () => {
    write(father, fatherId, "Hari ini kita jujur");
    write(mother, motherId, "Fokus: rapikan kamar");
    for (const user of [father, child, art]) {
      assert.equal(
        db.as(user, "select count(*) from public.daily_messages;"),
        "2",
      );
    }
    assert.equal(
      db.as(outsider, "select count(*) from public.daily_messages;"),
      "0",
    );
  });

  test("anak dan ART tidak bisa menulis, ayah tidak bisa atas nama ibu", () => {
    const childId = db.as(child, "select (private.my_member()).id;");
    assert.throws(() => write(child, childId, "Boleh?"));
    assert.throws(() => write(father, motherId, "Atas nama Ibu"));
    assert.equal(
      db.as(
        father,
        `update public.daily_messages set body = 'diubah' where author_id = '${motherId}' returning id;`,
      ),
      "",
    );
  });

  test("pesan kosong ditolak", () => {
    assert.throws(() => write(father, fatherId, "  "));
  });

  test("foto pesan: orang tua unggah, keluarga lihat, keluarga lain tidak", () => {
    assert.throws(() => upload(child));
    assert.equal(upload(mother), `${familyId}/p1/foto.jpg`);
    const count =
      "select count(*) from storage.objects where bucket_id = 'message-photos';";
    assert.equal(db.as(art, count), "1");
    assert.equal(db.as(outsider, count), "0");
  });
});
