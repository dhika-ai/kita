"use client";

import { LanguageSwitch } from "@/components/language-switch";
import { useMessages } from "@/i18n/language";

export default function Home() {
  const t = useMessages();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-4xl font-bold">KITA</h1>
      <p className="max-w-md text-base opacity-80">{t.appTagline}</p>
      <LanguageSwitch />
    </main>
  );
}
