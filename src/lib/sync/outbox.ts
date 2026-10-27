// Inti antrean perubahan (outbox). Tidak bergantung pada Dexie atau Supabase supaya
// bisa dites di Node.

export type Row = Record<string, unknown> & { id: string };
export type OutboxEntry = { seq?: number; table: string; row: Row };

export interface OutboxStore {
  /** Semua entri, urut dari yang paling lama. */
  list(): Promise<OutboxEntry[]>;
  remove(seq: number): Promise<void>;
}

/**
 * Mengirim antrean satu per satu sesuai urutan. Berhenti di kegagalan pertama
 * (misalnya masih offline) supaya urutan tetap terjaga; sisanya dicoba lagi nanti.
 * Server menyimpan dengan upsert berdasarkan `id`, jadi entri yang terkirim dua kali
 * (misalnya aplikasi tertutup sebelum entri dihapus) tidak membuat data ganda.
 * Mengembalikan jumlah entri yang terkirim.
 */
export async function pushOutbox(
  store: OutboxStore,
  send: (entry: OutboxEntry) => Promise<void>,
): Promise<number> {
  let sent = 0;
  for (const entry of await store.list()) {
    try {
      await send(entry);
    } catch (error) {
      console.warn("Sync: pengiriman tertunda", error);
      return sent;
    }
    await store.remove(entry.seq!);
    sent++;
  }
  return sent;
}
