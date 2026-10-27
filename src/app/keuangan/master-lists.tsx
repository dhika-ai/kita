"use client";

import { useState } from "react";
import { buttonClass, Field, inputClass } from "@/components/auth-form";
import { useMessages } from "@/i18n/language";
import {
  localDb,
  type LocalAccount,
  type LocalBudgetPost,
} from "@/lib/local-db";
import { formatRupiah, parseRupiah } from "@/lib/money";
import { saveLocal } from "@/lib/sync/sync";
import { useLiveQuery } from "@/lib/use-live-query";
import { DeleteButton, FormButtons } from "../master-data/name-list";

const accountKinds = ["cash", "bank", "ewallet"] as const;
const postKinds = ["expense", "income"] as const;

const newRow = (familyId: string) => ({
  id: crypto.randomUUID(),
  family_id: familyId,
  created_at: new Date().toISOString(),
  deleted_at: null,
});

/** K-02: rekening, bank, dan e-wallet keluarga. */
export function AccountList({ familyId }: { familyId: string }) {
  const t = useMessages();
  const [editing, setEditing] = useState<string>();
  const rows = useLiveQuery(
    () => localDb.accounts.filter((row) => !row.deleted_at).toArray(),
    [],
  );

  async function save(row: LocalAccount | undefined, form: FormData) {
    await saveLocal("accounts", {
      ...(row ?? newRow(familyId)),
      name: String(form.get("name")).trim(),
      kind: String(form.get("kind")),
    });
    setEditing(undefined);
  }

  const form = (row?: LocalAccount) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save(row, new FormData(event.currentTarget));
      }}
      className="flex flex-col gap-3"
    >
      <Field label={t.name} name="name" defaultValue={row?.name} />
      <label className="flex flex-col gap-1 text-sm">
        {t.kind}
        <select
          name="kind"
          defaultValue={row?.kind ?? "bank"}
          className={inputClass}
        >
          {accountKinds.map((kind) => (
            <option key={kind} value={kind}>
              {t[`account_${kind}`]}
            </option>
          ))}
        </select>
      </label>
      <FormButtons onCancel={() => setEditing(undefined)} />
    </form>
  );

  return (
    <List
      empty={rows?.length === 0}
      editing={editing}
      onAdd={() => setEditing("new")}
      newForm={form()}
    >
      {[...(rows ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((row) => (
          <li key={row.id} className="rounded-md border p-3">
            {editing === row.id ? (
              form(row)
            ) : (
              <Row
                label={row.name}
                detail={t[`account_${row.kind}`]}
                onEdit={() => setEditing(row.id)}
                onDelete={() =>
                  saveLocal("accounts", {
                    ...row,
                    deleted_at: new Date().toISOString(),
                  })
                }
              />
            )}
          </li>
        ))}
    </List>
  );
}

/** K-02: pos pemasukan dan pengeluaran, dengan anggaran bulanan untuk pengeluaran. */
export function PostList({ familyId }: { familyId: string }) {
  const t = useMessages();
  const [editing, setEditing] = useState<string>();
  const [error, setError] = useState("");
  const rows = useLiveQuery(
    () => localDb.budget_posts.filter((row) => !row.deleted_at).toArray(),
    [],
  );

  async function save(row: LocalBudgetPost | undefined, form: FormData) {
    const budgetText = String(form.get("monthly_budget") ?? "").trim();
    const budget = budgetText ? parseRupiah(budgetText) : null;
    if (Number.isNaN(budget)) return setError(t.invalidAmount);
    setError("");
    await saveLocal("budget_posts", {
      ...(row ?? newRow(familyId)),
      name: String(form.get("name")).trim(),
      kind: String(form.get("kind")),
      monthly_budget: budget,
    });
    setEditing(undefined);
  }

  const form = (row?: LocalBudgetPost) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save(row, new FormData(event.currentTarget));
      }}
      className="flex flex-col gap-3"
    >
      <Field label={t.name} name="name" defaultValue={row?.name} />
      <label className="flex flex-col gap-1 text-sm">
        {t.kind}
        <select
          name="kind"
          defaultValue={row?.kind ?? "expense"}
          className={inputClass}
        >
          {postKinds.map((kind) => (
            <option key={kind} value={kind}>
              {t[`tx_${kind}`]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t.monthlyBudget}
        <input
          name="monthly_budget"
          inputMode="numeric"
          defaultValue={row?.monthly_budget ?? ""}
          className={inputClass}
        />
        <span className="text-xs opacity-70">{t.monthlyBudgetHint}</span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <FormButtons onCancel={() => setEditing(undefined)} />
    </form>
  );

  return (
    <List
      empty={rows?.length === 0}
      editing={editing}
      onAdd={() => setEditing("new")}
      newForm={form()}
    >
      {[...(rows ?? [])]
        .sort(
          (a, b) =>
            a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
        )
        .map((row) => (
          <li key={row.id} className="rounded-md border p-3">
            {editing === row.id ? (
              form(row)
            ) : (
              <Row
                label={row.name}
                detail={`${t[`tx_${row.kind}`]}${
                  row.monthly_budget !== null
                    ? ` · ${formatRupiah(row.monthly_budget)}${t.perMonth}`
                    : ""
                }`}
                onEdit={() => setEditing(row.id)}
                onDelete={() =>
                  saveLocal("budget_posts", {
                    ...row,
                    deleted_at: new Date().toISOString(),
                  })
                }
              />
            )}
          </li>
        ))}
    </List>
  );
}

function List({
  empty,
  editing,
  onAdd,
  newForm,
  children,
}: {
  empty: boolean;
  editing: string | undefined;
  onAdd: () => void;
  newForm: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useMessages();
  return (
    <div className="flex flex-col gap-3">
      {empty && <p className="opacity-70">{t.empty}</p>}
      <ul className="flex flex-col gap-2">{children}</ul>
      {editing === "new" ? (
        <div className="rounded-md border p-3">{newForm}</div>
      ) : (
        <button type="button" onClick={onAdd} className={buttonClass}>
          {t.add}
        </button>
      )}
    </div>
  );
}

function Row({
  label,
  detail,
  onEdit,
  onDelete,
}: {
  label: string;
  detail: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useMessages();
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex flex-col">
        <span>{label}</span>
        <span className="text-sm opacity-70">{detail}</span>
      </span>
      <span className="flex gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md border px-3 py-1 text-sm"
        >
          {t.edit}
        </button>
        <DeleteButton onDelete={onDelete} />
      </span>
    </div>
  );
}
