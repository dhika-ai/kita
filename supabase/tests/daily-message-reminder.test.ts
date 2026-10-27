import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000c1";
const mother = "00000000-0000-0000-0000-0000000000c2";

describe("M-04 pesan harian di pengingat pagi", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let familyId: string;
  let fatherId: string;
  let motherId: string;
  let childId: string;
  const today = "2026-10-21";

  const morning = () =>
    JSON.parse(
      db.admin(`begin; set local role service_role;
        select coalesce(json_object_agg(member_id, text), '{}') from public.reminder_messages('morning', '${today}');
        commit;`),
    ) as Record<string, string>;
  const write = (user: string, authorId: string, date: string, body: string) =>
    db.as(
      user,
      `insert into public.daily_messages (family_id, author_id, message_date, body)
       values ('${familyId}', '${authorId}', '${date}', '${body}');`,
    );

  before(() => {
    db = createTestDb();
    db.admin(
      `insert into auth.users (id) values ('${father}'), ('${mother}');`,
    );
    db.as(father, "select public.create_family('Keluarga Budi', 'Budi');");
    familyId = db.as(father, "select (private.my_member()).family_id;");
    fatherId = db.as(father, "select (private.my_member()).id;");
    motherId = db.as(father, "select public.add_member('Ani', 'mother');");
    const code = db.as(
      father,
      `select invite_code from public.members where id = '${motherId}';`,
    );
    db.as(mother, `select public.join_family('${code}');`);
    childId = db.as(father, "select public.add_member('Andi', 'child');");
    db.admin(`
      update public.members set telegram_chat_id = 1 where id = '${fatherId}';
      update public.members set telegram_chat_id = 2, language = 'en' where id = '${childId}';`);
  });

  after(() => db?.drop());

  test("belum ada pesan: pengingat pagi tanpa bagian pesan", () => {
    assert.doesNotMatch(morning()[fatherId], /Pesan dari Ayah\/Ibu/);
  });

  test("hari ini kosong: pesan dari tanggal terakhir yang dikirim", () => {
    write(father, fatherId, "2026-10-19", "Pesan lama");
    write(father, fatherId, "2026-10-20", "Sabar ya");
    write(father, fatherId, "2026-10-22", "Besok");
    assert.match(
      morning()[fatherId],
      /^Selamat pagi, Budi!\n\nPesan dari Ayah\/Ibu:\n"Sabar ya" — Budi\n\nKemarin:/,
    );
  });

  test("pesan hari ini dari Ayah dan Ibu, dalam bahasa anggota", () => {
    write(father, fatherId, today, "Jujur");
    write(mother, motherId, today, "Rapikan kamar");
    assert.match(
      morning()[childId],
      /^Good morning, Andi!\n\nMessage from Dad\/Mum:\n"Jujur" — Budi\n"Rapikan kamar" — Ani\n\nYesterday:/,
    );
  });
});
