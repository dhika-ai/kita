// R-01: webhook bot Telegram (Supabase Edge Function).
// Secret yang dibutuhkan: TELEGRAM_BOT_TOKEN (dari BotFather).
// Daftarkan webhook sekali dengan membuka <url fungsi>?setup=1 di browser.
import {
  languageOf,
  startReply,
  webhookSecret,
  type TelegramUpdate,
} from "./bot.ts";

const token = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram`;

function telegram(method: string, body: unknown) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

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
    await telegram("sendMessage", {
      chat_id: message.chat.id,
      text: startReply(languageOf(update)),
    });
  }
  return new Response("ok");
});
