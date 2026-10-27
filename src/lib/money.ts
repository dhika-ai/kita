// Keuangan (K-01): nominal selalu Rupiah dalam bilangan bulat.

/** "Rp 1.250.000", minus jadi "−Rp 400.000" (spasi tidak terputus, supaya tidak pindah baris). */
export const formatRupiah = (amount: number) =>
  `${amount < 0 ? "−" : ""}Rp\u00a0${Math.abs(Math.round(amount)).toLocaleString("id-ID")}`;

/** Angka dari isian: titik/koma/spasi pemisah ribuan diabaikan. NaN kalau bukan bilangan bulat. */
export function parseRupiah(text: string) {
  const digits = text.replace(/[\s.,]|^rp/gi, "");
  return /^\d+$/.test(digits) ? Number(digits) : NaN;
}
