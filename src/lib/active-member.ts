"use client";

import { useSyncExternalStore } from "react";
import type { Role } from "./auth";

// Anak atau ART yang sedang memakai perangkat orang tua setelah memasukkan PIN (F-07).
// Disimpan di perangkat. Kosong berarti pemilik akun yang sedang memakai.
export type ActiveMember = { id: string; displayName: string; role: Role };

const storageKey = "kita.activeMember";
const listeners = new Set<() => void>();

// useSyncExternalStore butuh nilai yang sama selama isi penyimpanan tidak berubah.
let cachedRaw: string | null = null;
let cached: ActiveMember | null = null;

function read(): ActiveMember | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(storageKey);
  } catch {}
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = raw ? (JSON.parse(raw) as ActiveMember) : null;
  }
  return cached;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setActiveMember(member: ActiveMember | null) {
  try {
    if (member) localStorage.setItem(storageKey, JSON.stringify(member));
    else localStorage.removeItem(storageKey);
  } catch {}
  listeners.forEach((listener) => listener());
}

export function useActiveMember() {
  return useSyncExternalStore(subscribe, read, () => null);
}
