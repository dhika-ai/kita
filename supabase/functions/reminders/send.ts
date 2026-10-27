// Mengirim pesan satu per satu. Satu kegagalan tidak menghentikan pesan lainnya.
export type Reminder = { member_id: string; chat_id: number; text: string };

export async function sendAll(
  reminders: Reminder[],
  send: (reminder: Reminder) => Promise<string | null>, // null = berhasil, teks = galat
) {
  const result = { sent: 0, failed: 0 };
  for (const reminder of reminders) {
    let error: string | null;
    try {
      error = await send(reminder);
    } catch (e) {
      error = String(e);
    }
    if (error) result.failed++;
    else result.sent++;
  }
  return result;
}
