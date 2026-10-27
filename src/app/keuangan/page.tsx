"use client";

import { useEffect, useState } from "react";
import { useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { AccountList, PostList } from "./master-lists";

const tabs = ["financeAccounts", "budgetPosts"] as const;

// Keuangan (Rilis 5), hanya untuk ayah dan ibu. K-02: rekening dan pos anggaran.
// Disimpan di perangkat lalu tersinkron (F-10), jadi bisa dipakai saat offline.
export default function FinancePage() {
  const t = useMessages();
  const session = useSession();
  const active = useActiveMember();
  const [me, setMe] = useState<MyFamily | null>();
  const [tab, setTab] = useState<(typeof tabs)[number]>("financeAccounts");

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(setMe, () => setMe(null));
  }, [session]);

  const role = active?.role ?? me?.role;
  if (me === undefined && session !== null) return null;
  if (!me || (role !== "father" && role !== "mother")) {
    return <p className="p-6">{t.parentsOnly}</p>;
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t.finance}</h1>
      <div role="tablist" className="flex flex-wrap gap-1">
        {tabs.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className="rounded-md border px-3 py-1 text-sm aria-selected:bg-foreground aria-selected:text-background"
          >
            {t[name]}
          </button>
        ))}
      </div>
      {tab === "financeAccounts" ? (
        <AccountList familyId={me.familyId} />
      ) : (
        <PostList familyId={me.familyId} />
      )}
    </main>
  );
}
