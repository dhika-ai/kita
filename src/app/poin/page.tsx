"use client";

import { useEffect, useState } from "react";
import { buttonClass, inputClass } from "@/components/auth-form";
import { useLanguage, useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { localDb } from "@/lib/local-db";
import { supabase } from "@/lib/supabase";
import { useLiveQuery } from "@/lib/use-live-query";

type Entry = {
  id: string;
  member_id: string;
  points: number;
  kind: "task" | "revoked" | "correction" | "redeem";
  note: string | null;
  created_at: string;
};

// G-01: saldo dan riwayat poin dari point_ledger. Ayah/Ibu melihat semua anggota dan
// bisa mengoreksi poin; anak dan ART melihat miliknya sendiri. Butuh internet.
export default function PointsPage() {
  const t = useMessages();
  const language = useLanguage();
  const session = useSession();
  const active = useActiveMember();
  const [me, setMe] = useState<MyFamily | null>();
  const [entries, setEntries] = useState<Entry[]>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setMe, () => setMe(null));
  }, [session]);

  const members = useLiveQuery(
    async () =>
      (await localDb.members.toArray()).filter(
        (m) => !m.deleted_at && m.is_active,
      ),
    [],
  );

  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!session) return;
    const request = navigator.onLine
      ? supabase
          .from("point_ledger")
          .select("id, member_id, points, kind, note, created_at")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null, error: { message: t.needsOnline } });
    request.then(({ data, error }) => {
      setError(error?.message ?? "");
      setEntries((data as Entry[] | null) ?? undefined);
    });
  }, [session, version, t]);

  const role = active?.role ?? me?.role;
  const memberId = active?.id ?? me?.memberId;
  if (!me || !memberId) return null;
  const isParent = role === "father" || role === "mother";
  const shownMembers = (members ?? []).filter(
    (m) => isParent || m.id === memberId,
  );
  const shown = (entries ?? []).filter(
    (e) => isParent || e.member_id === memberId,
  );
  const name = (id: string) =>
    members?.find((m) => m.id === id)?.display_name ?? "";

  async function correct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    const { error } = await supabase.rpc("correct_points", {
      member_id: String(form.get("member")),
      points: Number(form.get("points")),
      note: String(form.get("note")),
    });
    setBusy(false);
    if (error) return setError(error.message);
    formElement.reset();
    setVersion((v) => v + 1);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t.pointsPage}</h1>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {entries && (
        <>
          <h2 className="font-medium">{t.balance}</h2>
          <ul className="grid grid-cols-2 gap-2">
            {shownMembers.map((m) => (
              <li key={m.id} className="rounded-md border p-3">
                <div className="text-sm opacity-70">{m.display_name}</div>
                <div className="text-2xl font-bold">
                  {entries
                    .filter((e) => e.member_id === m.id)
                    .reduce((n, e) => n + e.points, 0)}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {entries && isParent && (
        <form
          onSubmit={correct}
          className="flex flex-col gap-2 rounded-md border p-3"
        >
          <h2 className="font-medium">{t.correctPoints}</h2>
          <select name="member" required className={inputClass}>
            {members?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
          <label className="flex flex-col gap-1 text-sm">
            {t.points}
            <input
              name="points"
              type="number"
              required
              className={inputClass}
            />
            <span className="text-xs opacity-70">{t.correctionHint}</span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t.correctionNote}
            <input name="note" required className={inputClass} />
          </label>
          <button type="submit" disabled={busy} className={buttonClass}>
            {t.saveCorrection}
          </button>
        </form>
      )}
      {entries && (
        <>
          <h2 className="font-medium">{t.pointHistory}</h2>
          {shown.length === 0 && <p className="opacity-70">{t.noPoints}</p>}
          <ul className="flex flex-col gap-2">
            {shown.slice(0, 50).map((e) => (
              <li
                key={e.id}
                className="flex items-baseline justify-between gap-2 border-b pb-2 text-sm"
              >
                <span className="flex flex-col">
                  <span>
                    {isParent && `${name(e.member_id)} · `}
                    {t[`kind_${e.kind}`]}
                  </span>
                  {e.note && <span className="opacity-70">{e.note}</span>}
                  <span className="text-xs opacity-70">
                    {new Date(e.created_at).toLocaleString(
                      language === "en" ? "en-GB" : "id-ID",
                      {
                        timeZone: "Asia/Jakarta",
                        dateStyle: "short",
                        timeStyle: "short",
                      },
                    )}
                  </span>
                </span>
                <strong
                  className={e.points > 0 ? "text-green-700" : "text-red-600"}
                >
                  {e.points > 0 ? `+${e.points}` : e.points}
                </strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
