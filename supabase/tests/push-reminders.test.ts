import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000d1";
const mother = "00000000-0000-0000-0000-0000000000d2";

describe("P-02 pengingat lewat push notification", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let fatherId: string;
  let motherId: string;
  let childId: string;
  const day = "2026-11-02";

  // Edge Function memanggil sebagai service_role.
  const service = (sql: string) =>
    db.admin(`begin; set local role service_role; ${sql} commit;`);
  const due = (slot: string) =>
    JSON.parse(
      service(
        `select coalesce(json_object_agg(member_id, subscriptions), '{}') from public.push_reminders('${slot}', '${day}');`,
      ),
    ) as Record<string, { endpoint: string }[]>;
  const subscribe = (user: string, endpoint: string, ids: string[]) =>
    db.as(
      user,
      `select public.set_push_subscription('${endpoint}', 'key', 'secret',
        array[${ids.map((id) => `'${id}'`).join(",")}]::uuid[], 'id');`,
    );

  before(() => {
    db = createTestDb();
    db.admin(
      `insert into auth.users (id) values ('${father}'), ('${mother}');`,
    );
    db.as(father, "select public.create_family('Keluarga Budi', 'Budi');");
    fatherId = db.as(father, "select (private.my_member()).id;");
    motherId = db.as(father, "select public.add_member('Sari', 'mother');");
    const invite = db.as(
      father,
      `select invite_code from public.members where id = '${motherId}';`,
    );
    db.as(mother, `select public.join_family('${invite}');`);
    // Si kecil tidak punya HP sendiri.
    childId = db.as(father, "select public.add_member('Andi', 'child');");
    subscribe(father, "https://push/hp-ayah", [fatherId, childId]);
    subscribe(mother, "https://push/hp-ibu", [motherId, childId]);
  });

  after(() => db?.drop());

  test("pengingat si kecil dikirim ke HP ayah dan HP ibu", () => {
    const sent = due("morning");
    assert.deepEqual(
      Object.keys(sent).sort(),
      [fatherId, motherId, childId].sort(),
    );
    assert.deepEqual(
      sent[childId].map((s) => s.endpoint),
      ["https://push/hp-ayah", "https://push/hp-ibu"],
    );
    assert.deepEqual(
      sent[fatherId].map((s) => s.endpoint),
      ["https://push/hp-ayah"],
    );
    const text = service(
      `select text from public.push_reminders('morning', '${day}') where member_id = '${childId}';`,
    );
    assert.match(text, /^Selamat pagi, Andi!/);
    assert.doesNotMatch(text, /Top 3/);
  });

  test("yang sudah terkirim tidak dikirim lagi, yang dimute dilewati", () => {
    service(
      `select public.log_reminder('${fatherId}', 'morning', null, '${day}');`,
    );
    db.as(
      father,
      `select public.set_telegram_mute('${childId}', 'morning', true);`,
    );
    assert.deepEqual(Object.keys(due("morning")), [motherId]);
    assert.equal(Object.keys(due("evening")).length, 3);
  });

  test("langganan kedaluwarsa dihapus, anggota tanpa HP tidak dapat pesan", () => {
    service(`select public.forget_push_subscription('https://push/hp-ibu');`);
    const sent = due("evening");
    assert.deepEqual(Object.keys(sent).sort(), [fatherId, childId].sort());
    assert.deepEqual(
      sent[childId].map((s) => s.endpoint),
      ["https://push/hp-ayah"],
    );
  });

  test("aplikasi tidak bisa memanggil fungsi pengirim", () => {
    assert.throws(() =>
      db.as(father, "select * from public.push_reminders('morning');"),
    );
    assert.throws(() =>
      db.as(
        father,
        "select public.forget_push_subscription('https://push/hp-ayah');",
      ),
    );
  });
});
