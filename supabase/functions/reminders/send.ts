// Mengirim pesan satu per satu dan mencatat hasilnya (R-05). Satu kegagalan tidak
// menghentikan pesan lainnya; yang gagal dicoba ulang oleh jadwal 5 menit kemudian.
// P-02: satu pesan bisa masuk ke beberapa HP (misalnya pengingat si kecil ke HP ayah
// dan HP ibu). Terkirim kalau minimal satu HP menerimanya.
export type Subscription = { endpoint: string; p256dh: string; auth: string };
export type Reminder = {
  member_id: string;
  text: string;
  subscriptions: Subscription[];
};

// Hasil kirim ke satu HP: null = berhasil, "gone" = langganan sudah tidak berlaku,
// teks lain = galat.
export type PushResult = null | "gone" | string;

export async function sendAll(
  reminders: Reminder[],
  push: (subscription: Subscription, text: string) => Promise<PushResult>,
  forget: (subscription: Subscription) => Promise<unknown>,
  log: (reminder: Reminder, error: string | null) => Promise<unknown>,
) {
  const result = { sent: 0, failed: 0 };
  for (const reminder of reminders) {
    const errors: string[] = [];
    let delivered = false;
    for (const subscription of reminder.subscriptions) {
      let outcome: PushResult;
      try {
        outcome = await push(subscription, reminder.text);
      } catch (e) {
        outcome = String(e);
      }
      if (outcome === null) delivered = true;
      else if (outcome === "gone") {
        await forget(subscription);
        errors.push("langganan kedaluwarsa");
      } else errors.push(outcome);
    }
    const error = delivered ? null : errors.join("; ") || "tidak ada HP";
    await log(reminder, error);
    if (error) result.failed++;
    else result.sent++;
  }
  return result;
}
