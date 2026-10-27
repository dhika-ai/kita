"use client";

import { useEffect, useState } from "react";
import { buttonClass, Field, inputClass } from "@/components/auth-form";
import { useLanguage, useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { localDb, type LocalInventoryItem } from "@/lib/local-db";
import { saveLocal } from "@/lib/sync/sync";
import { useLiveQuery } from "@/lib/use-live-query";
import { DeleteButton, FormButtons } from "../master-data/name-list";

// T-10: stok barang rumah. Tugas belanja dibuat server saat stok di bawah minimum
// (trigger restock_when_low), jadi halaman ini cukup menyimpan stok.
export default function InventoryPage() {
  const t = useMessages();
  const language = useLanguage();
  const session = useSession();
  const active = useActiveMember();
  const [me, setMe] = useState<MyFamily | null>();
  const [editing, setEditing] = useState<LocalInventoryItem>();

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setMe, () => setMe(null));
  }, [session]);

  const data = useLiveQuery(
    async () => ({
      items: (await localDb.inventory_items.toArray())
        .filter((r) => !r.deleted_at)
        .sort((a, b) => a.name.localeCompare(b.name)),
      areas: (await localDb.areas.toArray()).filter((r) => !r.deleted_at),
    }),
    [],
  );

  const role = active?.role ?? me?.role;
  if (me === undefined && session !== null) return null;
  if (!me || (role !== "father" && role !== "mother")) {
    return <p className="p-6">{t.parentsOnly}</p>;
  }

  const areaName = (id: string | null) => {
    const area = data?.areas.find((a) => a.id === id);
    return area ? (language === "en" ? area.name_en : area.name_id) : "";
  };
  const setQty = (item: LocalInventoryItem, qty: number) =>
    saveLocal("inventory_items", { ...item, qty_on_hand: Math.max(0, qty) });

  if (editing) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold">{t.inventory}</h1>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            await saveLocal("inventory_items", {
              ...editing,
              name: String(form.get("name")).trim(),
              area_id: String(form.get("area_id")),
              unit: String(form.get("unit")).trim(),
              qty_on_hand: Number(form.get("qty_on_hand")),
              min_qty: Number(form.get("min_qty")),
            });
            setEditing(undefined);
          }}
          className="flex flex-col gap-3"
        >
          <Field label={t.itemName} name="name" defaultValue={editing.name} />
          <label className="flex flex-col gap-1 text-sm">
            {t.area}
            <select
              name="area_id"
              required
              defaultValue={editing.area_id ?? ""}
              className={inputClass}
            >
              <option value="" disabled>
                –
              </option>
              {data?.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {language === "en" ? a.name_en : a.name_id}
                </option>
              ))}
            </select>
          </label>
          <Field
            label={t.unit}
            name="unit"
            required={false}
            defaultValue={editing.unit}
          />
          <Field
            label={t.qtyOnHand}
            name="qty_on_hand"
            type="number"
            min={0}
            step="any"
            defaultValue={editing.qty_on_hand}
          />
          <Field
            label={t.minQty}
            name="min_qty"
            type="number"
            min={0}
            step="any"
            defaultValue={editing.min_qty}
          />
          <FormButtons onCancel={() => setEditing(undefined)} />
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t.inventory}</h1>
      <p className="text-sm opacity-70">{t.inventoryHint}</p>
      {data && data.items.length === 0 && (
        <p className="opacity-70">{t.empty}</p>
      )}
      <ul className="flex flex-col gap-2">
        {data?.items.map((item) => {
          const low = item.qty_on_hand < item.min_qty;
          return (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-md border p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{item.name}</span>
                <span className="text-sm opacity-70">
                  {areaName(item.area_id)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setQty(item, item.qty_on_hand - 1)}
                  aria-label={t.useOne}
                  className="rounded-md border px-3 py-1"
                >
                  −
                </button>
                <span>
                  {t.qtyOnHand}: <strong>{item.qty_on_hand}</strong> {item.unit}
                </span>
                <button
                  type="button"
                  onClick={() => setQty(item, item.qty_on_hand + 1)}
                  aria-label={t.addOne}
                  className="rounded-md border px-3 py-1"
                >
                  +
                </button>
                <span className="opacity-70">
                  {t.minQty}: {item.min_qty}
                </span>
                {low && (
                  <strong className="text-amber-700">{t.lowStock}</strong>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  className="rounded-md border px-3 py-1 text-sm"
                >
                  {t.edit}
                </button>
                <DeleteButton
                  onDelete={() =>
                    saveLocal("inventory_items", {
                      ...item,
                      deleted_at: new Date().toISOString(),
                    })
                  }
                />
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() =>
          setEditing({
            id: crypto.randomUUID(),
            family_id: me.familyId,
            name: "",
            area_id: null,
            unit: "",
            qty_on_hand: 0,
            min_qty: 1,
            restock_task_template_id: null,
            created_at: new Date().toISOString(),
            deleted_at: null,
          })
        }
        className={buttonClass}
      >
        {t.add}
      </button>
    </main>
  );
}
