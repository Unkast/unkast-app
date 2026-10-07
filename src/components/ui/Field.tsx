import { useId, type InputHTMLAttributes } from "react";

// text-base (16 px) : evite le zoom automatique d'iOS au focus.
export default function Field({
  label,
  id,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
        {label}
      </label>
      <input
        id={inputId}
        className="min-h-11 w-full rounded-card border border-white/10 bg-white/5 px-4 text-base text-text-primary outline-none transition-[border-color,box-shadow]! duration-fast! placeholder:text-text-tertiary focus:ring-3 focus:ring-lime/30 disabled:opacity-50"
        {...props}
      />
    </div>
  );
}
