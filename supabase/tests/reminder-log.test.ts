import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000c1";
const child = "00000000-0000-0000-0000-0000000000c3";

describe(
  "R-05 catatan, coba ulang, dan mute pengingat",
  { skip: skipReason },
  () => {
    let db: ReturnType<typeof createTestDb>;
    let fatherId: string;
    let childId: string;
    const day = "2026-10-21";

    // Edge Function memanggil sebagai service_role.
    const service = (sql: string) =>
      db.admin(`begin; set local role service_role; ${sql} commit;`);
    const due = (slot: string) =>
      service(
        `select coalesce(string_agg(member_id::text, ',' order by member_id), '') from public.reminder_messages('${slot}', '${day}');`,
      );
    const log = (memberId: string, slot: string, error: string | null) =>
      service(
        `select public.log_reminder('${memberId}', '${slot}', ${error ? `'${error}'` : "null"}, '${day}');`,
      );

    before(() => {
      db = createTestDb();
      db.admin(
        `insert into auth.users (id) values ('${father}'), ('${child}');`,
      );
      db.as(father, "select public.create_family('Keluarga Budi', 'Budi');");
      fatherId = db.as(father, "select (private.my_member()).id;");
      childId = db.as(father, "select public.add_member('Andi', 'child');");
      const invite = db.as(
        father,
        `select invite_code from public.members where id = '${childId}';`,
      );
      db.as(child, `select public.join_family('${invite}');`);
      db.admin(
        `update public.members set telegram_chat_id = 1 where id in ('${fatherId}', '${childId}');`,
      );
    });

    after(() => db?.drop());

    test("gagal kirim tercatat dan dicoba ulang sekali, yang terkirim tidak dikirim lagi", () => {
      const both = [fatherId, childId].sort().join(",");
      assert.equal(due("morning"), both);
      log(fatherId, "morning", null);
      log(childId, "morning", "403 Forbidden");
      assert.equal(
        db.admin(
          `select status || ',' || attempts || ',' || error from public.reminder_log where member_id = '${childId}';`,
        ),
        "failed,1,403 Forbidden",
      );
      // Jadwal coba ulang: hanya yang gagal.
      assert.equal(due("morning"), childId);
      log(childId, "morning", "403 Forbidden");
      // Sudah 2 kali gagal: berhenti.
      assert.equal(due("morning"), "");
      assert.equal(
        db.admin(
          `select status || ',' || attempts from public.reminder_log where member_id = '${childId}';`,
        ),
        "failed,2",
      );
      // Slot sore tidak terpengaruh.
      assert.equal(due("evening"), both);
    });

    test("slot yang dimute tidak dikirim; anak hanya bisa mengatur miliknya", () => {
      db.as(
        child,
        `select public.set_telegram_mute('${childId}', 'evening', true);`,
      );
      assert.equal(due("evening"), fatherId);
      assert.equal(
        db.as(
          father,
          `select telegram_mute_morning || ',' || telegram_mute_evening from public.members where id = '${childId}';`,
        ),
        "false,true",
      );
      assert.throws(() =>
        db.as(
          child,
          `select public.set_telegram_mute('${fatherId}', 'evening', true);`,
        ),
      );
      // Ayah boleh mengatur untuk anaknya.
      db.as(
        father,
        `select public.set_telegram_mute('${childId}', 'evening', false);`,
      );
      assert.equal(due("evening"), [fatherId, childId].sort().join(","));
    });

    test("aplikasi tidak bisa membaca atau menulis catatan pengingat", () => {
      assert.throws(() => db.as(father, "select * from public.reminder_log;"));
      assert.throws(() =>
        db.as(
          father,
          `select public.log_reminder('${fatherId}', 'morning', null, '${day}');`,
        ),
      );
    });
  },
);
