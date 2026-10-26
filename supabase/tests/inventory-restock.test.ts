import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createTestDb, skipReason } from "./db.ts";

const father = "00000000-0000-0000-0000-0000000000f1";

describe("T-10 inventaris membuat tugas belanja", { skip: skipReason }, () => {
  let db: ReturnType<typeof createTestDb>;
  let familyId: string;
  let itemId: string;

  const setQty = (qty: number) =>
    db.as(
      father,
      `update public.inventory_items set qty_on_hand = ${qty} where id = '${itemId}';`,
    );
  const restockTasks = (status = "") =>
    db.as(
      father,
      `select count(*) from public.task_instances i
       join public.inventory_items s on s.restock_task_template_id = i.template_id
       where s.id = '${itemId}' ${status && `and i.status = '${status}'`};`,
    );

  before(() => {
    db = createTestDb();
    db.admin(`insert into auth.users (id) values ('${father}');`);
    familyId = db.as(
      father,
      "select public.create_family('Keluarga Budi', 'Budi');",
    );
    itemId = db.as(
      father,
      `insert into public.inventory_items (family_id, name, area_id, unit, qty_on_hand, min_qty)
       values ('${familyId}', 'Sabun cuci piring', (select id from public.areas where name_en = 'Kitchen'), 'botol', 3, 1)
       returning id;`,
    );
  });

  after(() => db?.drop());

  test("stok cukup tidak membuat tugas", () => {
    setQty(1);
    assert.equal(
      db.as(
        father,
        `select restock_task_template_id is null from public.inventory_items where id = '${itemId}';`,
      ),
      "t",
    );
  });

  test("stok di bawah minimum membuat 1 tugas belanja, tidak dobel", () => {
    setQty(0);
    assert.equal(restockTasks("open"), "1");
    assert.equal(
      db.as(
        father,
        `select t.title_id || ' / ' || c.kind || ' / ' || a.name_en from public.task_templates t
         join public.inventory_items s on s.restock_task_template_id = t.id
         join public.categories c on c.id = t.category_id
         join public.areas a on a.id = t.area_id where s.id = '${itemId}';`,
      ),
      "Beli Sabun cuci piring / inventory / Kitchen",
    );
    setQty(0);
    // Perangkat mengirim baris lama tanpa template: template tetap dipakai.
    db.as(
      father,
      `insert into public.inventory_items (id, family_id, name, qty_on_hand, min_qty, restock_task_template_id)
       values ('${itemId}', '${familyId}', 'Sabun cuci piring', 0, 1, null)
       on conflict (id) do update set qty_on_hand = excluded.qty_on_hand,
         restock_task_template_id = excluded.restock_task_template_id;`,
    );
    assert.equal(restockTasks(), "1");
    assert.equal(
      db.as(
        father,
        "select count(*) from public.task_templates where title_id = 'Beli Sabun cuci piring';",
      ),
      "1",
    );
  });

  test("setelah tugas belanja selesai, stok rendah berikutnya membuat tugas baru", () => {
    db.admin(
      `update public.task_instances set status = 'approved', due_date = '2026-01-01'
       where template_id = (select restock_task_template_id from public.inventory_items where id = '${itemId}');`,
    );
    setQty(5);
    setQty(0);
    assert.equal(restockTasks("open"), "1");
    assert.equal(restockTasks(), "2");
  });
});
