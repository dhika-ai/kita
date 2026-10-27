"use client";

import JSZip from "jszip";
import { useEffect, useState } from "react";
import { buttonClass, inputClass } from "@/components/auth-form";
import { useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { isBackup, photoFiles, zipPath, type Backup } from "@/lib/backup";
import { todayWib } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import { sync } from "@/lib/sync/sync";

const dataFile = "kita-backup.json";

// B-01: Ayah/Ibu mengunduh semua data keluarga + foto dalam satu ZIP, dan bisa
// memulihkannya dari file itu. Butuh internet.
export default function BackupPage() {
  const t = useMessages();
  const session = useSession();
  const active = useActiveMember();
  const [me, setMe] = useState<MyFamily | null>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<{ zip: JSZip; backup: Backup }>();

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setMe, () => setMe(null));
  }, [session]);

  const role = active?.role ?? me?.role;
  if (!session || !me) return null;
  if (role !== "father" && role !== "mother") return null;

  async function run(work: () => Promise<void>) {
    if (!navigator.onLine) return setError(t.needsOnline);
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const download = () =>
    run(async () => {
      const { data, error } = await supabase.rpc("export_backup");
      if (error) throw error;
      const backup = data as Backup;
      const zip = new JSZip();
      zip.file(dataFile, JSON.stringify(backup, null, 2));
      const files = photoFiles(backup);
      for (const [i, file] of files.entries()) {
        setStatus(
          t.backupWorking
            .replace("{done}", String(i + 1))
            .replace("{total}", String(files.length)),
        );
        // Foto yang sudah tidak ada di Storage dilewati.
        const { data: blob } = await supabase.storage
          .from(file.bucket)
          .download(file.path);
        if (blob) zip.file(zipPath(file), blob);
      }
      const url = URL.createObjectURL(
        await zip.generateAsync({ type: "blob" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `kita-backup-${todayWib()}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(t.backupDone);
    });

  const pick = (file: File | undefined) =>
    run(async () => {
      setPicked(undefined);
      if (!file) return;
      const zip = await JSZip.loadAsync(file).catch(() => null);
      const text = await zip?.file(dataFile)?.async("string");
      const backup: unknown = text ? JSON.parse(text) : null;
      if (!zip || !isBackup(backup)) throw new Error(t.notBackup);
      setPicked({ zip, backup });
    });

  const restore = () =>
    run(async () => {
      const { zip, backup } = picked!;
      // Foto diunggah dulu supaya data yang dipulihkan langsung bisa menampilkannya.
      const files = photoFiles(backup);
      for (const [i, file] of files.entries()) {
        setStatus(
          t.backupWorking
            .replace("{done}", String(i + 1))
            .replace("{total}", String(files.length)),
        );
        const blob = await zip.file(zipPath(file))?.async("blob");
        // Foto yang masih ada ditolak Storage (tidak boleh ditimpa), dan itu tidak apa-apa.
        if (blob)
          await supabase.storage.from(file.bucket).upload(file.path, blob, {
            contentType: "image/jpeg",
          });
      }
      const { error } = await supabase.rpc("restore_backup", { backup });
      if (error) throw error;
      await sync();
      setPicked(undefined);
      setStatus(t.restoreDone);
    });

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t.backup}</h1>
      <section className="flex flex-col gap-2 rounded-md border p-3">
        <p className="text-sm opacity-70">{t.backupHint}</p>
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className={buttonClass}
        >
          {t.downloadBackup}
        </button>
      </section>
      <section className="flex flex-col gap-2 rounded-md border p-3">
        <p className="text-sm opacity-70">{t.restoreHint}</p>
        <input
          type="file"
          accept=".zip,application/zip"
          aria-label={t.restoreBackup}
          disabled={busy}
          onChange={(event) => pick(event.target.files?.[0])}
          className={inputClass}
        />
        {picked && (
          <>
            <p className="text-sm">
              {t.restoreConfirm}{" "}
              <strong>{picked.backup.exported_at.slice(0, 10)}</strong>?
            </p>
            <button
              type="button"
              onClick={restore}
              disabled={busy}
              className={buttonClass}
            >
              {t.restoreBackup}
            </button>
          </>
        )}
      </section>
      {status && <p className="text-sm">{status}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </main>
  );
}
