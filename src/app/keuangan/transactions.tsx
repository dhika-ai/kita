"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/auth-form";
import { StoragePhoto } from "@/components/storage-photo";
import { useMessages } from "@/i18n/language";
import { todayWib } from "@/lib/dates";
import { localDb } from "@/lib/local-db";
import { formatRupiah, parseRupiah } from "@/lib/money";
import { queueCompressedPhoto } from "@/lib/photo";
import { saveLocal } from "@/lib/sync/sync";
import { useLiveQuery } from "@/lib/use-live-query";
import { DeleteButton } from "../master-data/name-list";

export const receiptBucket = "receipts";
const kinds = ["expense", "income"] as const;

/**
 * K-03: catat pemasukan dan pengeluaran. Disimpan di perangkat dulu lalu tersinkron
 * (F-10), termasuk foto struk, jadi bisa dicatat saat offline.
 */
export function Transactions({
  familyId,
  memberId,
}: {
  familyId: string;
  memberId: string;
}) {
  const t = useMessages();
  const [kind, setKind] = useState<(typeof kinds)[number]>("expense");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<string>();
  const data = useLiveQuery(
    async () => ({
      posts: (await localDb.budget_posts.toArray()).filter(
        (p) => !p.deleted_at,
      ),
      accounts: (await localDb.accounts.toArray()).filter((a) => !a.deleted_at),
      // 30 transaksi terakhir; ringkasan per bulan ada di tab Ringkasan (K-04).
      recent: (
        await localDb.transactions.orderBy("tx_date").reverse().toArray()
      )
        .filter((x) => !x.deleted_at)
        .slice(0, 30),
    }),
    [],
  );
  if (!data) return null;
  const posts = data.posts.filter((p) => p.kind === kind);
  const name = (list: { id: string; name: string }[], id: string) =>
    list.find((x) => x.id === id)?.name ?? "";

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const amount = parseRupiah(String(form.get("amount")));
    if (!(amount > 0)) return setError(t.invalidAmount);
    setError("");
    setBusy(true);
    const id = crypto.randomUUID();
    const file = form.get("receipt") as File | null;
    const receipt_path = file?.size
      ? await queueCompressedPhoto(receiptBucket, `${familyId}/${id}`, file)
      : null;
    await saveLocal("transactions", {
      id,
      family_id: familyId,
      kind,
      amount,
      post_id: String(form.get("post")),
      account_id: String(form.get("account")),
      tx_date: String(form.get("tx_date")),
      note: String(form.get("note")).trim() || null,
      receipt_path,
      created_by: memberId,
      created_at: new Date().toISOString(),
      deleted_at: null,
    });
    setBusy(false);
    formElement.reset();
  }

  return (
    <div className="flex flex-col gap-4">
      {data.accounts.length === 0 || posts.length === 0 ? (
        <p className="rounded-md border p-3 text-sm">{t.financeSetupFirst}</p>
      ) : null}
      <form
        onSubmit={save}
        className="flex flex-col gap-3 rounded-md border p-3"
      >
        <div role="tablist" className="flex gap-1">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className="flex-1 rounded-md border px-3 py-1 text-sm aria-selected:bg-foreground aria-selected:text-background"
            >
              {t[`tx_${k}`]}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          {t.amount}
          <input
            name="amount"
            inputMode="numeric"
            required
            placeholder="150000"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t.budgetPost}
          <select name="post" required className={inputClass}>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t.financeAccount}
          <select name="account" required className={inputClass}>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t.txDate}
          <input
            name="tx_date"
            type="date"
            required
            defaultValue={todayWib()}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t.note}
          <input name="note" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t.receiptPhoto}
          <input name="receipt" type="file" accept="image/*" />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || posts.length === 0 || data.accounts.length === 0}
          className={buttonClass}
        >
          {t.saveTransaction}
        </button>
      </form>

      <h2 className="font-medium">{t.recentTransactions}</h2>
      {data.recent.length === 0 && <p className="opacity-70">{t.empty}</p>}
      <ul className="flex flex-col gap-2">
        {data.recent.map((x) => (
          <li key={x.id} className="flex flex-col gap-2 border-b pb-2 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex flex-col">
                <span>
                  {name(data.posts, x.post_id)} ·{" "}
                  {name(data.accounts, x.account_id)}
                </span>
                {x.note && <span className="opacity-70">{x.note}</span>}
                <span className="text-xs opacity-70">{x.tx_date}</span>
              </span>
              <strong
                className={
                  x.kind === "income" ? "text-green-700" : "text-red-600"
                }
              >
                {x.kind === "income" ? "+" : "−"}
                {formatRupiah(x.amount)}
              </strong>
            </div>
            <div className="flex gap-1">
              {x.receipt_path && (
                <button
                  type="button"
                  onClick={() =>
                    setReceipt(receipt === x.id ? undefined : x.id)
                  }
                  className="rounded-md border px-3 py-1 text-sm"
                >
                  {t.receiptPhoto}
                </button>
              )}
              <DeleteButton
                onDelete={() =>
                  saveLocal("transactions", {
                    ...x,
                    deleted_at: new Date().toISOString(),
                  })
                }
              />
            </div>
            {receipt === x.id && x.receipt_path && (
              <StoragePhoto bucket={receiptBucket} path={x.receipt_path} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
