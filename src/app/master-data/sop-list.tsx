"use client";

import { useEffect, useState } from "react";
import { buttonClass, Field, inputClass } from "@/components/auth-form";
import { useLanguage, useMessages } from "@/i18n/language";
import { localDb, type LocalSop, type SopStep } from "@/lib/local-db";
import { compressPhoto } from "@/lib/photo";
import { supabase } from "@/lib/supabase";
import { saveLocal } from "@/lib/sync/sync";
import { useLiveQuery } from "@/lib/use-live-query";
import { DeleteButton, FormButtons } from "./name-list";

const bucket = "sop-photos";

/** Daftar SOP. Tiap SOP berisi langkah berurutan (EN + ID) dengan foto opsional. */
export function SopList({ familyId }: { familyId: string }) {
  const t = useMessages();
  const language = useLanguage();
  const [editing, setEditing] = useState<LocalSop>();
  const sops = useLiveQuery(
    () => localDb.sops.filter((sop) => !sop.deleted_at).toArray(),
    [],
  );

  const title = (sop: LocalSop) =>
    language === "en" ? sop.title_en : sop.title_id;

  if (editing) {
    return (
      <SopForm
        sop={editing}
        onSave={async (sop) => {
          await saveLocal("sops", sop);
          setEditing(undefined);
        }}
        onCancel={() => setEditing(undefined)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sops && sops.length === 0 && <p className="opacity-70">{t.empty}</p>}
      <ul className="flex flex-col gap-2">
        {[...(sops ?? [])]
          .sort((a, b) => title(a).localeCompare(title(b)))
          .map((sop) => (
            <li
              key={sop.id}
              className="flex items-center justify-between gap-2 rounded-md border p-3"
            >
              <span>
                {title(sop)}
                <span className="ml-2 text-sm opacity-70">
                  {sop.steps.length} {t.steps.toLowerCase()}
                </span>
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(sop)}
                  className="rounded-md border px-3 py-1 text-sm"
                >
                  {t.edit}
                </button>
                <DeleteButton
                  onDelete={() =>
                    saveLocal("sops", {
                      ...sop,
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
            steps: [{ en: "", id: "", photo_path: null }],
            photo_path: null,
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

function SopForm({
  sop,
  onSave,
  onCancel,
}: {
  sop: LocalSop;
  onSave: (sop: LocalSop) => void;
  onCancel: () => void;
}) {
  const t = useMessages();
  const [steps, setSteps] = useState<SopStep[]>(sop.steps);

  const update = (index: number, change: Partial<SopStep>) =>
    setSteps(
      steps.map((step, i) => (i === index ? { ...step, ...change } : step)),
    );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSave({
          ...sop,
          title_en: String(form.get("title_en")).trim(),
          title_id: String(form.get("title_id")).trim(),
          steps: steps
            .map((step) => ({
              ...step,
              en: step.en.trim(),
              id: step.id.trim(),
            }))
            .filter((step) => step.en || step.id || step.photo_path),
        });
      }}
      className="flex flex-col gap-3"
    >
      <Field label={t.titleId} name="title_id" defaultValue={sop.title_id} />
      <Field label={t.titleEn} name="title_en" defaultValue={sop.title_en} />
      <h2 className="font-medium">{t.steps}</h2>
      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => (
          <li key={index} className="flex flex-col gap-2 rounded-md border p-3">
            <span className="text-sm font-medium">
              {t.step} {index + 1}
            </span>
            <label className="flex flex-col gap-1 text-sm">
              {t.stepId}
              <textarea
                value={step.id}
                onChange={(event) => update(index, { id: event.target.value })}
                className={inputClass}
                rows={2}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t.stepEn}
              <textarea
                value={step.en}
                onChange={(event) => update(index, { en: event.target.value })}
                className={inputClass}
                rows={2}
              />
            </label>
            <StepPhoto
              path={step.photo_path}
              folder={`${sop.family_id}/${sop.id}`}
              onChange={(photo_path) => update(index, { photo_path })}
            />
            <div className="flex gap-1">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const next = [...steps];
                    [next[index - 1], next[index]] = [
                      next[index],
                      next[index - 1],
                    ];
                    setSteps(next);
                  }}
                  className="rounded-md border px-3 py-1 text-sm"
                >
                  {t.moveUp}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSteps(steps.filter((_, i) => i !== index))}
                className="rounded-md border px-3 py-1 text-sm text-red-600"
              >
                {t.delete}
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() =>
          setSteps([...steps, { en: "", id: "", photo_path: null }])
        }
        className="rounded-md border px-4 py-2"
      >
        {t.addStep}
      </button>
      <FormButtons onCancel={onCancel} />
    </form>
  );
}

/** Foto satu langkah: unggah (butuh online) dan tampilkan lewat link sementara. */
function StepPhoto({
  path,
  folder,
  onChange,
}: {
  path: string | null;
  folder: string;
  onChange: (path: string | null) => void;
}) {
  const t = useMessages();
  const [url, setUrl] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!path) return;
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl));
  }, [path]);

  async function upload(file: File) {
    if (!navigator.onLine) return setError(t.photoNeedsOnline);
    setBusy(true);
    setError("");
    const newPath = `${folder}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(newPath, await compressPhoto(file), {
        contentType: "image/jpeg",
      });
    setBusy(false);
    if (error) setError(error.message);
    else onChange(newPath);
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      {path && url && (
        // eslint-disable-next-line @next/next/no-img-element -- link sementara dari Supabase
        <img src={url} alt="" className="max-h-48 w-fit rounded-md" />
      )}
      {path ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="w-fit rounded-md border px-3 py-1 text-sm"
        >
          {t.removePhoto}
        </button>
      ) : (
        <label className="flex flex-col gap-1">
          {busy ? t.uploading : t.photo}
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </label>
      )}
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
