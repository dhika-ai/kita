"use client";

import { useState } from "react";
import { inputClass } from "@/components/auth-form";
import { useLanguage, useMessages } from "@/i18n/language";
import { useSession } from "@/lib/auth";
import { datesIn, scheduledOn, shift, type CalendarView } from "@/lib/calendar";
import { todayWib } from "@/lib/dates";
import { localDb, type TaskStatus } from "@/lib/local-db";
import { useLiveQuery } from "@/lib/use-live-query";

const views: CalendarView[] = ["day", "week", "month"];

type Entry = {
  key: string;
  date: string;
  templateId: string;
  assigneeId: string | null;
  assignedById: string | null;
  // Tanpa status: jadwal rutin yang tugasnya belum dibuat (tanggal mendatang).
  status?: TaskStatus;
};

// T-09: kalender harian/mingguan/bulanan, siapa memberi tugas ke siapa.
export default function CalendarPage() {
  const t = useMessages();
  const language = useLanguage();
  const session = useSession();
  const [view, setView] = useState<CalendarView>("week");
  const [picked, setAnchor] = useState<string>();
  const [memberId, setMemberId] = useState("");
  const [areaId, setAreaId] = useState("");

  const data = useLiveQuery(
    async () => ({
      instances: (await localDb.task_instances.toArray()).filter(
        (i) => !i.deleted_at,
      ),
      templates: (await localDb.task_templates.toArray()).filter(
        (r) => !r.deleted_at,
      ),
      members: (await localDb.members.toArray()).filter((r) => !r.deleted_at),
      areas: (await localDb.areas.toArray()).filter((r) => !r.deleted_at),
    }),
    [],
  );

  if (!session || !data) return null;

  const today = todayWib();
  const anchor = picked ?? today;
  const dates = datesIn(view, anchor);
  const templates = new Map(data.templates.map((r) => [r.id, r]));
  const members = new Map(data.members.map((r) => [r.id, r]));
  const name = (id: string | null) =>
    (id && members.get(id)?.display_name) || "";

  const entries: Entry[] = dates.flatMap((date) => {
    const existing = data.instances
      .filter((i) => i.due_date === date)
      .map((i) => ({
        key: i.id,
        date,
        templateId: i.template_id,
        assigneeId: i.assignee_id,
        assignedById: i.assigned_by_id,
        status: i.status,
      }));
    if (date <= today) return existing;
    // Tugas rutin mendatang belum dibuat job harian; tampilkan dari jadwal template.
    const planned = data.templates
      .filter(
        (r) =>
          scheduledOn(r, date) && !existing.some((e) => e.templateId === r.id),
      )
      .map((r) => ({
        key: `${r.id}-${date}`,
        date,
        templateId: r.id,
        assigneeId: r.default_assignee_id,
        assignedById: null,
      }));
    return [...existing, ...planned];
  });

  const shown = entries.filter(
    (e) =>
      (!memberId || e.assigneeId === memberId) &&
      (!areaId || templates.get(e.templateId)?.area_id === areaId),
  );

  const label = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString(
      language === "en" ? "en-GB" : "id-ID",
      { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" },
    );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t.calendar}</h1>
      <div className="flex gap-1">
        {views.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-md border px-3 py-1 text-sm ${v === view ? "bg-foreground text-background" : ""}`}
          >
            {t[`view_${v}`]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setAnchor(shift(view, anchor, -1))}
          className="rounded-md border px-3 py-1 text-sm"
          aria-label={t.previous}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => setAnchor(today)}
          className="rounded-md border px-3 py-1 text-sm"
        >
          {t.goToday}
        </button>
        <button
          type="button"
          onClick={() => setAnchor(shift(view, anchor, 1))}
          className="rounded-md border px-3 py-1 text-sm"
          aria-label={t.next}
        >
          ›
        </button>
        <span className="ml-2 text-sm">
          {view === "month"
            ? new Date(`${anchor}T00:00:00Z`).toLocaleDateString(
                language === "en" ? "en-GB" : "id-ID",
                { timeZone: "UTC", month: "long", year: "numeric" },
              )
            : `${dates[0]}${dates.length > 1 ? ` – ${dates[dates.length - 1]}` : ""}`}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label={t.allMembers}
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
          className={inputClass}
        >
          <option value="">{t.allMembers}</option>
          {data.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
        <select
          aria-label={t.allAreas}
          value={areaId}
          onChange={(event) => setAreaId(event.target.value)}
          className={inputClass}
        >
          <option value="">{t.allAreas}</option>
          {data.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {language === "en" ? a.name_en : a.name_id}
            </option>
          ))}
        </select>
      </div>
      {shown.length === 0 && <p className="opacity-70">{t.noTasksInRange}</p>}
      {dates
        .filter((date) => shown.some((e) => e.date === date))
        .map((date) => (
          <section key={date} className="flex flex-col gap-2">
            <h2 className={`font-medium ${date === today ? "underline" : ""}`}>
              {label(date)}
            </h2>
            <ul className="flex flex-col gap-1">
              {shown
                .filter((e) => e.date === date)
                .map((e) => {
                  const template = templates.get(e.templateId);
                  return (
                    <li
                      key={e.key}
                      className={`flex flex-wrap justify-between gap-x-2 rounded-md border p-2 text-sm ${e.status ? "" : "border-dashed opacity-70"}`}
                    >
                      <span className="font-medium">
                        {template
                          ? language === "en"
                            ? template.title_en
                            : template.title_id
                          : "…"}
                      </span>
                      <span>
                        {e.assignedById && `${name(e.assignedById)} → `}
                        {name(e.assigneeId) || t.unassigned}
                        {" · "}
                        {e.status ? t[`status_${e.status}`] : t.scheduled}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
    </main>
  );
}
