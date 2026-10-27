"use client";

import { useEffect, useState } from "react";
import { buttonClass, inputClass } from "@/components/auth-form";
import { StoragePhoto } from "@/components/storage-photo";
import { useLanguage, useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { localDb, type LocalTaskInstance } from "@/lib/local-db";
import { supabase } from "@/lib/supabase";
import { sync } from "@/lib/sync/sync";
import { useLiveQuery } from "@/lib/use-live-query";

// Jam tutup hari (families.day_close_time, bawaan 21:00 WIB). Centang setelah jam ini
// atau setelah tanggal tugasnya ditandai terlambat.
const closeTime = "21:00";

function isLate(instance: LocalTaskInstance, doneAt: string | undefined) {
  if (!doneAt) return false;
  const [date, time] = new Date(doneAt)
    .toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" })
    .split(" ");
  return (
    date > instance.due_date ||
    (date === instance.due_date && time >= closeTime)
  );
}

// T-08: orang tua menyetujui atau menolak tugas yang sudah dicentang. Persetujuan
// diputuskan server, jadi halaman ini butuh internet.
export default function ApprovalsPage() {
  const t = useMessages();
  const language = useLanguage();
  const session = useSession();
  const active = useActiveMember();
  const [me, setMe] = useState<MyFamily | null>();
  const [selected, setSelected] = useState<string[]>([]);
  // G-01: cek acak. Poin sudah masuk saat dicentang; orang tua cukup mengecek beberapa.
  const [sample, setSample] = useState<string[]>();
  const [rejecting, setRejecting] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setMe, () => setMe(null));
  }, [session]);

  const data = useLiveQuery(async () => {
    const pending = (await localDb.task_instances.toArray())
      .filter((i) => i.status === "done" && !i.deleted_at)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    const completions = await localDb.task_completions
      .where("instance_id")
      .anyOf(pending.map((i) => i.id))
      .toArray();
    return {
      pending,
      // Centang terakhir per tugas.
      lastCompletion: new Map(
        completions
          .sort((a, b) => a.done_at.localeCompare(b.done_at))
          .map((c) => [c.instance_id, c]),
      ),
      templates: new Map(
        (await localDb.task_templates.toArray()).map((r) => [r.id, r]),
      ),
      members: new Map((await localDb.members.toArray()).map((r) => [r.id, r])),
    };
  }, []);

  const role = active?.role ?? me?.role;
  if (!me) return null;
  if (role !== "father" && role !== "mother") {
    return <p className="p-6">{t.parentsOnly}</p>;
  }

  async function review(ids: string[], approve: boolean, reason?: string) {
    if (!navigator.onLine) return setError(t.needsOnline);
    setBusy(true);
    setError("");
    const { error } = await supabase.rpc("review_tasks", {
      instance_ids: ids,
      approve,
      reason: reason ?? null,
    });
    if (error) setError(error.message);
    else {
      setSelected([]);
      setRejecting(undefined);
      await sync();
    }
    setBusy(false);
  }

  const allPending = data?.pending ?? [];
  const pending = sample
    ? allPending.filter((i) => sample.includes(i.id))
    : allPending;
  const pickSample = () =>
    setSample(
      [...allPending]
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((i) => i.id),
    );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t.approvals}</h1>
      <p className="text-sm opacity-70">{t.approvalsHint}</p>
      {data && allPending.length === 0 && <p>{t.nothingToReview}</p>}
      {allPending.length > 3 && (
        <button
          type="button"
          onClick={() => (sample ? setSample(undefined) : pickSample())}
          className="w-fit rounded-md border px-4 py-2"
        >
          {sample ? t.showAll : t.randomCheck}
        </button>
      )}
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              review(
                pending.map((i) => i.id),
                true,
              )
            }
            className={buttonClass}
          >
            {t.approveAll} ({pending.length})
          </button>
          <button
            type="button"
            disabled={busy || selected.length === 0}
            onClick={() => review(selected, true)}
            className="rounded-md border px-4 py-2 disabled:opacity-50"
          >
            {t.approveSelected} ({selected.length})
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {pending.map((instance) => {
          const template = data?.templates.get(instance.template_id);
          const completion = data?.lastCompletion.get(instance.id);
          const doer = completion && data?.members.get(completion.member_id);
          const assignee =
            instance.assignee_id && data?.members.get(instance.assignee_id);
          const title = template
            ? language === "en"
              ? template.title_en
              : template.title_id
            : "…";
          return (
            <li
              key={instance.id}
              className="flex flex-col gap-2 rounded-md border p-3"
            >
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(instance.id)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, instance.id]
                        : selected.filter((id) => id !== instance.id),
                    )
                  }
                />
                <span className="flex flex-col">
                  <span className="font-medium">{title}</span>
                  <span className="text-sm opacity-70">
                    {instance.due_date}
                    {assignee && ` · ${assignee.display_name}`}
                    {template &&
                      ` · ${template.points} ${t.points.toLowerCase()}`}
                  </span>
                  {completion && (
                    <span className="text-sm">
                      {t.doneBy}: {doer?.display_name},{" "}
                      {new Date(completion.done_at).toLocaleString(
                        language === "en" ? "en-GB" : "id-ID",
                        {
                          timeZone: "Asia/Jakarta",
                          dateStyle: "short",
                          timeStyle: "short",
                        },
                      )}
                      {isLate(instance, completion.done_at) && (
                        <strong className="ml-2 text-amber-700">
                          {t.late}
                        </strong>
                      )}
                    </span>
                  )}
                  {completion?.note && (
                    <span className="text-sm">“{completion.note}”</span>
                  )}
                </span>
              </label>
              {completion?.photo_path && (
                <StoragePhoto
                  bucket="task-photos"
                  path={completion.photo_path}
                />
              )}
              {rejecting === instance.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const reason = String(
                      new FormData(event.currentTarget).get("reason"),
                    );
                    void review([instance.id], false, reason);
                  }}
                  className="flex flex-col gap-2 text-sm"
                >
                  <label className="flex flex-col gap-1">
                    {t.rejectReason}
                    <input name="reason" required className={inputClass} />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={busy}
                      className={buttonClass}
                    >
                      {t.reject}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejecting(undefined)}
                      className="rounded-md border px-4 py-2"
                    >
                      {t.cancel}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => review([instance.id], true)}
                    className="rounded-md border px-3 py-1 text-sm"
                  >
                    {t.approve}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(instance.id)}
                    className="rounded-md border px-3 py-1 text-sm text-red-600"
                  >
                    {t.reject}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
