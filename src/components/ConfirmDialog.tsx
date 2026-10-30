"use client";
// Confirmation d'une action destructive, a la place de la fenetre confirm() du
// navigateur : fond floute, carte sombre arrondie, Annuler / action en rouge.
// Ferme par Echap, par un clic a cote (mousedown ET mouseup sur le fond : un
// glisser-selectionner parti de la carte ne ferme pas) et par Annuler.
//
// Usage :
//   const [pending, setPending] = useState<Row | null>(null);
//   <ConfirmDialog
//     open={pending !== null}
//     title={`Retirer ${pending?.name} de l'équipe ?`}
//     description="Elle n'apparaîtra plus au générique du film."
//     confirmLabel="Retirer"
//     onConfirm={() => { run(pending); setPending(null); }}
//     onCancel={() => setPending(null)}
//   />
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cardSpring } from "@/components/motion";
import Button from "@/components/ui/Button";

const subscribeNothing = () => () => {};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Annuler",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const reduced = useReducedMotion();
  // false au rendu serveur et a l'hydratation : le portail n'existe que dans le navigateur.
  const isClient = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const pressedOnBackdrop = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  // Le focus part sur « Annuler » : Entree ne confirme jamais par megarde.
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  // Porte dans <body> : un ancetre en verre (backdrop-filter) ou en cours
  // d'animation deviendrait sinon le bloc conteneur de ce position: fixed.
  if (!isClient) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => { pressedOnBackdrop.current = e.target === e.currentTarget; }}
          onClick={(e) => {
            if (e.target === e.currentTarget && pressedOnBackdrop.current) onCancel();
            pressedOnBackdrop.current = false;
          }}
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[20px]"
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={description ? "confirm-dialog-description" : undefined}
            initial={{ opacity: 0, scale: reduced ? 1 : 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.95 }}
            transition={reduced ? { duration: 0.15 } : cardSpring}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong w-full max-w-[380px] rounded-panel bg-glass-solid/80 p-6"
          >
            <h3 id="confirm-dialog-title" className="text-lg font-semibold leading-snug text-text-primary">{title}</h3>
            {description && (
              <p id="confirm-dialog-description" className="mt-2 text-sm leading-relaxed text-text-secondary">{description}</p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <Button ref={cancelRef} variant="glass" onClick={onCancel} disabled={busy} className="sm:min-w-28">
                {cancelLabel}
              </Button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="press-spring inline-flex min-h-11 items-center justify-center rounded-pill bg-[#b91c1c] px-5 text-sm font-bold text-white hover:bg-[#c81e1e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-200 disabled:pointer-events-none disabled:opacity-50 sm:min-w-28"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
