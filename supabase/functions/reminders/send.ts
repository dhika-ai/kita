// Mengirim pesan satu per satu dan mencatat hasilnya (R-05). Satu kegagalan tidak
// menghentikan pesan lainnya; yang gagal dicoba ulang oleh jadwal 5 menit kemudian.
export type Reminder = { member_id: string; chat_id: number; text: string };

export async function sendAll(
  reminders: Reminder[],
  send: (reminder: Reminder) => Promise<string | null>, // null = berhasil, teks = galat
  log: (reminder: Reminder, error: string | null) => Promise<unknown>,
) {
  const result = { sent: 0, failed: 0 };
  for (const reminder of reminders) {
    let error: string | null;
    try {
      error = await send(reminder);
    } catch (e) {
      error = String(e);
    }
    await log(reminder, error);
    if (error) result.failed++;
    else result.sent++;
  }
  return result;
}
