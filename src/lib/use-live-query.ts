"use client";

import { liveQuery } from "dexie";
import { useEffect, useState } from "react";

/** Hasil query ke database lokal yang ikut berubah saat datanya berubah. */
export function useLiveQuery<T>(query: () => Promise<T>, deps: unknown[]) {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    const subscription = liveQuery(query).subscribe(setValue);
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
