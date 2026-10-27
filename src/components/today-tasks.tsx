"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/auth-form";
import { StoragePhoto } from "@/components/storage-photo";
import { useLanguage, useMessages } from "@/i18n/language";
import type { Role } from "@/lib/auth";
import { todayWib } from "@/lib/dates";
import {
  localDb,
  type LocalSop,
  type LocalTaskInstance,
  type LocalTaskTemplate,
} from "@/lib/local-db";
import { uploadPhoto } from "@/lib/photo";
import { saveLocal } from "@/lib/sync/sync";
import { useLiveQuery } from "@/lib/use-live-query";

type Me = { id: string; role: Role; familyId: string };

// T-07: tugas hari ini per anggota. Centang disimpan di perangkat dulu (bisa saat
// offline) lalu tersinkron.
export function TodayTasks({ me }: { me: Me }) {
  const t = useMessages();
  const data = useLiveQuery(async () => {
    const today = todayWib();
    const instances = (
      await localDb.task_instances.where("due_date").equals(today).toArray()
    ).filter((i) => !i.deleted_at);
    return {
      instances,
      templates: new Map(
        (await localDb.task_templates.toArray()).map((row) => [row.id, row]),
      ),
      sops: new Map((await localDb.sops.toArray()).map((row) => [row.id, row])),
      members: (await localDb.members.toArray()).filter((m) => !m.deleted_at),
    };
  }, []);

  if (!data) return null;
  if (data.instances.length === 0) {
    return <p className="opacity-70">{t.noTasksToday}</p>;
  }

  // Kelompok per penanggung jawab, tugas milik pengguna sendiri paling atas.
  const groups = [
    ...data.members
      .filter((m) => m.id === me.id)
      .concat(data.members.filter((m) => m.id !== me.id))
      .map((m) => ({ id: m.id, name: m.display_name })),
    { id: null, name: t.unassigned },
  ]
    .map((group) => ({
      ...group,
      tasks: data.instances.filter((i) => i.assignee_id === group.id),
    }))
    .filter((group) => group.tasks.length > 0);

  return (
    <div className="flex w-full flex-col gap-4 text-left">
      {groups.map((group) => (
        <section key={group.id ?? "none"} className="flex flex-col gap-2">
          <h3 className="font-medium">{group.name}</h3>
          <ul className="flex flex-col gap-2">
            {group.tasks.map((instance) => (
              <TaskItem
                key={instance.id}
                instance={instance}
                template={data.templates.get(instance.template_id)}
                sops={data.sops}
                me={me}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TaskItem({
  instance,
  template,
  sops,
  me,
}: {
  instance: LocalTaskInstance;
  template: LocalTaskTemplate | undefined;
  sops: Map<string, LocalSop>;
  me: Me;
}) {
  const t = useMessages();
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  const [showSop, setShowSop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const title = template
    ? language === "en"
      ? template.title_en
      : template.title_id
    : "…";
  const sop = template?.sop_id ? sops.get(template.sop_id) : undefined;
  const canTick =
    (instance.status === "open" || instance.status === "rejected") &&
    (me.role === "father" ||
      me.role === "mother" ||
      instance.assignee_id === me.id);

  async function markDone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("photo") as File | null;
    setBusy(true);
    setError("");
    try {
      let photoPath: string | null = null;
      if (file && file.size > 0) {
        if (!navigator.onLine) throw new Error(t.photoNeedsOnline);
        photoPath = await uploadPhoto(
          "task-photos",
          `${me.familyId}/${instance.id}`,
          file,
        );
      }
      await saveLocal("task_completions", {
        id: crypto.randomUUID(),
        family_id: me.familyId,
        instance_id: instance.id,
        member_id: me.id,
        done_at: new Date().toISOString(),
        note: String(form.get("note") ?? "").trim() || null,
        photo_path: photoPath,
        created_at: new Date().toISOString(),
        deleted_at: null,
      });
      // Tampilan langsung berubah; server mengonfirmasi status saat sync.
      await localDb.task_instances.update(instance.id, { status: "done" });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex flex-col">
          {title}
          <span className="text-sm opacity-70">
            {t[`status_${instance.status}`]}
            {template?.due_time && ` · ${template.due_time.slice(0, 5)}`}
            {(instance.status === "done" || instance.status === "approved") &&
              template && (
                <strong className="ml-2 text-green-700">
                  +{template.points} {t.points.toLowerCase()}
                </strong>
              )}
          </span>
          {instance.status === "open" && instance.rejection_reason && (
            <span className="text-sm text-red-600">
              {t.rejectedBecause}: {instance.rejection_reason}
            </span>
          )}
        </span>
        {canTick && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-md border px-3 py-1 text-sm"
          >
            {t.markDone}
          </button>
        )}
      </div>
      {sop && (
        <button
          type="button"
          onClick={() => setShowSop(!showSop)}
          className="w-fit text-sm underline"
        >
          {showSop ? t.hideSop : t.showSop}
        </button>
      )}
      {sop && showSop && (
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {sop.steps.map((step, index) => (
            <li key={index}>
              <p>{language === "en" ? step.en : step.id}</p>
              {step.photo_path && (
                <StoragePhoto bucket="sop-photos" path={step.photo_path} />
              )}
            </li>
          ))}
        </ol>
      )}
      {open && (
        <form onSubmit={markDone} className="flex flex-col gap-2 text-sm">
          <label className="flex flex-col gap-1">
            {t.note}
            <textarea name="note" rows={2} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            {t.proofPhoto}
            <input name="photo" type="file" accept="image/*" />
          </label>
          {error && (
            <p role="alert" className="text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={buttonClass}>
              {t.markDone}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border px-4 py-2"
            >
              {t.cancel}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
