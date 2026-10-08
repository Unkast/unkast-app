"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ROLE_CATEGORIES, POPULAR_ROLES, ALL_ROLES } from "@/lib/constants";
import { RoleIcon } from "@/components/icons/RoleIcons";
import type { RoleIconName } from "@/components/icons/RoleIcons";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Field from "@/components/ui/Field";

interface Props {
  selectedRoles: string[];
  onChange: (roles: string[]) => void;
  maxSelection?: number;
  placeholder?: string;
  singleSelect?: boolean;
}

function normalize(str: string): string {
  return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const SECTION_LABEL = "font-mono text-[11px] uppercase tracking-widest text-text-tertiary";

const CloseIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true" className="shrink-0">
    <path d="M6 18 18 6M6 6l12 12" />
  </svg>
);

// Chip de selection retirable. Le premier metier d'une selection multiple est le
// titre principal (ordre du tableau selectedRoles, jamais reordonne ici).
function SelectedChip({ role, primary, onRemove }: { role: string; primary: boolean; onRemove: () => void }) {
  return (
    <Chip
      onClick={onRemove}
      aria-pressed={undefined}
      aria-label={`Retirer ${role}${primary ? " (titre principal)" : ""}`}
      className={`max-w-full pr-3 ${primary ? "border-lime/40 text-text-primary" : ""}`}
    >
      {primary && (
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-lime">Titre principal</span>
      )}
      <span className="truncate">{role}</span>
      {CloseIcon}
    </Chip>
  );
}

export default function RoleSelector({
  selectedRoles,
  onChange,
  maxSelection = 5,
  placeholder = "Rechercher un métier...",
  singleSelect = false,
}: Props) {
  const reduced = useReducedMotion();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Le portail n'est monte qu'apres la premiere ouverture (rien a hydrater avant).
  const [portalMounted, setPortalMounted] = useState(false);
  const [query, setQuery] = useState("");
  // Fermeture au clic exterieur : seulement si mousedown ET mouseup ont lieu sur le fond
  // (un glisser de selection de texte commence dans la feuille ne doit pas fermer).
  const downOnBackdrop = useRef(false);

  const atMax = selectedRoles.length >= maxSelection;

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setQuery("");
  }, []);

  // Feuille ouverte : scroll du body bloque, Echap pour fermer
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSheet(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [sheetOpen, closeSheet]);

  const toggleRole = useCallback((role: string) => {
    if (singleSelect) {
      onChange([role]);
      closeSheet();
      return;
    }
    if (selectedRoles.includes(role)) {
      onChange(selectedRoles.filter((r) => r !== role));
    } else if (!atMax) {
      onChange([...selectedRoles, role]);
    }
  }, [singleSelect, selectedRoles, onChange, atMax, closeSheet]);

  const removeRole = (role: string) => onChange(selectedRoles.filter((r) => r !== role));

  const searching = query.length > 0;
  const normalizedQuery = normalize(query);
  const searchResults = query.length >= 2
    ? ALL_ROLES.filter((r) => normalize(r).includes(normalizedQuery))
    : [];

  // Familles affichees : toutes, ou seulement celles qui contiennent un resultat
  const groups = ROLE_CATEGORIES.map((cat) => ({
    cat,
    roles: searching ? cat.roles.filter((r) => searchResults.includes(r)) : cat.roles,
  })).filter((g) => g.roles.length > 0);

  const customRole = query.trim();
  const canAddCustom = customRole.length > 2 && !selectedRoles.includes(customRole) && selectedRoles.length < maxSelection;

  const roleChip = (role: string) => {
    const selected = selectedRoles.includes(role);
    return (
      <Chip
        key={role}
        selected={selected}
        disabled={atMax && !selected}
        onClick={() => toggleRole(role)}
        className="disabled:cursor-not-allowed disabled:opacity-35"
      >
        {role}
      </Chip>
    );
  };

  const triggerLabel = singleSelect
    ? selectedRoles[0] || "Sélectionner un métier..."
    : "Sélectionner tes métiers...";

  return (
    <>
      {/* Selection visible (multiple) : Chip retirables, le premier = titre principal */}
      {!singleSelect && selectedRoles.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {selectedRoles.map((role, i) => (
            <SelectedChip key={role} role={role} primary={i === 0} onRemove={() => removeRole(role)} />
          ))}
        </div>
      )}

      {/* Declencheur */}
      <button
        type="button"
        onClick={() => { setPortalMounted(true); setSheetOpen(true); }}
        aria-haspopup="dialog"
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-card border border-white/10 bg-white/5 px-4 text-left text-base transition-[border-color]! duration-fast! hover:border-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
      >
        <span className={`truncate ${singleSelect && selectedRoles[0] ? "text-text-primary" : "text-text-tertiary"}`}>
          {triggerLabel}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-text-secondary">
          {!singleSelect && (
            <span className={`font-mono text-[11px] ${atMax ? "text-lime" : ""}`}>
              {selectedRoles.length} / {maxSelection}
            </span>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {/* Feuille. Portail sur le body : un ancetre en verre (backdrop-filter) ou en cours
          d'animation (transform) deviendrait sinon le repere du position: fixed. */}
      {portalMounted &&
        createPortal(
          <AnimatePresence>
            {sheetOpen && (
              <motion.div
                key="role-sheet"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
                onClick={(e) => {
                  if (downOnBackdrop.current && e.target === e.currentTarget) closeSheet();
                  downOnBackdrop.current = false;
                }}
                className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-[20px] sm:items-center sm:p-6"
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-label={singleSelect ? "Choisis un métier" : "Choisis tes métiers"}
                  initial={reduced ? { opacity: 0 } : { y: 40, opacity: 0 }}
                  animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1 }}
                  exit={reduced ? { opacity: 0 } : { y: 40, opacity: 0 }}
                  transition={{ duration: reduced ? 0.15 : 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                  className="glass-strong flex max-h-[88dvh] w-full flex-col rounded-t-panel rounded-b-none border-b-0 bg-glass-solid/85 sm:max-h-[80dvh] sm:max-w-xl sm:rounded-panel sm:border-b"
                >
                  {/* En-tete fixe */}
                  <div className="shrink-0 px-4 pt-3 sm:px-6 sm:pt-5">
                    <div className="mx-auto mb-3 h-1 w-9 rounded-pill bg-white/15 sm:hidden" aria-hidden="true" />
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sheen text-xl font-bold">
                        {singleSelect ? "Choisis un métier" : "Choisis tes métiers"}
                      </h2>
                      <Button size="sm" onClick={closeSheet}>Valider</Button>
                    </div>

                    {selectedRoles.length > 0 && (
                      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 py-1 sm:-mx-6 sm:px-6">
                        {selectedRoles.map((role, i) => (
                          <SelectedChip
                            key={role}
                            role={role}
                            primary={!singleSelect && i === 0}
                            onRemove={() => removeRole(role)}
                          />
                        ))}
                      </div>
                    )}

                    {!singleSelect && (
                      <p className={`mt-2 text-right font-mono text-[11px] ${atMax ? "text-lime" : "text-text-tertiary"}`}>
                        {selectedRoles.length} / {maxSelection}{atMax ? " · Maximum atteint" : ""}
                      </p>
                    )}

                    <Field
                      aria-label={placeholder}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onClear={() => setQuery("")}
                      placeholder={placeholder}
                      className="mt-2"
                      icon={
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                        </svg>
                      }
                    />
                  </div>

                  {/* Contenu defilant */}
                  <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
                    {searching && query.length < 2 && (
                      <p className="py-4 text-sm text-text-tertiary">Tape au moins 2 caractères...</p>
                    )}

                    {searching && query.length >= 2 && searchResults.length === 0 && (
                      <div className="py-4 text-center">
                        <p className="mb-4 text-sm text-text-secondary">Aucun résultat pour &laquo; {query} &raquo;</p>
                        {canAddCustom && (
                          <button
                            type="button"
                            onClick={() => onChange(singleSelect ? [customRole] : [...selectedRoles, customRole])}
                            className="glass w-full rounded-card border-dashed border-lime/30 px-4 py-3 text-left hover:border-lime/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
                          >
                            <span className="block text-sm font-medium text-lime">+ Ajouter &laquo; {customRole} &raquo;</span>
                            <span className="mt-0.5 block text-xs text-text-secondary">Ce métier sera ajouté à ton profil.</span>
                          </button>
                        )}
                      </div>
                    )}

                    {!searching && !singleSelect && (
                      <section className="mb-5">
                        <p className={`${SECTION_LABEL} mb-2.5`}>Populaires</p>
                        <div className="flex flex-wrap gap-2">{POPULAR_ROLES.map(roleChip)}</div>
                      </section>
                    )}

                    {(!searching || searchResults.length > 0) &&
                      groups.map(({ cat, roles }) => {
                        const count = cat.roles.filter((r) => selectedRoles.includes(r)).length;
                        return (
                          <section key={cat.id} className="mb-5 last:mb-0">
                            <div className="mb-2.5 flex items-center gap-2">
                              <RoleIcon name={cat.icon as RoleIconName} size={16} color={cat.accent} />
                              <h3 className="text-sm font-semibold text-text-primary">{cat.label}</h3>
                              <span className="font-mono text-[11px] text-text-tertiary">
                                {count > 0 ? `${count} / ${cat.roles.length}` : cat.roles.length}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">{roles.map(roleChip)}</div>
                          </section>
                        );
                      })}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
