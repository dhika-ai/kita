"use client";

import { useState } from "react";
import { buttonClass, Field, inputClass } from "@/components/auth-form";
import { useLanguage, useMessages } from "@/i18n/language";
import {
  localDb,
  type ChoreType,
  type LocalTaskTemplate,
  type Recurrence,
} from "@/lib/local-db";
import { saveLocal } from "@/lib/sync/sync";
import { useLiveQuery } from "@/lib/use-live-query";
import { DeleteButton, FormButtons } from "./name-list";

const choreTypes: ChoreType[] = ["routine", "periodic", "adhoc"];
const recurrences: (Recurrence | "none")[] = [
  "none",
  "daily",
  "weekly",
  "monthly",
];
const weekdays = [1, 2, 3, 4, 5, 6, 7] as const;

/** Data pilihan untuk form: hanya master data yang masih aktif (DoD 1). */
function useOptions() {
  const language = useLanguage();
  const active = <T extends { deleted_at: string | null }>(rows: T[]) =>
    rows.filter((row) => !row.deleted_at);
  const options = useLiveQuery(
    async () => ({
      categories: active(await localDb.categories.toArray()),
      areas: active(await localDb.areas.toArray()),
      sops: active(await localDb.sops.toArray()),
      members: active(await localDb.members.toArray()).filter(
        (m) => m.is_active,
      ),
    }),
    [],
  );
  const label = (row: {
    name_en?: string;
    name_id?: string;
    title_en?: string;
    title_id?: string;
  }) =>
    (language === "en"
      ? (row.name_en ?? row.title_en)
      : (row.name_id ?? row.title_id)) ?? "";
  const sorted = <T extends object>(rows: T[] | undefined) =>
    [...(rows ?? [])].sort((a, b) => label(a).localeCompare(label(b)));
  return {
    categories: sorted(options?.categories),
    areas: sorted(options?.areas),
    sops: sorted(options?.sops),
    members: options?.members ?? [],
    label,
  };
}

// T-04: template tugas. Kategori dan area wajib dipilih dari master data.
export function TemplateList({ familyId }: { familyId: string }) {
  const t = useMessages();
  const language = useLanguage();
  const options = useOptions();
  const [editing, setEditing] = useState<LocalTaskTemplate>();
  const templates = useLiveQuery(
    () => localDb.task_templates.filter((row) => !row.deleted_at).toArray(),
    [],
  );

  if (editing) {
    return (
      <TemplateForm
        template={editing}
        options={options}
        onSave={async (template) => {
          await saveLocal("task_templates", template);
          setEditing(undefined);
        }}
        onCancel={() => setEditing(undefined)}
      />
    );
  }

  const title = (row: LocalTaskTemplate) =>
    language === "en" ? row.title_en : row.title_id;
  const areaName = (id: string) =>
    options.label(options.areas.find((area) => area.id === id) ?? {});

  return (
    <div className="flex flex-col gap-3">
      {templates && templates.length === 0 && (
        <p className="opacity-70">{t.empty}</p>
      )}
      <ul className="flex flex-col gap-2">
        {[...(templates ?? [])]
          .sort((a, b) => title(a).localeCompare(title(b)))
          .map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 rounded-md border p-3"
            >
              <span className="flex flex-col">
                {title(row)}
                <span className="text-sm opacity-70">
                  {scheduleText(row, t)} · {areaName(row.area_id)} ·{" "}
                  {row.points} {t.points.toLowerCase()}
                </span>
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(row)}
                  className="rounded-md border px-3 py-1 text-sm"
                >
                  {t.edit}
                </button>
                <DeleteButton
                  onDelete={() =>
                    saveLocal("task_templates", {
                      ...row,
                      deleted_at: new Date().toISOString(),
                    })
                  }
                />
              </span>
            </li>
          ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          setEditing({
            id: crypto.randomUUID(),
            family_id: familyId,
            title_en: "",
            title_id: "",
            category_id: "",
            area_id: "",
            sop_id: null,
            chore_type: "routine",
            recurrence: "daily",
            weekdays: null,
            month_day: null,
            due_time: null,
            default_assignee_id: null,
            points: 0,
            requires_approval: true,
            created_at: new Date().toISOString(),
            deleted_at: null,
          })
        }
        className={buttonClass}
      >
        {t.add}
      </button>
    </div>
  );
}

type Messages = ReturnType<typeof useMessages>;

function scheduleText(row: LocalTaskTemplate, t: Messages) {
  const base = t[`recurrence_${row.recurrence ?? "none"}`];
  if (row.recurrence === "weekly") {
    return `${base}: ${(row.weekdays ?? []).map((d) => t[`weekday_${d as (typeof weekdays)[number]}`]).join(", ")}`;
  }
  if (row.recurrence === "monthly") return `${base}: ${row.month_day}`;
  return base;
}

function TemplateForm({
  template,
  options,
  onSave,
  onCancel,
}: {
  template: LocalTaskTemplate;
  options: ReturnType<typeof useOptions>;
  onSave: (template: LocalTaskTemplate) => void;
  onCancel: () => void;
}) {
  const t = useMessages();
  const [recurrence, setRecurrence] = useState<Recurrence | "none">(
    template.recurrence ?? "none",
  );
  const [days, setDays] = useState<number[]>(template.weekdays ?? []);
  const [error, setError] = useState("");

  // Data lama bisa saja sudah dihapus dari master data: kosongkan supaya dipilih ulang.
  const valid = (id: string | null, rows: { id: string }[]) =>
    id && rows.some((row) => row.id === id) ? id : "";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (recurrence === "weekly" && days.length === 0) {
      return setError(t.pickWeekday);
    }
    const text = (name: string) => String(form.get(name) ?? "").trim();
    onSave({
      ...template,
      title_en: text("title_en"),
      title_id: text("title_id"),
      category_id: text("category_id"),
      area_id: text("area_id"),
      sop_id: text("sop_id") || null,
      chore_type: text("chore_type") as ChoreType,
      recurrence: recurrence === "none" ? null : recurrence,
      weekdays: recurrence === "weekly" ? [...days].sort() : null,
      month_day: recurrence === "monthly" ? Number(text("month_day")) : null,
      due_time: text("due_time") || null,
      default_assignee_id: text("default_assignee_id") || null,
      points: Number(text("points")),
      requires_approval: form.get("requires_approval") === "on",
    });
  }

  const select = (
    name: string,
    label: string,
    rows: { id: string }[],
    value: string | null,
    rowLabel: (row: never) => string,
    required: boolean,
  ) => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <select
        name={name}
        required={required}
        defaultValue={valid(value, rows)}
        className={inputClass}
      >
        <option value="">{required ? t.choose : t.none}</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {rowLabel(row as never)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field
        label={t.titleId}
        name="title_id"
        defaultValue={template.title_id}
      />
      <Field
        label={t.titleEn}
        name="title_en"
        defaultValue={template.title_en}
      />
      {select(
        "category_id",
        t.category,
        options.categories,
        template.category_id,
        options.label,
        true,
      )}
      {select(
        "area_id",
        t.area,
        options.areas,
        template.area_id,
        options.label,
        true,
      )}
      {select(
        "sop_id",
        t.sop,
        options.sops,
        template.sop_id,
        options.label,
        false,
      )}
      <label className="flex flex-col gap-1 text-sm">
        {t.choreType}
        <select
          name="chore_type"
          defaultValue={template.chore_type}
          className={inputClass}
        >
          {choreTypes.map((type) => (
            <option key={type} value={type}>
              {t[`chore_${type}`]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t.schedule}
        <select
          value={recurrence}
          onChange={(event) =>
            setRecurrence(event.target.value as Recurrence | "none")
          }
          className={inputClass}
        >
          {recurrences.map((value) => (
            <option key={value} value={value}>
              {t[`recurrence_${value}`]}
            </option>
          ))}
        </select>
      </label>
      {recurrence === "weekly" && (
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
      {recurrence === "monthly" && (
        <Field
          label={t.monthDay}
          name="month_day"
          type="number"
          min={1}
          max={31}
          defaultValue={template.month_day ?? 1}
        />
      )}
      <label className="flex flex-col gap-1 text-sm">
        {t.dueTime}
        <input
          name="due_time"
          type="time"
          defaultValue={template.due_time?.slice(0, 5) ?? ""}
          className={inputClass}
        />
      </label>
      {select(
        "default_assignee_id",
        t.assignee,
        options.members,
        template.default_assignee_id,
        (member: { display_name: string }) => member.display_name,
        false,
      )}
      <Field
        label={t.points}
        name="points"
        type="number"
        min={0}
        defaultValue={template.points}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="requires_approval"
          defaultChecked={template.requires_approval}
        />
        {t.requiresApproval}
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <FormButtons onCancel={onCancel} />
    </form>
  );
}
