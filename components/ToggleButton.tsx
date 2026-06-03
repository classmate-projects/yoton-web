"use client";

type ToggleButtonProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
};

export default function ToggleButton({
  checked,
  onChange,
  disabled = false,
  id,
  className = "",
}: ToggleButtonProps) {
  const trackStateClass = disabled
    ? checked
      ? "bg-primary/60 border-primary/70"
      : "bg-slate-300 border-slate-400"
    : checked
      ? "bg-primary border-primary"
      : "bg-muted border-border";

  return (
    <button
      id={id}
      type="button"
      role="switch"
      title={`${checked ? "Active" : "Inactive"}`}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${trackStateClass} ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      } ${className}`}
    >
      <span
        className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-1 ring-black/5 transition-transform duration-300 ease-spring ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}
