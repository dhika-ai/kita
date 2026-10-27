// R-04: dipanggil pg_cron pukul 07:00 dan 17:00 WIB untuk mengirim pengingat.
// Body: {"slot": "morning" | "evening"}. Header x-kita-cron harus sama dengan rahasia
// kita_cron_secret di Supabase Vault (dibuat otomatis oleh migrasi).
// R-05: setiap hasil kiriman dicatat di reminder_log.
// P-02: dikirim sebagai push notification (bukan Telegram lagi). Butuh secret
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, dan VAPID_SUBJECT (mailto:...) di Supabase.
// web-push dipakai karena pesan push harus dienkripsi dan ditandatangani (RFC 8291/8292).
import webpush from "npm:web-push@3.6.7";
import { rpc } from "../_shared/api.ts";
import { sendAll, type Reminder } from "./send.ts";

const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const subject = Deno.env.get("VAPID_SUBJECT") ?? "";

Deno.serve(async (req) => {
  const ok = await rpc("check_cron_secret", {
    secret: req.headers.get("x-kita-cron") ?? "",
  });
  if (ok !== true) return new Response("Unauthorized", { status: 401 });
  if (!publicKey || !privateKey || !subject) {
    return new Response("Secret VAPID belum diisi", { status: 503 });
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const { slot } = (await req.json()) as { slot: string };
  const reminders = (await rpc("push_reminders", { slot })) as Reminder[];
  const result = await sendAll(
    reminders,
    async ({ endpoint, p256dh, auth }, text) => {
      try {
        await webpush.sendNotification(
          { endpoint, keys: { p256dh, auth } },
          JSON.stringify({ title: "KITA", body: text }),
          { TTL: 60 * 60 * 6 },
        );
        return null;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) return "gone";
        return `${status ?? ""} ${(e as Error).message}`.trim();
      }
    },
    ({ endpoint }) => rpc("forget_push_subscription", { endpoint }),
    ({ member_id }, error) => rpc("log_reminder", { member_id, slot, error }),
  );
  return Response.json(result);
});
