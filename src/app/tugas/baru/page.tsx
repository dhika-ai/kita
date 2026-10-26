"use client";

import { useEffect, useState } from "react";
import { buttonClass, Field, inputClass } from "@/components/auth-form";
import { useLanguage, useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { localDb, type Recurrence } from "@/lib/local-db";
import { supabase } from "@/lib/supabase";
import { sync } from "@/lib/sync/sync";
import { useLiveQuery } from "@/lib/use-live-query";

const schedules: (Recurrence | "once")[] = [
  "once",
  "daily",
  "weekly",
  "monthly",
];
const weekdays = [1, 2, 3, 4, 5, 6, 7] as const;

const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

// T-06: tugas ad-hoc (sekali) atau kebiasaan berulang. Orang tua untuk siapa saja;
// anak hanya kebiasaan pribadi untuk dirinya sendiri; ART tidak bisa membuat tugas.
export default function NewTaskPage() {
  const t = useMessages();
  const language = useLanguage();
  const session = useSession();
  const active = useActiveMember();
  const [me, setMe] = useState<MyFamily | null>();
  const [schedule, setSchedule] = useState<Recurrence | "once">("once");
  const [days, setDays] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setMe, () => setMe(null));
  }, [session]);

  const options = useLiveQuery(
    async () => ({
      categories: (await localDb.categories.toArray()).filter(
        (c) => !c.deleted_at,
      ),
      areas: (await localDb.areas.toArray()).filter((a) => !a.deleted_at),
      members: (await localDb.members.toArray()).filter(
        (m) => !m.deleted_at && m.is_active,
      ),
    }),
    [],
  );

  const role = active?.role ?? me?.role;
  const myId = active?.id ?? me?.memberId;
  const isChild = role === "child";
  if (!me || !role) return null;
  if (role === "art") return <p className="p-6">{t.cannotCreateTask}</p>;

  const name = (row: { name_en: string; name_id: string }) =>
    language === "en" ? row.name_en : row.name_id;
  const byName = <T extends { name_en: string; name_id: string }>(rows: T[]) =>
    [...rows].sort((a, b) => name(a).localeCompare(name(b)));
  const categories = byName(
    (options?.categories ?? []).filter(
      (c) => !isChild || c.kind === "personal_habit",
    ),
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (schedule === "weekly" && days.length === 0)
      return setError(t.pickWeekday);
    if (!navigator.onLine) return setError(t.needsOnline);
    const text = (key: string) => String(form.get(key) ?? "").trim();

    setBusy(true);
    setError("");
    setMessage("");
    const { error } = await supabase.rpc("create_task", {
      title_id: text("title_id"),
      title_en: text("title_en"),
      category_id: text("category_id"),
      area_id: text("area_id"),
      assignee_id: isChild ? myId : text("assignee_id"),
      points: isChild ? 0 : Number(text("points")),
      recurrence: schedule === "once" ? null : schedule,
      weekdays: schedule === "weekly" ? [...days].sort() : null,
      month_day: schedule === "monthly" ? Number(text("month_day")) : null,
      due_date: schedule === "once" ? text("due_date") : today(),
    });
    setBusy(false);
    if (error) return setError(error.message);
    setMessage(schedule === "once" ? t.taskCreated : t.habitCreated);
    formElement.reset();
    setSchedule("once");
    setDays([]);
    void sync();
  }

  const select = (
    key: string,
    label: string,
    rows: { id: string; label: string }[],
    defaultValue = "",
  ) => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <select
        name={key}
        required
        defaultValue={defaultValue}
        className={inputClass}
      >
        <option value="">{t.choose}</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t.newTask}</h1>
      {isChild && <p className="text-sm opacity-70">{t.childHabitHint}</p>}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label={t.title} name="title_id" />
        <Field label={t.titleEnOptional} name="title_en" required={false} />
        {select(
          "category_id",
          t.category,
          categories.map((c) => ({ id: c.id, label: name(c) })),
        )}
        {select(
          "area_id",
          t.area,
          byName(options?.areas ?? []).map((a) => ({
            id: a.id,
            label: name(a),
          })),
        )}
        {!isChild &&
          select(
            "assignee_id",
            t.assignee,
            (options?.members ?? []).map((m) => ({
              id: m.id,
              label: m.display_name,
            })),
          )}
        <label className="flex flex-col gap-1 text-sm">
          {t.schedule}
          <select
            value={schedule}
            onChange={(event) =>
              setSchedule(event.target.value as Recurrence | "once")
            }
            className={inputClass}
          >
            {schedules.map((value) => (
              <option key={value} value={value}>
                {value === "once" ? t.once : t[`recurrence_${value}`]}
              </option>
            ))}
          </select>
        </label>
        {schedule === "once" && (
          <Field
            label={t.dueDate}
            name="due_date"
            type="date"
            defaultValue={today()}
          />
        )}
        {schedule === "weekly" && (
          <fieldset className="flex flex-col gap-1 text-sm">
            <legend>{t.weekdays}</legend>
            <div className="flex flex-wrap gap-1">
              {weekdays.map((day) => (
                <label
                  key={day}
                  className="flex items-center gap-1 rounded-md border px-2 py-1"
                >
                  <input
                    type="checkbox"
                    checked={days.includes(day)}
                    onChange={(event) =>
                      setDays(
                        event.target.checked
                          ? [...days, day]
                          : days.filter((d) => d !== day),
                      )
                    }
                  />
                  {t[`weekday_${day}`]}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {schedule === "monthly" && (
          <Field
            label={t.monthDay}
            name="month_day"
            type="number"
            min={1}
            max={31}
            defaultValue={1}
          />
        )}
        {!isChild && (
          <Field
            label={t.points}
            name="points"
            type="number"
            min={0}
            defaultValue={0}
          />
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {t.save}
        </button>
      </form>
    </main>
  );
}
