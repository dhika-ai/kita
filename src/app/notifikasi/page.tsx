"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/auth-form";
import { useLanguage, useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { localDb } from "@/lib/local-db";
import { pushSupported, subscribePush } from "@/lib/push";
import { supabase } from "@/lib/supabase";
import { sync } from "@/lib/sync/sync";
import { useLiveQuery } from "@/lib/use-live-query";

// P-01: HP ini berlangganan push notification untuk anggota yang dipilih. Ayah/ibu
// bisa memilih anggota lain, jadi pengingat si kecil ikut masuk ke HP orang tua.
// P-02: pengingat pagi dan sore bisa dimatikan masing-masing (sama seperti R-05).
export default function NotificationsPage() {
  const t = useMessages();
  const language = useLanguage();
  const session = useSession();
  const active = useActiveMember();
  const [me, setMe] = useState<MyFamily | null>();
  const [chosen, setChosen] = useState<string[]>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setMe, () => setMe(null));
  }, [session]);

  const role = active?.role ?? me?.role;
  const memberId = active?.id ?? me?.memberId;
  const isParent = role === "father" || role === "mother";
  const members = useLiveQuery(
    async () =>
      (await localDb.members.toArray())
        .filter((m) => m.is_active && !m.deleted_at)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [],
  );
  const choices = (members ?? []).filter((m) => isParent || m.id === memberId);

  // Pilihan yang sudah tersimpan untuk HP ini (kalau sudah pernah berlangganan).
  useEffect(() => {
    if (!memberId || !pushSupported() || !navigator.onLine) return;
    void (async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const current = await registration?.pushManager.getSubscription();
      if (!current) return;
      const { data } = await supabase.rpc("push_members", {
        endpoint: current.endpoint,
      });
      if (data?.length) {
        setChosen(data as string[]);
        setStatus(t.notificationsOn);
      }
    })();
  }, [memberId, t.notificationsOn]);

  if (!session || !me || !memberId) return null;
  const selected = chosen ?? [memberId];
  const self = members?.find((m) => m.id === memberId);

  async function setMuted(slot: "morning" | "evening", muted: boolean) {
    if (!navigator.onLine) return setError(t.needsOnline);
    setBusy(true);
    setError("");
    const { error } = await supabase.rpc("set_telegram_mute", {
      member_id: memberId,
      slot,
      muted,
    });
    if (error) setError(error.message);
    await sync();
    setBusy(false);
  }

  async function save() {
    if (!navigator.onLine) return setError(t.needsOnline);
    if (selected.length === 0) return setError(t.chooseMember);
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const subscription = await subscribePush();
      if (!subscription) {
        setError(t.notificationsBlocked);
        return;
      }
      const { endpoint, keys } = subscription.toJSON();
      const { error } = await supabase.rpc("set_push_subscription", {
        endpoint,
        p256dh: keys?.p256dh,
        auth: keys?.auth,
        member_ids: selected,
        language,
      });
      if (error) setError(error.message);
      else setStatus(t.notificationsOn);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t.notifications}</h1>
      <p className="text-sm opacity-70">{t.notificationsHint}</p>
      {!pushSupported() ? (
        <p role="alert" className="text-sm text-red-600">
          {t.notificationsUnsupported}
        </p>
      ) : (
        <>
          <fieldset className="flex flex-col gap-2 rounded-md border p-3">
            <legend className="px-1 text-sm">{t.notificationsFor}</legend>
            {choices.map((m) => (
              <label key={m.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(m.id)}
                  onChange={(event) =>
                    setChosen(
                      event.target.checked
                        ? [...selected, m.id]
                        : selected.filter((id) => id !== m.id),
                    )
                  }
                />
                {m.display_name}
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className={buttonClass}
          >
            {t.enableNotifications}
          </button>
          {self && (
            <div className="flex flex-col gap-2 rounded-md border p-3">
              {(["morning", "evening"] as const).map((slot) => (
                <label key={slot} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!self[`telegram_mute_${slot}`]}
                    disabled={busy}
                    onChange={(event) => setMuted(slot, !event.target.checked)}
                  />
                  {slot === "morning" ? t.reminderMorning : t.reminderEvening}
                </label>
              ))}
            </div>
          )}
        </>
      )}
      {status && <p className="text-sm">{status}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </main>
  );
}
