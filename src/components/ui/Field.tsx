import { useId, type ComponentProps, type ReactNode } from "react";

// text-base (16 px) : evite le zoom automatique d'iOS au focus.
const CONTROL =
  "w-full text-base text-text-primary outline-none transition-[border-color,box-shadow]! duration-fast! placeholder:text-text-tertiary focus:ring-3 focus:ring-lime/30 disabled:opacity-50";

// lg : grand champ en verre (recherche).
const SIZES = {
  md: { control: "min-h-11 rounded-card border border-white/10 bg-white/5 px-4", icon: "left-4", withIcon: "pl-11" },
  lg: { control: "glass min-h-14 rounded-panel px-5", icon: "left-5", withIcon: "pl-13" },
} as const;

// Sans label visible, passer un aria-label. onClear affiche le bouton d'effacement
// tant que le champ a une valeur. multiline rend un <textarea>.
type FieldProps = {
  label?: ReactNode;
  icon?: ReactNode;
  onClear?: () => void;
  size?: keyof typeof SIZES;
} & (({ multiline?: false } & Omit<ComponentProps<"input">, "size">) | ({ multiline: true } & ComponentProps<"textarea">));

export default function Field({ label, icon, onClear, size = "md", multiline, id, className = "", ...props }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const s = SIZES[size];
  const clearable = Boolean(onClear && props.value);
  const control = `${CONTROL} ${s.control} ${icon ? s.withIcon : ""} ${clearable ? "pr-12" : ""}`;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span aria-hidden="true" className={`pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 text-text-secondary ${s.icon}`}>
            {icon}
          </span>
        )}
        {multiline ? (
          <textarea id={inputId} className={`${control} block resize-none py-3`} {...(props as ComponentProps<"textarea">)} />
        ) : (
          <input id={inputId} className={control} {...(props as ComponentProps<"input">)} />
        )}
        {clearable && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Effacer"
            className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-pill text-text-secondary hover:text-text-primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
