import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000e1";
const mother = "00000000-0000-0000-0000-0000000000e2";
const child = "00000000-0000-0000-0000-0000000000e3";
const art = "00000000-0000-0000-0000-0000000000e4";
const outsider = "00000000-0000-0000-0000-0000000000e5";

describe("K-01 keuangan hanya untuk ayah dan ibu", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let familyId: string;
  let fatherId: string;
  const ids = {
    account: "00000000-0000-0000-0000-00000000e0a1",
    post: "00000000-0000-0000-0000-00000000e0b1",
    tx: "00000000-0000-0000-0000-00000000e0c1",
  };

  const join = (user: string, name: string, role: string) => {
    const id = db.as(father, `select public.add_member('${name}', '${role}');`);
    const code = db.as(
      father,
      `select invite_code from public.members where id = '${id}';`,
    );
    db.as(user, `select public.join_family('${code}');`);
  };
  const count = (user: string) =>
    ["accounts", "budget_posts", "transactions"]
      .map((t) => db.as(user, `select count(*) from public.${t};`))
      .join(",");

  before(() => {
    db = createTestDb();
    db.admin(
      `insert into auth.users (id) values ('${father}'), ('${mother}'), ('${child}'), ('${art}'), ('${outsider}');`,
    );
    familyId = db.as(
      father,
      "select public.create_family('Keluarga Budi', 'Budi');",
    );
    fatherId = db.as(
      father,
      `select id from public.members where auth_user_id = '${father}';`,
    );
    join(mother, "Ani", "mother");
    join(child, "Andi", "child");
    join(art, "Siti", "art");
    db.as(outsider, "select public.create_family('Keluarga Lain', 'Joko');");

    db.as(
      father,
      `insert into public.accounts (id, family_id, name, kind) values ('${ids.account}', '${familyId}', 'BCA', 'bank');
       insert into public.budget_posts (id, family_id, name, kind, monthly_budget)
         values ('${ids.post}', '${familyId}', 'Belanja dapur', 'expense', 3000000);
       insert into public.transactions (id, family_id, kind, amount, post_id, account_id, tx_date, created_by)
         values ('${ids.tx}', '${familyId}', 'expense', 125000, '${ids.post}', '${ids.account}', '2026-11-01', '${fatherId}');`,
    );
  });

  after(() => db?.drop());

  test("ayah dan ibu bisa melihat dan mengubah", () => {
    assert.equal(count(father), "1,1,1");
    assert.equal(count(mother), "1,1,1");
    db.as(
      mother,
      `update public.transactions set amount = 150000 where id = '${ids.tx}';`,
    );
    assert.equal(
      db.as(father, "select amount from public.transactions;"),
      "150000",
    );
  });

  test("anak, ART, dan keluarga lain mendapat 0 baris", () => {
    assert.equal(count(child), "0,0,0");
    assert.equal(count(art), "0,0,0");
    assert.equal(count(outsider), "0,0,0");
  });

  test("anak dan ART ditolak saat menulis", () => {
    for (const user of [child, art]) {
      assert.throws(() =>
        db.as(
          user,
          `insert into public.accounts (family_id, name, kind) values ('${familyId}', 'Dompet', 'cash');`,
        ),
      );
      // Update tanpa izin baca tidak mengenai baris apa pun.
      db.as(user, "update public.transactions set amount = 1;");
    }
    assert.equal(
      db.as(father, "select amount from public.transactions;"),
      "150000",
    );
  });

  // API mengirim nilai sebagai teks, jadi pecahan ditolak, bukan dibulatkan.
  test("nominal harus bilangan bulat positif", () => {
    assert.throws(() =>
      db.as(
        father,
        `update public.transactions set amount = 0 where id = '${ids.tx}';`,
      ),
    );
    assert.throws(() =>
      db.as(
        father,
        `update public.transactions set amount = '1000.5' where id = '${ids.tx}';`,
      ),
    );
  });
});
