"use client";

import { useState, useRef, useEffect } from "react";
import type { ContactSubject } from "@/types/database";

interface Props {
  open: boolean;
  onClose: () => void;
  profileId: string;
  profileName: string;
}

const SUBJECT_OPTIONS: { value: ContactSubject; label: string }[] = [
  { value: "collaboration", label: "Collaboration" },
  { value: "project", label: "Projet" },
  { value: "question", label: "Question" },
  { value: "other", label: "Autre" },
];

export default function ContactModal({ open, onClose, profileId, profileName }: Props) {
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [subject, setSubject] = useState<ContactSubject>("collaboration");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_name: fromName,
          from_email: fromEmail,
          to_profile_id: profileId,
          subject,
          message,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'envoi");
      }

      setSent(true);
      setFromName("");
      setFromEmail("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-text-primary">
              Contacter {profileName}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-text-tertiary hover:text-text-primary transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {sent ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-teal/10 border border-teal/30 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-text-primary font-semibold mb-2">Demande envoyee !</p>
              <p className="text-sm text-text-secondary">
                {profileName} devra accepter votre demande avant tout echange.
              </p>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-2 border border-border-active text-text-secondary text-sm rounded-lg hover:text-text-primary transition"
              >
                Fermer
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-text-secondary mb-6">
                La personne devra accepter votre demande avant tout echange de coordonnees.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Votre nom
                  </label>
                  <input
                    type="text"
                    required
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition"
                    placeholder="Jean Dupont"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Votre email
                  </label>
                  <input
                    type="email"
                    required
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition"
                    placeholder="jean@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Objet
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value as ContactSubject)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-lime/50 transition"
                  >
                    {SUBJECT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Message
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition resize-none"
                    placeholder="Decrivez votre demande..."
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-400">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full py-3 bg-lime text-[#0d0d0d] font-bold text-sm rounded-lg hover:brightness-110 transition disabled:opacity-50"
                >
                  {sending ? "Envoi en cours..." : "Envoyer la demande"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
