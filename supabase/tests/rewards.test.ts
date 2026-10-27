import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000d1";
const child = "00000000-0000-0000-0000-0000000000d3";

describe("G-04 hadiah", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let familyId: string;
  let childId: string;
  let rewardId: string;

  const balance = () =>
    db.as(
      child,
      `select coalesce(sum(balance), 0) from public.point_balances where member_id = '${childId}';`,
    );
  const request = () =>
    db.as(child, `select public.request_reward('${rewardId}');`);
  const decide = (id: string, approve: boolean) =>
    db.as(father, `select public.decide_reward('${id}', ${approve});`);

  before(() => {
    db = createTestDb();
    db.admin(`insert into auth.users (id) values ('${father}'), ('${child}');`);
    familyId = db.as(
      father,
      "select public.create_family('Keluarga Budi', 'Budi');",
    );
    childId = db.as(father, "select public.add_member('Andi', 'child');");
    const code = db.as(
      father,
      `select invite_code from public.members where id = '${childId}';`,
    );
    db.as(child, `select public.join_family('${code}');`);
    db.as(
      father,
      `select public.correct_points('${childId}', 30, 'Modal awal');`,
    );
    rewardId = db.as(
      father,
      `insert into public.rewards (family_id, name, cost)
       values ('${familyId}', 'Main game 1 jam', 20) returning id;`,
    );
  });

  after(() => db?.drop());

  test("anak tidak bisa mengubah katalog", () => {
    assert.throws(() =>
      db.as(
        child,
        `insert into public.rewards (family_id, name, cost) values ('${familyId}', 'Gratis', 1);`,
      ),
    );
  });

  test("ajukan, setujui, poin berkurang", () => {
    const id = request();
    assert.equal(balance(), "30");
    decide(id, true);
    assert.equal(balance(), "10");
    assert.equal(
      db.as(
        child,
        `select status from public.reward_requests where id = '${id}';`,
      ),
      "approved",
    );
  });

  test("saldo tidak cukup ditolak, saldo tidak pernah negatif", () => {
    assert.throws(request, /Poin belum cukup/);
    db.as(father, `select public.correct_points('${childId}', 15, 'Bonus');`);
    const id = request(); // saldo 25, menunggu 20
    assert.throws(request, /Poin belum cukup/);
    db.as(
      father,
      `select public.correct_points('${childId}', -10, 'Salah catat');`,
    );
    assert.throws(() => decide(id, true), /Poin belum cukup/);
    assert.equal(balance(), "15");
    decide(id, false);
    assert.equal(balance(), "15");
  });

  test("ayah tidak bisa mengajukan, anak tidak bisa memutuskan", () => {
    assert.throws(() =>
      db.as(father, `select public.request_reward('${rewardId}');`),
    );
    db.as(father, `select public.correct_points('${childId}', 10, 'Bonus');`);
    const id = request();
    assert.throws(() =>
      db.as(child, `select public.decide_reward('${id}', true);`),
    );
  });
});
