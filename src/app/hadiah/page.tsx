"use client";

import { useEffect, useState } from "react";
import { buttonClass, inputClass } from "@/components/auth-form";
import { useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { localDb } from "@/lib/local-db";
import { supabase } from "@/lib/supabase";
import { useLiveQuery } from "@/lib/use-live-query";

type Reward = { id: string; name: string; cost: number; is_active: boolean };
type Request = {
  id: string;
  reward_id: string;
  member_id: string;
  cost: number;
  status: "pending" | "approved" | "rejected";
};

// G-04: katalog hadiah. Ayah/Ibu mengelola katalog dan menyetujui penukaran; anak dan
// ART menukar poin. Saldo dicek di database, jadi tidak pernah negatif. Butuh internet.
export default function RewardsPage() {
  const t = useMessages();
  const session = useSession();
  const active = useActiveMember();
  const [me, setMe] = useState<MyFamily | null>();
  const [rewards, setRewards] = useState<Reward[]>();
  const [requests, setRequests] = useState<Request[]>([]);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setMe, () => setMe(null));
  }, [session]);

  const members = useLiveQuery(() => localDb.members.toArray(), []);

  const role = active?.role ?? me?.role;
  const memberId = active?.id ?? me?.memberId;

  useEffect(() => {
    if (!session || !memberId) return;
    void (async () => {
      if (!navigator.onLine) return setError(t.needsOnline);
      const [catalog, asked, balances] = await Promise.all([
        supabase
          .from("rewards")
          .select("id, name, cost, is_active")
          .order("cost"),
        supabase
          .from("reward_requests")
          .select("id, reward_id, member_id, cost, status")
          .order("created_at", { ascending: false }),
        supabase
          .from("point_balances")
          .select("balance")
          .eq("member_id", memberId),
      ]);
      setError(
        catalog.error?.message ??
          asked.error?.message ??
          balances.error?.message ??
          "",
      );
      setRewards(catalog.data ?? undefined);
      setRequests(asked.data ?? []);
      setBalance(balances.data?.[0]?.balance ?? 0);
    })();
  }, [session, memberId, version, t]);

  if (!me || !memberId) return null;
  const isParent = role === "father" || role === "mother";
  const name = (id: string) =>
    members?.find((m) => m.id === id)?.display_name ?? "";
  const rewardName = (id: string) =>
    rewards?.find((r) => r.id === id)?.name ?? "";
  // Poin yang sedang menunggu persetujuan belum bisa dipakai lagi.
  const held = requests
    .filter((q) => q.member_id === memberId && q.status === "pending")
    .reduce((n, q) => n + q.cost, 0);
  const shownRequests = requests.filter(
    (q) => isParent || q.member_id === memberId,
  );

  async function run(call: PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    const { error } = await call;
    setBusy(false);
    setError(error?.message ?? "");
    setVersion((v) => v + 1);
    return !error;
  }

  async function addReward(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const ok = await run(
      supabase.from("rewards").insert({
        family_id: me!.familyId,
        name: String(form.get("name")).trim(),
        cost: Number(form.get("cost")),
      }),
    );
    if (ok) formElement.reset();
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t.rewardsPage}</h1>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!isParent && (
        <p>
          {t.balance}: <strong>{balance - held}</strong>
        </p>
      )}
      {rewards?.length === 0 && <p className="opacity-70">{t.noRewards}</p>}
      {rewards && (
        <ul className="flex flex-col gap-2">
          {rewards
            .filter((r) => isParent || r.is_active)
            .map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-md border p-3"
              >
                <span className="flex flex-col">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-sm opacity-70">
                    {r.cost} {t.points}
                    {!r.is_active && ` · ${t.hiddenReward}`}
                  </span>
                </span>
                {isParent ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="text-sm underline"
                    onClick={() =>
                      run(
                        supabase
                          .from("rewards")
                          .update({ is_active: !r.is_active })
                          .eq("id", r.id),
                      )
                    }
                  >
                    {r.is_active ? t.hideReward : t.showReward}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy || balance - held < r.cost}
                    className={buttonClass}
                    onClick={() =>
                      run(supabase.rpc("request_reward", { reward_id: r.id }))
                    }
                  >
                    {t.redeem}
                  </button>
                )}
              </li>
            ))}
        </ul>
      )}
      {rewards && isParent && (
        <form
          onSubmit={addReward}
          className="flex flex-col gap-2 rounded-md border p-3"
        >
          <h2 className="font-medium">{t.addReward}</h2>
          <label className="flex flex-col gap-1 text-sm">
            {t.rewardName}
            <input name="name" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t.rewardCost}
            <input
              name="cost"
              type="number"
              min={1}
              required
              className={inputClass}
            />
          </label>
          <button type="submit" disabled={busy} className={buttonClass}>
            {t.addReward}
          </button>
        </form>
      )}
      {rewards && (
        <>
          <h2 className="font-medium">{t.rewardRequests}</h2>
          {shownRequests.length === 0 && (
            <p className="opacity-70">{t.noRewardRequests}</p>
          )}
          <ul className="flex flex-col gap-2">
            {shownRequests.map((q) => (
              <li
                key={q.id}
                className="flex flex-col gap-2 border-b pb-2 text-sm"
              >
                <span>
                  {isParent && `${name(q.member_id)} · `}
                  {rewardName(q.reward_id)} · {q.cost} {t.points}
                </span>
                <span className="opacity-70">{t[`request_${q.status}`]}</span>
                {isParent && q.status === "pending" && (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      className={`${buttonClass} flex-1`}
                      onClick={() =>
                        run(
                          supabase.rpc("decide_reward", {
                            request_id: q.id,
                            approve: true,
                          }),
                        )
                      }
                    >
                      {t.approve}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="flex-1 rounded-md border px-4 py-2"
                      onClick={() =>
                        run(
                          supabase.rpc("decide_reward", {
                            request_id: q.id,
                            approve: false,
                          }),
                        )
                      }
                    >
                      {t.reject}
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
