"use client";

import { useEffect, useState } from "react";
import { buttonClass, inputClass } from "@/components/auth-form";
import { ProgressCard } from "@/components/progress-card";
import { useLanguage, useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { todayWib } from "@/lib/dates";
import { localDb } from "@/lib/local-db";
import { periods, type Targets } from "@/lib/progress";
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

type Target = Targets & { member_id: string };
type Badge = {
  id: string;
  member_id: string;
  kind: "streak_7" | "area_specialist";
  area_id: string | null;
  earned_on: string;
};

// G-01: saldo dan riwayat poin dari point_ledger. G-02: Progress Pribadi terhadap target
// harian/mingguan/bulanan. Ayah/Ibu melihat semua anggota, bisa mengoreksi poin dan
// memasang target; anak dan ART melihat miliknya sendiri. G-03: lencana yang didapat.
// Butuh internet.
export default function PointsPage() {
  const t = useMessages();
  const language = useLanguage();
  const session = useSession();
  const active = useActiveMember();
  const [me, setMe] = useState<MyFamily | null>();
  const [entries, setEntries] = useState<Entry[]>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetFor, setTargetFor] = useState<string>();
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setMe, () => setMe(null));
  }, [session]);

  const areas = useLiveQuery(() => localDb.areas.toArray(), []);
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
    void (async () => {
      if (!navigator.onLine) return setError(t.needsOnline);
      const [ledger, goals, earned] = await Promise.all([
        supabase
          .from("point_ledger")
          .select("id, member_id, points, kind, note, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("point_targets")
          .select("member_id, daily, weekly, monthly"),
        supabase
          .from("badges")
          .select("id, member_id, kind, area_id, earned_on")
          .order("earned_on", { ascending: false }),
      ]);
      setError(ledger.error?.message ?? goals.error?.message ?? "");
      setEntries((ledger.data as Entry[] | null) ?? undefined);
      setTargets(goals.data ?? []);
      setBadges(earned.data ?? []);
    })();
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
  const shownBadges = badges.filter(
    (b) => isParent || b.member_id === memberId,
  );
  const areaName = (id: string | null) => {
    const area = areas?.find((a) => a.id === id);
    return area ? (language === "en" ? area.name_en : area.name_id) : "";
  };
  const name = (id: string) =>
    members?.find((m) => m.id === id)?.display_name ?? "";

  const today = todayWib();
  const editing = targetFor ?? members?.[0]?.id;
  const editingTarget = targets.find((g) => g.member_id === editing);

  async function saveTargets(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => Number(form.get(key)) || null;
    setBusy(true);
    const { error } = await supabase.from("point_targets").upsert({
      family_id: me!.familyId,
      member_id: editing,
      daily: value("daily"),
      weekly: value("weekly"),
      monthly: value("monthly"),
    });
    setBusy(false);
    if (error) return setError(error.message);
    setVersion((v) => v + 1);
  }

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
          <h2 className="font-medium">{t.progressTitle}</h2>
          {shownMembers.map((m) => (
            <ProgressCard
              key={m.id}
              entries={entries}
              memberId={m.id}
              today={today}
              targets={targets.find((g) => g.member_id === m.id)}
              title={isParent ? m.display_name : undefined}
            />
          ))}
        </>
      )}
      {entries && (
        <>
          <h2 className="font-medium">{t.badges}</h2>
          {shownBadges.length === 0 && (
            <p className="text-sm opacity-70">{t.noBadges}</p>
          )}
          <ul className="flex flex-wrap gap-2">
            {shownBadges.map((b) => (
              <li
                key={b.id}
                className="rounded-full border border-amber-500 bg-amber-50 px-3 py-1 text-sm dark:bg-amber-950"
              >
                🏅 {isParent && `${name(b.member_id)} · `}
                {t[`badge_${b.kind}`]}
                {b.area_id && ` · ${areaName(b.area_id)}`}
              </li>
            ))}
          </ul>
        </>
      )}
      {entries && isParent && (
        <form
          onSubmit={saveTargets}
          className="flex flex-col gap-2 rounded-md border p-3"
        >
          <h2 className="font-medium">{t.setTargets}</h2>
          <select
            value={editing}
            onChange={(e) => setTargetFor(e.target.value)}
            className={inputClass}
          >
            {members?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2" key={`${editing}-${version}`}>
            {periods.map((period) => (
              <label key={period} className="flex flex-col gap-1 text-sm">
                {t[`period_${period}`]}
                <input
                  name={period}
                  type="number"
                  min={1}
                  defaultValue={editingTarget?.[period] ?? ""}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
          <span className="text-xs opacity-70">{t.targetHint}</span>
          <button type="submit" disabled={busy} className={buttonClass}>
            {t.saveTargets}
          </button>
        </form>
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
