import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000b1";
const child = "00000000-0000-0000-0000-0000000000b3";

describe("R-03 isi pesan pengingat", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let fatherId: string;
  let childId: string;
  const today = "2026-10-21";
  const yesterday = "2026-10-20";

  // Edge Function memanggil fungsi ini sebagai service_role.
  const messages = (slot: string) =>
    JSON.parse(
      db.admin(`begin; set local role service_role;
        select coalesce(json_object_agg(member_id, text), '{}') from public.reminder_messages('${slot}', '${today}');
        commit;`),
    ) as Record<string, string>;

  before(() => {
    db = createTestDb();
    db.admin(`insert into auth.users (id) values ('${father}'), ('${child}');`);
    db.as(father, "select public.create_family('Keluarga Budi', 'Budi');");
    fatherId = db.as(father, "select (private.my_member()).id;");
    childId = db.as(father, "select public.add_member('Andi', 'child');");
    db.admin(`
      update public.members set telegram_chat_id = 1 where id = '${fatherId}';
      update public.members set telegram_chat_id = 2, language = 'en' where id = '${childId}';`);

    // Kemarin: Andi 4 tugas (2 disetujui, 1 menunggu, 1 terlewat), Budi 1 disetujui.
    // Hari ini: Andi 3 tugas (1 belum, 1 ditolak, 1 selesai menunggu persetujuan).
    db.admin(`
      with picked as (
        select t.id, row_number() over (order by t.title_id) as n
        from public.task_templates t
        join public.members m on m.family_id = t.family_id and m.id = '${childId}'
        where t.recurrence is not null
        limit 8
      )
      insert into public.task_instances (family_id, template_id, assignee_id, due_date, status, counts_on)
      select m.family_id, p.id,
        case when p.n = 5 then '${fatherId}'::uuid else m.id end,
        (case when p.n <= 5 then '${yesterday}' else '${today}' end)::date,
        (array['approved', 'approved', 'done', 'missed', 'approved', 'open', 'rejected', 'done'])[p.n]::public.task_status,
        case when p.n in (1, 2, 5) then date '${today}' end
      from picked p join public.members m on m.id = '${childId}';`);
  });

  after(() => db?.drop());

  test("pesan pagi cocok dengan angka dashboard kemarin", () => {
    const view = (memberId: string) =>
      db
        .as(
          father,
          `select approved || '/' || total || ' ' || completion_pct || '% ' || points
           from public.dashboard_daily where member_id = '${memberId}' and due_date = '${yesterday}';`,
        )
        .split(" ");
    const [andiCount, andiPct, andiPoints] = view(childId);
    const [budiCount, budiPct, budiPoints] = view(fatherId);
    assert.equal(andiCount, "2/4");
    assert.equal(andiPct, "50%");

    const sent = messages("morning");
    assert.equal(Object.keys(sent).length, 2);
    // Andi memakai bahasa Inggris.
    assert.match(
      sent[childId],
      new RegExp(
        `^Good morning, Andi!\\n\\nYesterday: ${andiCount} tasks approved \\(${andiPct}\\), ${andiPoints} pts\\.`,
      ),
    );
    assert.match(
      sent[fatherId],
      new RegExp(
        `Kemarin: ${budiCount} tugas disetujui \\(${budiPct}\\), ${budiPoints} poin\\.`,
      ),
    );
    // Leaderboard di-Kill (triage 27 Okt), jadi pesan pagi tanpa "Top 3" (P-02).
    assert.doesNotMatch(sent[fatherId], /Top 3/);
    assert.doesNotMatch(sent[childId], /Top 3/);
    // Tugas hari ini: yang belum dan yang ditolak.
    assert.equal(
      (sent[childId].split("Today's tasks:\n")[1] ?? "").split("\n").length,
      2,
    );
    assert.match(sent[fatherId], /Tugas hari ini:\nTidak ada\.$/);
  });

  test("pesan sore: tugas belum selesai dan jumlah menunggu persetujuan", () => {
    const sent = messages("evening");
    assert.match(
      sent[childId],
      /^Good afternoon, Andi! Today's unfinished tasks:\n- .+\n- .+\n\nWaiting for approval: 2$/,
    );
    // Ayah melihat yang menunggu di seluruh keluarga.
    assert.equal(
      sent[fatherId],
      "Sore, Budi! Semua tugas hari ini sudah selesai.\n\nMenunggu persetujuan: 2",
    );
  });

  test("anggota yang belum terhubung tidak dapat pesan, aplikasi tidak bisa memanggil", () => {
    db.admin(
      `update public.members set telegram_chat_id = null where id = '${fatherId}';`,
    );
    assert.deepEqual(Object.keys(messages("evening")), [childId]);
    assert.throws(() =>
      db.as(father, "select * from public.reminder_messages('morning');"),
    );
  });
});

describe("R-04 rahasia jadwal pengingat", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  before(() => {
    db = createTestDb();
    // Tiruan Vault Supabase secukupnya.
    db.admin(`
      create schema vault;
      create table vault.decrypted_secrets (name text, decrypted_secret text);
      insert into vault.decrypted_secrets values ('kita_cron_secret', 'rahasia');`);
  });
  after(() => db?.drop());

  test("hanya rahasia yang benar yang diterima, dan hanya service_role yang bisa memeriksa", () => {
    const check = (secret: string) =>
      db.admin(`begin; set local role service_role;
        select public.check_cron_secret('${secret}'); commit;`);
    assert.equal(check("rahasia"), "t");
    assert.equal(check("tebakan"), "f");
    assert.equal(check(""), "f");
    assert.throws(() =>
      db.as(
        "00000000-0000-0000-0000-0000000000b9",
        "select public.check_cron_secret('rahasia');",
      ),
    );
  });
});
