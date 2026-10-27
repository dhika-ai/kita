"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/auth";
import { clearLocal, startSync } from "@/lib/sync/sync";

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

  return null;
}
