"use client";

import { useEffect } from "react";
import { loadMyFamily, useSession } from "@/lib/auth";
import { clearLocal, setFinanceAccess, startSync } from "@/lib/sync/sync";

// Menjalankan sinkron data selama ada pengguna yang login (F-10).
export function SyncProvider() {
  const session = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (session === null) void clearLocal();
  }, [session]);

  useEffect(() => {
    if (!userId) return;
    return startSync();
  }, [userId]);

  // Data keuangan hanya disalin ke perangkat kalau pemilik akunnya ayah atau ibu.
  useEffect(() => {
    if (!session) return setFinanceAccess(false);
    loadMyFamily(session.user).then(
      (me) => setFinanceAccess(me?.role === "father" || me?.role === "mother"),
      () => {},
    );
  }, [session]);

  return null;
}
