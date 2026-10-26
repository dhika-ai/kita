"use client";

import { useEffect, useState } from "react";
import { useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type MyFamily } from "@/lib/auth";
import { NameList } from "./name-list";
import { SopList } from "./sop-list";

const tabs = ["areas", "categories", "sops"] as const;

// T-03: orang tua mengatur area, kategori, dan SOP. Perubahan disimpan di perangkat
// dulu lalu tersinkron (F-10), jadi bisa juga dilakukan saat offline.
export default function MasterDataPage() {
  const t = useMessages();
  const session = useSession();
  const active = useActiveMember();
  const [me, setMe] = useState<MyFamily | null>();
  const [tab, setTab] = useState<(typeof tabs)[number]>("areas");

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
      <h1 className="text-2xl font-bold">{t.masterData}</h1>
      <div role="tablist" className="flex gap-1">
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
      {tab === "sops" ? (
        <SopList familyId={me.familyId} />
      ) : (
        <NameList key={tab} table={tab} familyId={me.familyId} />
      )}
    </main>
  );
}
