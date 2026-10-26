// Logika bot yang tidak bergantung pada Deno, supaya bisa dites dengan `node --test`.

export type Language = "id" | "en";

export type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
    from?: { language_code?: string };
  };
};

/** Bahasa balasan sebelum akun terhubung: Inggris hanya jika Telegram-nya berbahasa Inggris. */
export function languageOf(update: TelegramUpdate): Language {
  return update.message?.from?.language_code?.startsWith("en") ? "en" : "id";
}

/** Kode sambung dari "/start <kode>" (tautan t.me/<bot>?start=<kode>), atau null. */
export function startCode(text: string | undefined): string | null {
  const match = text?.match(/^\/start(?:@\w+)?\s+(\S+)/);
  return match ? match[1] : null;
}

/** Balasan setelah kode ditukar: berhasil (ada nama anggota) atau kode tidak berlaku. */
export function linkReply(
  member: { display_name: string; language: Language } | undefined,
  fallback: Language,
): string {
  if (!member) {
    return fallback === "en"
      ? "This code is invalid or expired. Open KITA and tap Connect Telegram again."
      : "Kode ini salah atau sudah kedaluwarsa. Buka KITA lalu ketuk Hubungkan Telegram lagi.";
  }
  return member.language === "en"
    ? `Connected! ${member.display_name} will get reminders here at 07:00 and 17:00.`
    : `Terhubung! ${member.display_name} akan menerima pengingat di sini pukul 07:00 dan 17:00.`;
}

/** Balasan untuk perintah /start tanpa kode. */
export function startReply(language: Language): string {
  return language === "en"
    ? "Hi! This is the KITA bot. To receive daily reminders, open KITA and tap Connect Telegram."
    : "Halo! Ini bot KITA. Supaya dapat pengingat harian, buka aplikasi KITA lalu ketuk Hubungkan Telegram.";
}

/**
 * Rahasia webhook diturunkan dari token bot, jadi cukup satu secret yang diisi.
 * Telegram mengirimnya di header X-Telegram-Bot-Api-Secret-Token.
 */
export async function webhookSecret(token: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`kita-webhook:${token}`),
  );
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
