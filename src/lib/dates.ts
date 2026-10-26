/** Tanggal hari ini di WIB, format YYYY-MM-DD (semua keluarga diasumsikan di WIB). */
export const todayWib = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
