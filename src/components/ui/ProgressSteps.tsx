// Segments d'etapes : le segment actif s'etire de 18 a 56 px.
export default function ProgressSteps({
  total,
  current,
  className = "",
}: {
  total: number;
  /** Index de l'etape active, a partir de 0 */
  current: number;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={`Étape ${current + 1} sur ${total}`}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
      className={`flex items-center gap-1.5 ${className}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-pill transition-[width,background-color] duration-slow ease-glass ${
            i === current ? "w-14 bg-lime" : i < current ? "w-[18px] bg-white/60" : "w-[18px] bg-white/15"
          }`}
        />
      ))}
    </div>
  );
}
