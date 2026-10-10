"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  targetType: "profile" | "project" | "message" | "career_entry";
  targetId: string;
}

const REASONS = [
  { value: "spam", label: "Spam ou contenu indésirable" },
  { value: "fake", label: "Faux profil ou usurpation" },
  { value: "inappropriate", label: "Contenu inapproprié" },
  { value: "harassment", label: "Harcèlement" },
  { value: "copyright", label: "Arnaque ou escroquerie" },
  { value: "other", label: "Autre raison" },
];

export default function ReportModal({ open, onClose, targetType, targetId }: ReportModalProps) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // Echap ferme la fenetre.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleSubmit() {
    if (!reason) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, reason, description: details || null }),
      });
      if (res.ok) {
        setSent(true);
        setTimeout(() => { onClose(); setSent(false); setReason(""); setDetails(""); }, 2000);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Le signalement n'a pas pu être envoyé. Réessaie.");
      }
    } catch {
      setError("Erreur réseau. Le signalement n'a pas été envoyé.");
    }
    finally { setSending(false); }
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(20px)", padding: 16 }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Signaler ce contenu"
          style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto", padding: 24 }}
        >
          {sent ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <svg style={{ margin: "0 auto 16px" }} width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", marginBottom: 6 }}>Signalement envoyé</p>
              <p style={{ fontSize: 13, color: "#868686" }}>Merci de nous aider a maintenir la qualite.</p>
            </div>
          ) : (
            <>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: "#f0f0f0", marginBottom: 6 }}>Signaler ce contenu</h3>
              <p style={{ fontSize: 13, color: "#868686", marginBottom: 20 }}>Aide-nous à maintenir une communauté professionnelle.</p>

              {/* Reasons */}
              <div>
                {REASONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setReason(r.value)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                      padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                      background: "none", border: "none", borderBottomStyle: "solid", cursor: "pointer",
                      fontSize: 14, color: reason === r.value ? "#f0f0f0" : "#A8A8B0", textAlign: "left",
                    }}
                  >
                    {r.label}
                    <div style={{
                      width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                      border: reason === r.value ? "6px solid #C8FF00" : "2px solid rgba(255,255,255,0.15)",
                      background: reason === r.value ? "#0d0d0d" : "transparent",
                      transition: "all 150ms",
                    }} />
                  </button>
                ))}
              </div>

              {/* Details */}
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={300}
                placeholder="Détails supplémentaires..."
                style={{
                  width: "100%", marginTop: 16, padding: 12, background: "#1a1a1a",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10,
                  fontSize: 14, color: "#f0f0f0", resize: "none", minHeight: 80,
                  outline: "none",
                }}
              />
              <p style={{ fontSize: 10, color: "#868686", textAlign: "right", marginTop: 4 }}>{details.length}/300</p>

              {error && (
                <p role="alert" style={{ fontSize: 13, color: "#f87171", marginTop: 12 }}>{error}</p>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!reason || sending}
                style={{
                  width: "100%", marginTop: 16, padding: 14, background: reason ? "#C8FF00" : "rgba(255,255,255,0.06)",
                  color: reason ? "#0d0d0d" : "#868686", fontSize: 14, fontWeight: 600,
                  borderRadius: 10, border: "none", cursor: reason ? "pointer" : "not-allowed",
                  opacity: sending ? 0.6 : 1, transition: "all 150ms",
                }}
              >
                {sending ? "Envoi..." : "Envoyer le signalement"}
              </button>
              <button
                onClick={onClose}
                style={{
                  width: "100%", marginTop: 8, padding: 14, background: "none",
                  color: "#a0a0a0", fontSize: 14, fontWeight: 500,
                  borderRadius: 10, border: "none", cursor: "pointer",
                }}
              >
                Annuler
              </button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Small report trigger button
export function ReportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "none", border: "none", padding: "8px 0",
        fontSize: 12, color: "#868686", fontFamily: "JetBrains Mono, monospace",
        cursor: "pointer",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
      Signaler
    </button>
  );
}
