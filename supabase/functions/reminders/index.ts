// R-04: dipanggil pg_cron pukul 07:00 dan 17:00 WIB untuk mengirim pengingat Telegram.
// Body: {"slot": "morning" | "evening"}. Header x-kita-cron harus sama dengan rahasia
// kita_cron_secret di Supabase Vault (dibuat otomatis oleh migrasi).
import { botToken, rpc, telegram } from "../_shared/api.ts";
import { sendAll, type Reminder } from "./send.ts";

Deno.serve(async (req) => {
  const ok = await rpc("check_cron_secret", {
    secret: req.headers.get("x-kita-cron") ?? "",
  });
  if (ok !== true) return new Response("Unauthorized", { status: 401 });
  if (!botToken) {
    return new Response("TELEGRAM_BOT_TOKEN belum diisi", { status: 503 });
  }

  const { slot } = (await req.json()) as { slot: string };
  const reminders = (await rpc("reminder_messages", { slot })) as Reminder[];
  const result = await sendAll(reminders, async ({ chat_id, text }) => {
    const res = await telegram("sendMessage", { chat_id, text });
    return res.ok ? null : `${res.status} ${await res.text()}`;
  });
  return Response.json(result);
});
