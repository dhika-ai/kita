"use client";

import { useEffect } from "react";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession } from "@/lib/auth";
import { clearLocal, setFinanceAccess, startSync } from "@/lib/sync/sync";

// Menjalankan sinkron data selama ada pengguna yang login (F-10).
export function SyncProvider() {
  const session = useSession();
  const active = useActiveMember();
  const userId = session?.user.id;

  useEffect(() => {
    if (session === null) void clearLocal();
  }, [session]);

  useEffect(() => {
    if (!userId) return;
    return startSync();
  }, [userId]);

  // K-06: data keuangan hanya ada di perangkat selama pemakainya ayah atau ibu.
  // Anak/ART yang masuk lewat PIN di HP orang tua membuat salinannya dihapus.
  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(
      (me) => {
        const role = active?.role ?? me?.role;
        void setFinanceAccess(role === "father" || role === "mother");
      },
      () => {},
    );
  }, [session, active]);

  return null;
}
