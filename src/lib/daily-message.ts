// M-03: pesan yang tampil di Beranda. Pesan hari ini; kalau hari ini belum ada,
// pesan dari tanggal terakhir yang punya pesan.

type Message = {
  message_date: string;
  created_at: string;
  deleted_at: string | null;
};

export const messageBucket = "message-photos";

export function messagesToShow<T extends Message>(
  messages: T[],
  today: string,
) {
  const live = messages.filter((m) => !m.deleted_at && m.message_date <= today);
  const date = live.reduce(
    (d, m) => (m.message_date > d ? m.message_date : d),
    "",
  );
  return live
    .filter((m) => m.message_date === date)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}
