"use client";

// P-01: langganan Web Push di HP ini. Kunci publik VAPID (nilai publik) diisi di Vercel;
// pasangan kunci privatnya hanya ada di Supabase untuk mengirim pesan.
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    vapidPublicKey !== ""
  );
}

/** Minta izin notifikasi lalu berlangganan. `null` kalau izin ditolak. */
export async function subscribePush() {
  if ((await Notification.requestPermission()) !== "granted") return null;
  const registration =
    (await navigator.serviceWorker.getRegistration()) ??
    (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  return (
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(vapidPublicKey),
    }))
  );
}

function base64UrlToBytes(text: string) {
  const base64 = text.replaceAll("-", "+").replaceAll("_", "/");
  const raw = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
