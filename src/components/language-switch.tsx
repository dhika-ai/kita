"use client";

import { useEffect } from "react";
import { languages } from "@/i18n/messages";
import { setLanguage, useLanguage, useMessages } from "@/i18n/language";

export function LanguageSwitch() {
  const language = useLanguage();
  const t = useMessages();

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <div role="group" aria-label={t.languageLabel} className="flex gap-1">
      {languages.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLanguage(code)}
          aria-pressed={code === language}
          className="rounded-md border px-3 py-1 text-sm uppercase aria-pressed:bg-foreground aria-pressed:text-background"
        >
          {code}
        </button>
      ))}
    </div>
  );
}
