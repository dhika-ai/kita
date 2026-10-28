// Tampilan bersama untuk halaman daftar dan masuk.
export const inputClass = "rounded-md border px-3 py-2 text-base";
// Aksi utama: satu per layar, hijau solid supaya paling menonjol.
export const buttonClass =
  "rounded-md bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-50";
// Aksi pendukung: garis abu-abu, lebih tenang dari aksi utama.
export const secondaryButtonClass =
  "rounded-md border border-gray-300 px-4 py-2 text-gray-600";

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & React.ComponentProps<"input">) {
  return (
    <label className="flex flex-col gap-1 text-left text-sm">
      {label}
      <input className={inputClass} required {...input} />
      {hint && <span className="text-xs opacity-70">{hint}</span>}
    </label>
  );
}
