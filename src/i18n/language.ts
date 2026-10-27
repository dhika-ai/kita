"use client";

import { useSyncExternalStore } from "react";
import {
  defaultLanguage,
  languages,
  messages,
  type Language,
} from "./messages";

// Untuk sekarang pilihan bahasa disimpan di perangkat (localStorage).
// Setelah login ada (F-05), pilihan ini juga disimpan di profil anggota.
const storageKey = "kita.language";
const listeners = new Set<() => void>();

function read(): Language {
  try {
    const saved = localStorage.getItem(storageKey) as Language | null;
    return saved && languages.includes(saved) ? saved : defaultLanguage;
  } catch {
    return defaultLanguage;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLanguage(language: Language) {
  try {
    localStorage.setItem(storageKey, language);
  } catch {
    // Penyimpanan diblokir: bahasa tetap berganti sampai halaman dimuat ulang.
  }
  document.documentElement.lang = language;
  listeners.forEach((listener) => listener());
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, read, () => defaultLanguage);
}

export function useMessages() {
  return messages[useLanguage()];
}
