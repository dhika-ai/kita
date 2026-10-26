// R-01: webhook bot Telegram (Supabase Edge Function).
// Secret yang dibutuhkan: TELEGRAM_BOT_TOKEN (dari BotFather).
// R-02: "/start <kode>" menghubungkan chat ini ke anggota lewat fungsi link_telegram.
// Daftarkan webhook sekali dengan membuka <url fungsi>?setup=1 di browser.
import {
  languageOf,
  linkReply,
  startCode,
  startReply,
  webhookSecret,
  type TelegramUpdate,
} from "./bot.ts";
import { botToken as token, rpc, telegram } from "../_shared/api.ts";

const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram`;

Deno.serve(async (req) => {
  if (!token)
    return new Response("TELEGRAM_BOT_TOKEN belum diisi", { status: 503 });
  const secret = await webhookSecret(token);

  if (req.method === "GET" && new URL(req.url).searchParams.has("setup")) {
    const res = await telegram("setWebhook", {
      url: functionUrl,
      secret_token: secret,
      allowed_updates: ["message"],
    });
    return new Response(await res.text(), { status: res.status });
  }

  if (req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const update = (await req.json()) as TelegramUpdate;
  const message = update.message;
  if (message?.text?.startsWith("/start")) {
    const code = startCode(message.text);
    const text = code
      ? linkReply(
          (await rpc("link_telegram", { code, chat_id: message.chat.id }))[0],
          languageOf(update),
        )
      : startReply(languageOf(update));
    await telegram("sendMessage", { chat_id: message.chat.id, text });
  }
  return new Response("ok");
});
