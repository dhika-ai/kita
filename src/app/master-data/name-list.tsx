"use client";

import { useState } from "react";
import { buttonClass, Field, inputClass } from "@/components/auth-form";
import { useLanguage, useMessages } from "@/i18n/language";
import {
  localDb,
  type CategoryKind,
  type LocalArea,
  type LocalCategory,
} from "@/lib/local-db";
import { saveLocal } from "@/lib/sync/sync";
import { useLiveQuery } from "@/lib/use-live-query";

const kinds: CategoryKind[] = [
  "cleaning",
  "laundry",
  "maintenance",
  "inventory",
  "cooking",
  "personal_habit",
];

type Row = LocalArea | LocalCategory;

/** Daftar area atau kategori: nama dalam dua bahasa, kategori juga punya jenis. */
export function NameList({
  table,
  familyId,
}: {
  table: "areas" | "categories";
  familyId: string;
}) {
  const t = useMessages();
  const language = useLanguage();
  const [editing, setEditing] = useState<string>();
  const rows = useLiveQuery(
    () =>
      (localDb[table] as typeof localDb.areas)
        .filter((row) => !row.deleted_at)
        .toArray() as Promise<Row[]>,
    [table],
  );

  const name = (row: Row) => (language === "en" ? row.name_en : row.name_id);
  const sorted = [...(rows ?? [])].sort((a, b) =>
    name(a).localeCompare(name(b)),
  );

  async function save(row: Row | undefined, form: FormData) {
    await saveLocal(table, {
      ...(row ?? {
        id: crypto.randomUUID(),
        family_id: familyId,
        created_at: new Date().toISOString(),
        deleted_at: null,
        ...(table === "areas" ? { icon: null } : {}),
      }),
      name_en: String(form.get("name_en")).trim(),
      name_id: String(form.get("name_id")).trim(),
      ...(table === "categories" ? { kind: String(form.get("kind")) } : {}),
    });
    setEditing(undefined);
  }

  return (
    <div className="flex flex-col gap-3">
      {rows && sorted.length === 0 && <p className="opacity-70">{t.empty}</p>}
      <ul className="flex flex-col gap-2">
        {sorted.map((row) => (
          <li key={row.id} className="rounded-md border p-3">
            {editing === row.id ? (
              <NameForm
                table={table}
                row={row}
                onSave={(form) => save(row, form)}
                onCancel={() => setEditing(undefined)}
              />
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span>
                  {name(row)}
                  {"kind" in row && (
                    <span className="ml-2 text-sm opacity-70">
                      {t[`kind_${row.kind}`]}
                    </span>
                  )}
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(row.id)}
                    className="rounded-md border px-3 py-1 text-sm"
                  >
                    {t.edit}
                  </button>
                  <DeleteButton
                    onDelete={() =>
                      saveLocal(table, {
                        ...row,
                        deleted_at: new Date().toISOString(),
                      })
                    }
                  />
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing === "new" ? (
        <div className="rounded-md border p-3">
          <NameForm
            table={table}
            onSave={(form) => save(undefined, form)}
            onCancel={() => setEditing(undefined)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className={buttonClass}
        >
          {t.add}
        </button>
      )}
    </div>
  );
}

function NameForm({
  table,
  row,
  onSave,
  onCancel,
}: {
  table: "areas" | "categories";
  row?: Row;
  onSave: (form: FormData) => void;
  onCancel: () => void;
}) {
  const t = useMessages();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(new FormData(event.currentTarget));
      }}
      className="flex flex-col gap-3"
    >
      <Field label={t.nameId} name="name_id" defaultValue={row?.name_id} />
      <Field label={t.nameEn} name="name_en" defaultValue={row?.name_en} />
      {table === "categories" && (
        <label className="flex flex-col gap-1 text-sm">
          {t.kind}
          <select
            name="kind"
            defaultValue={row && "kind" in row ? row.kind : "cleaning"}
            className={inputClass}
          >
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {t[`kind_${kind}`]}
              </option>
            ))}
          </select>
        </label>
      )}
      <FormButtons onCancel={onCancel} />
    </form>
  );
}

export function FormButtons({ onCancel }: { onCancel: () => void }) {
  const t = useMessages();
  return (
    <div className="flex gap-2">
      <button type="submit" className={buttonClass}>
        {t.save}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border px-4 py-2"
      >
        {t.cancel}
      </button>
    </div>
  );
}

/** Hapus butuh dua kali tekan supaya tidak terhapus tanpa sengaja. */
export function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const t = useMessages();
  const [asking, setAsking] = useState(false);
  return (
    <button
      type="button"
      onClick={() => (asking ? onDelete() : setAsking(true))}
      onBlur={() => setAsking(false)}
      className="rounded-md border px-3 py-1 text-sm text-red-600"
    >
      {asking ? t.confirmDelete : t.delete}
    </button>
  );
}
