// Tampilan bersama untuk halaman daftar dan masuk.
export const inputClass = "rounded-md border px-3 py-2 text-base";
export const buttonClass =
  "rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50";

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
