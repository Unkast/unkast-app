"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ROLE_CATEGORIES, POPULAR_ROLES, ALL_ROLES } from "@/lib/constants";
import { RoleIcon } from "@/components/icons/RoleIcons";
import type { RoleIconName } from "@/components/icons/RoleIcons";

interface Props {
  selectedRoles: string[];
  onChange: (roles: string[]) => void;
  maxSelection?: number;
  placeholder?: string;
  singleSelect?: boolean;
}

function normalize(str: string): string {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function findCategoryForRole(role: string): (typeof ROLE_CATEGORIES)[0] | undefined {
  return ROLE_CATEGORIES.find((cat) => cat.roles.includes(role));
}

type View = "categories" | "category" | "search";

export default function RoleSelector({
  selectedRoles,
  onChange,
  maxSelection = 5,
  placeholder = "Rechercher un métier...",
  singleSelect = false,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [view, setView] = useState<View>("categories");
  const [activeCategory, setActiveCategory] = useState<(typeof ROLE_CATEGORIES)[0] | null>(null);
  const [query, setQuery] = useState("");

  const atMax = selectedRoles.length >= maxSelection;

  // Reset state when sheet closes
  useEffect(() => {
    if (!sheetOpen) {
      setView("categories");
      setActiveCategory(null);
      setQuery("");
    }
  }, [sheetOpen]);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [sheetOpen]);

  const toggleRole = useCallback((role: string) => {
    if (singleSelect) {
      onChange([role]);
      setSheetOpen(false);
      return;
    }
    if (selectedRoles.includes(role)) {
      onChange(selectedRoles.filter((r) => r !== role));
    } else if (!atMax) {
      onChange([...selectedRoles, role]);
    }
  }, [singleSelect, selectedRoles, onChange, atMax]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (val.length > 0) {
      setView("search");
    } else if (activeCategory) {
      setView("category");
    } else {
      setView("categories");
    }
  };

  const clearSearch = () => {
    setQuery("");
    setView(activeCategory ? "category" : "categories");
  };

  const normalizedQuery = normalize(query);
  const searchResults = query.length >= 2
    ? ALL_ROLES.filter((r) => normalize(r).includes(normalizedQuery))
    : [];

  // --- Trigger Button ---
  const triggerLabel = selectedRoles.length === 0
    ? null
    : selectedRoles.length <= 2
      ? selectedRoles.join(", ")
      : `${selectedRoles.slice(0, 2).join(", ")} +${selectedRoles.length - 2}`;

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        style={{
          width: "100%",
          padding: "13px 16px",
          background: "#1a1a1a",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 14, color: triggerLabel ? "#f0f0f0" : "#333" }}>
          {triggerLabel || (singleSelect ? "Sélectionner un métier..." : "Sélectionner tes métiers...")}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Bottom Sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSheetOpen(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                background: "#0d0d0d",
                borderRadius: "24px 24px 0 0",
                maxHeight: "85vh",
                overflowY: "auto",
                scrollbarWidth: "none",
              }}
              className="no-scrollbar"
            >
              {/* Handle */}
              <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)" }} />
              </div>

              {/* Sheet Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 600, color: "#f0f0f0" }}>
                  {singleSelect ? "Choisis un métier" : "Choisis tes métiers"}
                </span>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  style={{ background: "#C8FF00", color: "#0d0d0d", fontSize: 13, fontWeight: 600, borderRadius: 20, padding: "7px 16px", border: "none", cursor: "pointer" }}
                >
                  Valider
                </button>
              </div>

              {/* Selected Pills */}
              {selectedRoles.length > 0 && (
                <div style={{ display: "flex", overflowX: "auto", gap: 6, padding: "0 16px 12px", scrollbarWidth: "none" }} className="no-scrollbar">
                  {selectedRoles.map((role) => (
                    <span key={role} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px 5px 12px", borderRadius: 20, background: "rgba(200,255,0,0.1)", border: "1px solid rgba(200,255,0,0.25)", fontSize: 12, color: "#C8FF00", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {role}
                      <span
                        onClick={() => onChange(selectedRoles.filter((r) => r !== role))}
                        style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(200,255,0,0.15)", color: "#C8FF00", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                      >×</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Counter */}
              {!singleSelect && (
                <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: atMax ? "#f97316" : "#444", textAlign: "right", paddingRight: 16, marginBottom: 8 }}>
                  {selectedRoles.length} / {maxSelection}{atMax ? " · Maximum atteint" : ""}
                </p>
              )}

              {/* Search Bar */}
              <div style={{ margin: "0 16px 16px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder={placeholder}
                  style={{ flex: 1, background: "transparent", border: "none", fontSize: 16, color: "#f0f0f0", outline: "none" }}
                />
                {query.length > 0 && (
                  <button type="button" onClick={clearSearch} style={{ background: "none", border: "none", color: "#555", fontSize: 16, cursor: "pointer", padding: 0 }}>×</button>
                )}
              </div>

              {/* Content */}
              <div style={{ paddingBottom: 32 }}>
                {view === "categories" && <CategoriesView selectedRoles={selectedRoles} toggleRole={toggleRole} atMax={atMax} singleSelect={singleSelect} setView={setView} setActiveCategory={setActiveCategory} />}
                {view === "category" && activeCategory && <CategoryView category={activeCategory} selectedRoles={selectedRoles} toggleRole={toggleRole} atMax={atMax} onBack={() => { setView("categories"); setActiveCategory(null); }} />}
                {view === "search" && <SearchView query={query} results={searchResults} selectedRoles={selectedRoles} toggleRole={toggleRole} atMax={atMax} onChange={onChange} maxSelection={maxSelection} singleSelect={singleSelect} />}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ============= CATEGORIES VIEW ============= */

function CategoriesView({ selectedRoles, toggleRole, atMax, singleSelect, setView, setActiveCategory }: {
  selectedRoles: string[];
  toggleRole: (r: string) => void;
  atMax: boolean;
  singleSelect: boolean;
  setView: (v: View) => void;
  setActiveCategory: (c: (typeof ROLE_CATEGORIES)[0]) => void;
}) {
  return (
    <>
      {/* Popular */}
      {!singleSelect && (
        <>
          <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#444", padding: "0 16px 10px" }}>Populaires</p>
          <div style={{ display: "flex", overflowX: "auto", gap: 8, padding: "0 16px 20px", scrollbarWidth: "none" }} className="no-scrollbar">
            {POPULAR_ROLES.map((role) => {
              const selected = selectedRoles.includes(role);
              const disabled = atMax && !selected;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => !disabled && toggleRole(role)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 20,
                    fontSize: 13,
                    cursor: disabled ? "not-allowed" : "pointer",
                    flexShrink: 0,
                    transition: "all 150ms",
                    border: selected ? "1px solid rgba(200,255,0,0.3)" : "1px solid rgba(255,255,255,0.08)",
                    background: selected ? "rgba(200,255,0,0.1)" : "rgba(255,255,255,0.04)",
                    color: selected ? "#C8FF00" : disabled ? "#333" : "#888",
                  }}
                >
                  {role}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Category Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 16px" }}>
        {ROLE_CATEGORIES.map((cat) => {
          const count = cat.roles.filter((r) => selectedRoles.includes(r)).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => { setActiveCategory(cat); setView("category"); }}
              style={{
                height: 100,
                borderRadius: 14,
                overflow: "hidden",
                position: "relative",
                cursor: "pointer",
                border: "1px solid rgba(255,255,255,0.06)",
                background: cat.gradient,
                textAlign: "left",
                transition: "transform 150ms",
              }}
            >
              {/* Decorative circle */}
              <svg width="60" height="60" style={{ position: "absolute", top: -15, right: -15, opacity: 0.08 }}>
                <circle cx="30" cy="30" r="28" stroke={cat.accent} fill="none" strokeWidth={1.5} />
              </svg>

              {/* Badge */}
              {count > 0 && (
                <span style={{ position: "absolute", top: 10, right: 10, background: cat.accent, color: "#0d0d0d", borderRadius: 10, padding: "2px 8px", fontFamily: "JetBrains Mono, monospace", fontSize: 9, fontWeight: 600 }}>
                  {count} ✓
                </span>
              )}

              {/* Content */}
              <div style={{ position: "absolute", inset: 0, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <RoleIcon name={cat.icon as RoleIconName} size={22} color={cat.accent} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", letterSpacing: -0.2 }}>{cat.label}</div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{cat.roles.length} métiers</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ============= CATEGORY VIEW ============= */

function CategoryView({ category, selectedRoles, toggleRole, atMax, onBack }: {
  category: (typeof ROLE_CATEGORIES)[0];
  selectedRoles: string[];
  toggleRole: (r: string) => void;
  atMax: boolean;
  onBack: () => void;
}) {
  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px 16px" }}>
        <button
          type="button"
          onClick={onBack}
          style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f0f0f0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <RoleIcon name={category.icon as RoleIconName} size={20} color={category.accent} />
        <span style={{ fontSize: 18, fontWeight: 600, color: "#f0f0f0", letterSpacing: -0.3 }}>{category.label}</span>
      </div>

      {/* Role List */}
      <div style={{ padding: "0 16px" }}>
        {category.roles.map((role) => {
          const selected = selectedRoles.includes(role);
          const disabled = atMax && !selected;
          return (
            <button
              key={role}
              type="button"
              onClick={() => !disabled && toggleRole(role)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "13px 0",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                background: "transparent",
                border: "none",
                borderBlockEnd: "1px solid rgba(255,255,255,0.04)",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.3 : 1,
                textAlign: "left",
                transition: "all 150ms",
              }}
            >
              <span style={{ fontSize: 14, color: selected ? "#C8FF00" : "#f0f0f0", fontWeight: selected ? 500 : 400 }}>
                {role}
              </span>
              {/* Checkbox circle */}
              {selected ? (
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#C8FF00", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "transform 150ms" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0d0d0d" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                </span>
              ) : (
                <span style={{ width: 20, height: 20, borderRadius: "50%", border: "1.5px solid #333", flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ============= SEARCH VIEW ============= */

function SearchView({ query, results, selectedRoles, toggleRole, atMax, onChange, maxSelection, singleSelect }: {
  query: string;
  results: string[];
  selectedRoles: string[];
  toggleRole: (r: string) => void;
  atMax: boolean;
  onChange: (roles: string[]) => void;
  maxSelection: number;
  singleSelect: boolean;
}) {
  if (query.length < 2) {
    return <p style={{ fontSize: 13, color: "#444", padding: "20px 16px" }}>Tape au moins 2 caractères...</p>;
  }

  if (results.length > 0) {
    return (
      <div style={{ padding: "0 16px" }}>
        {results.map((role) => {
          const selected = selectedRoles.includes(role);
          const disabled = atMax && !selected;
          const cat = findCategoryForRole(role);
          return (
            <button
              key={role}
              type="button"
              onClick={() => !disabled && toggleRole(role)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "13px 0",
                borderBlockEnd: "1px solid rgba(255,255,255,0.04)",
                background: "transparent",
                border: "none",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.3 : 1,
                textAlign: "left",
              }}
            >
              <div>
                <div style={{ fontSize: 14, color: selected ? "#C8FF00" : "#f0f0f0", fontWeight: selected ? 500 : 400 }}>{role}</div>
                {cat && <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: "#444", marginTop: 2 }}>{cat.label}</div>}
              </div>
              {selected ? (
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#C8FF00", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0d0d0d" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                </span>
              ) : (
                <span style={{ width: 20, height: 20, borderRadius: "50%", border: "1.5px solid #333", flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // No results
  const canAddCustom = query.trim().length > 2 && !selectedRoles.includes(query.trim()) && selectedRoles.length < maxSelection;
  return (
    <div style={{ padding: "24px 16px", textAlign: "center" }}>
      <p style={{ fontSize: 14, color: "#555", marginBottom: 16 }}>Aucun résultat pour &laquo; {query} &raquo;</p>
      {canAddCustom && (
        <button
          type="button"
          onClick={() => onChange(singleSelect ? [query.trim()] : [...selectedRoles, query.trim()])}
          style={{
            background: "rgba(200,255,0,0.04)",
            border: "1px dashed rgba(200,255,0,0.2)",
            borderRadius: 10,
            padding: "12px 16px",
            cursor: "pointer",
            width: "100%",
            textAlign: "left",
          }}
        >
          <div style={{ fontSize: 14, color: "#C8FF00" }}>+ Ajouter &laquo; {query.trim()} &raquo;</div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>Ce métier sera ajouté à ton profil.</div>
        </button>
      )}
    </div>
  );
}
