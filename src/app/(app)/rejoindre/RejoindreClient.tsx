"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createBrowserClient } from "@supabase/ssr";
import { CATEGORY_LABELS } from "@/lib/constants";
import type { ProjectCategory, AccountType } from "@/types/database";
import RoleSelector from "@/components/RoleSelector";

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_COUNT = 5;

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

function passwordStrength(pw: string): { label: string; color: string; width: string } {
  if (pw.length < 6) return { label: "Trop court", color: "bg-red-500", width: "20%" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Faible", color: "bg-orange-500", width: "40%" };
  if (score === 2) return { label: "Moyen", color: "bg-yellow-500", width: "60%" };
  if (score === 3) return { label: "Bon", color: "bg-lime", width: "80%" };
  return { label: "Fort", color: "bg-green-500", width: "100%" };
}

interface SearchProject {
  id: string;
  title: string;
  slug: string;
  category: ProjectCategory;
  year: number;
  owner_name?: string;
  owner_slug?: string;
}

export default function RejoindreClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoSkipped, setVideoSkipped] = useState(false);

  // Step 1
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  // Step 2
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 3
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");

  // Step 4A (creator)
  const [projectTitle, setProjectTitle] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [projectYear, setProjectYear] = useState(String(new Date().getFullYear()));
  const [projectCategory, setProjectCategory] = useState<ProjectCategory>("court-metrage");

  // Step 4B (talent)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProject[]>([]);
  const [searching, setSearching] = useState(false);
  const [claimProjectId, setClaimProjectId] = useState<string | null>(null);
  const [claimProjectTitle, setClaimProjectTitle] = useState("");
  const [claimProjectOwner, setClaimProjectOwner] = useState("");
  const [claimRole, setClaimRole] = useState("");

  // Step 4C (recruiter)
  const [recruiterCompany, setRecruiterCompany] = useState("");
  const [recruiterRole, setRecruiterRole] = useState("");
  const [recruiterWebsite, setRecruiterWebsite] = useState("");
  const [isLookingFor, setIsLookingFor] = useState("");

  // Invitation email (chantier 10) : ?invitation=<token> -> pré-remplit et
  // VERROUILLE l'email (le rattachement n'a lieu que si email du compte == email invité).
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationContext, setInvitationContext] = useState<{ role: string; projectTitle: string | null } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lecture du token d'invitation au montage (claim ne révèle rien si invalide).
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invitation");
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/invitations/claim?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (data.valid) {
          setInvitationToken(token);
          setEmail(data.email);
          setInvitationContext({ role: data.role, projectTitle: data.project_title });
        }
      } catch {
        // token invalide/expiré : on ignore silencieusement (inscription normale).
      }
    })();
  }, []);

  // Search projects for talent flow
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&type=projets`);
        const data = await res.json();
        setSearchResults(data.projects || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  async function handleGoogle() {
    setGoogleLoading(true);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    if (authError) {
      setError(authError.message);
      setGoogleLoading(false);
    }
  }

  function selectAccountType(type: AccountType) {
    setAccountType(type);
    goTo(2);
  }

  function goTo(s: Step) {
    setDirection(s > step ? 1 : -1);
    setStep(s);
    // Push step into browser history so back gesture works
    if (s > 1) {
      window.history.pushState({ step: s }, "", `#step${s}`);
    }
  }

  // Listen for browser/gesture back to go to previous step
  useEffect(() => {
    function handlePopState(e: PopStateEvent) {
      const historyStep = e.state?.step as number | undefined;
      if (historyStep && historyStep >= 1 && historyStep <= 5) {
        setDirection(-1);
        setStep(historyStep as Step);
      } else if (step > 1) {
        // No step in state = we're back at step 1
        setDirection(-1);
        setStep(1);
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [step]);

  function canProceed(): boolean {
    if (step === 1) return !!accountType;
    if (step === 2) return !!firstName && !!lastName && !!email && password.length >= 6;
    if (step === 3) return selectedRoles.length > 0;
    if (step === 4) return true; // both 4A and 4B are optional
    return false;
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);

    try {
      const fullName = `${firstName} ${lastName}`.trim();

      const payload: Record<string, unknown> = {
        email,
        password,
        full_name: fullName,
        roles: selectedRoles,
        location: city || null,
        bio: bio || null,
        avatar_url: null,
        account_type: accountType,
        ...(invitationToken ? { invitation_token: invitationToken } : {}),
      };

      // Creator: include project if filled
      if (accountType === "creator" && projectTitle && projectUrl) {
        payload.project = {
          title: projectTitle,
          category: projectCategory,
          year: parseInt(projectYear) || new Date().getFullYear(),
          video_url: projectUrl,
          description: null,
          owner_role: selectedRoles[0] || "",
          credits: [],
        };
      }

      // Talent: include credit request if filled
      if (accountType === "talent" && claimProjectId && claimRole) {
        payload.credit_request = {
          project_id: claimProjectId,
          role: claimRole,
        };
      }

      // Recruiter: include recruiter details
      if (accountType === "recruiter") {
        payload.recruiter_company = recruiterCompany || null;
        payload.recruiter_role = recruiterRole || null;
        payload.recruiter_website = recruiterWebsite || null;
        payload.is_looking_for = isLookingFor || null;
        payload.recruiter_status = "pending";
      }

      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'inscription");
      }

      // Anti-vol d'œuvre : le compte est créé, mais la vidéo était déjà référencée
      // → le film a été sauté, on prévient sur l'écran de confirmation.
      if (data.video_skipped) {
        setVideoSkipped(true);
      }

      goTo(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  function nextStep() {
    if (step === 4) {
      handleSubmit();
    } else if (step < 5) {
      goTo((step + 1) as Step);
    }
  }

  function prevStep() {
    if (step === 2 && accountType) {
      goTo(1);
    } else if (step > 2 && step < 5) {
      goTo((step - 1) as Step);
    }
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1990 + 1 }, (_, i) => currentYear - i);

  const inputClass =
    "w-full px-4 py-3 bg-white/[0.03] border border-white/5 rounded-xl text-text-primary text-base placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition";
  const selectClass =
    "w-full px-4 py-3 bg-white/[0.03] border border-white/5 rounded-xl text-text-primary text-base focus:outline-none focus:border-lime/50 transition";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div className="pb-16 lg:pb-0">
        <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6">
          {/* Progress bar */}
          {step < 5 && (
            <div className="mb-8">
              <div className="flex gap-1.5">
                {Array.from({ length: STEP_COUNT }, (_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      i < step ? "bg-lime" : "bg-white/10"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-text-tertiary mt-2">
                Étape {step} sur {STEP_COUNT}
              </p>
            </div>
          )}

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {/* ===== STEP 1 — Account type (3 cards) ===== */}
              {step === 1 && (
                <div style={{ paddingTop: 4 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.3px", color: "#f0f0f0", marginBottom: 6 }}>
                    Comment vas-tu utiliser Unkast ?
                  </h1>
                  <p style={{ fontSize: 13, color: "#555", lineHeight: 1.5, marginBottom: 20 }}>
                    Tu pourras modifier ça plus tard depuis ton profil.
                  </p>

                  {/* Row 1 — 2 free cards side by side */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "stretch" }}>
                    {/* TALENT card */}
                    <button
                      onClick={() => selectAccountType("talent")}
                      style={{
                        textAlign: "left", padding: 14, borderRadius: 14, cursor: "pointer", transition: "all 200ms",
                        position: "relative", overflow: "hidden",
                        display: "flex", flexDirection: "column", justifyContent: "space-between",
                        background: accountType === "talent" ? "rgba(200,255,0,0.04)" : "linear-gradient(135deg, #141414 0%, #1a1410 100%)",
                        border: accountType === "talent" ? "1.5px solid rgba(200,255,0,0.4)" : "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <p style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", letterSpacing: "-0.2px", marginTop: 10 }}>Je suis un talent</p>
                        <p style={{ fontSize: 12, color: "#666", lineHeight: 1.4, marginTop: 4 }}>
                          Comédien, technicien, monteur... Sois contacté par des pros.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10 }}>
                          {["Profil public complet", "Apparaître dans les crédits", "Recevoir des messages"].map((t) => (
                            <span key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#777" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M5 13l4 4L19 7" /></svg>
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span style={{ display: "inline-flex", alignSelf: "flex-start", marginTop: 12, padding: "3px 10px", borderRadius: 20, fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 500, background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>Gratuit</span>
                    </button>

                    {/* CREATOR card */}
                    <button
                      onClick={() => selectAccountType("creator")}
                      style={{
                        textAlign: "left", padding: 14, borderRadius: 14, cursor: "pointer", transition: "all 200ms",
                        position: "relative", overflow: "hidden",
                        display: "flex", flexDirection: "column", justifyContent: "space-between",
                        background: accountType === "creator" ? "rgba(200,255,0,0.04)" : "linear-gradient(135deg, #141414 0%, #10141a 100%)",
                        border: accountType === "creator" ? "1.5px solid rgba(200,255,0,0.4)" : "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="4" width="16" height="16" rx="2" />
                          <path d="M22 7l-4 3v4l4 3V7z" />
                          <line x1="6" y1="4" x2="6" y2="20" />
                          <line x1="2" y1="8" x2="6" y2="8" />
                          <line x1="2" y1="12" x2="6" y2="12" />
                          <line x1="2" y1="16" x2="6" y2="16" />
                        </svg>
                        <p style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", letterSpacing: "-0.2px", marginTop: 10 }}>Je publie des œuvres</p>
                        <p style={{ fontSize: 12, color: "#666", lineHeight: 1.4, marginTop: 4 }}>
                          Réalisateur, producteur.<br />Mets tes films en ligne.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10 }}>
                          {["2 films gratuits", "Gérer ton équipe", "Recevoir des messages"].map((t) => (
                            <span key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#777" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M5 13l4 4L19 7" /></svg>
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span style={{ display: "inline-flex", alignSelf: "flex-start", marginTop: 12, padding: "3px 10px", borderRadius: 20, fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 500, background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>Gratuit</span>
                    </button>
                  </div>

                  {/* Reassurance between free cards and Pro card */}
                  <div style={{ margin: "8px 0 12px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M5 13l4 4L19 7" /></svg>
                    <span style={{ fontSize: 13, color: "#555" }}>Aucune carte bancaire requise pour les comptes gratuits</span>
                  </div>

                  {/* Row 2 — Pro recruiter card full width */}
                  <button
                    onClick={() => selectAccountType("recruiter")}
                    style={{
                      width: "100%", textAlign: "left", padding: 18, borderRadius: 14, cursor: "pointer", transition: "all 200ms",
                      position: "relative", overflow: "hidden", marginTop: 10,
                      background: accountType === "recruiter" ? "rgba(200,255,0,0.06)" : "linear-gradient(135deg, #141414 0%, #1a1a10 100%)",
                      border: accountType === "recruiter" ? "1.5px solid #C8FF00" : "1px solid rgba(200,255,0,0.15)",
                      boxShadow: accountType === "recruiter" ? "0 0 20px rgba(200,255,0,0.08)" : "none",
                    }}
                  >
                    {/* Decorative circle */}
                    <svg width="80" height="80" style={{ position: "absolute", top: -20, right: -20 }}>
                      <circle cx="40" cy="40" r="36" stroke="rgba(200,255,0,0.06)" fill="none" strokeWidth={1.5} />
                    </svg>

                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      {/* Left column */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            <path d="M10 8a2 2 0 114 0 2 2 0 01-4 0zM8 14a4 4 0 018 0" />
                          </svg>
                          <span style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0" }}>Je cherche des talents</span>
                        </div>
                        <p style={{ fontSize: 12, color: "#666", lineHeight: 1.5, marginBottom: 12 }}>
                          Directeur de casting, producteur, réalisateur qui recrute.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {["Accès à tous les profils", "Messagerie directe illimitée", "Profil recruteur vérifié"].map((t) => (
                            <span key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#888" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M5 13l4 4L19 7" /></svg>
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Right column */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, padding: "4px 12px", borderRadius: 20, whiteSpace: "nowrap", background: "rgba(200,255,0,0.1)", color: "#C8FF00", border: "1px solid rgba(200,255,0,0.2)" }}>Pro requis</span>
                        <div style={{ textAlign: "right" }}>
                          <div>
                            <span style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", letterSpacing: "-0.5px" }}>9,99€</span>
                            <span style={{ fontSize: 11, color: "#555" }}>/mois</span>
                          </div>
                          <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#C8FF00", marginTop: 2 }}>
                            Découvrir →
                          </p>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* ===== STEP 2 — Personal info ===== */}
              {step === 2 && (
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-text-primary mb-1">
                    Tes informations
                  </h1>
                  <p className="text-sm text-text-secondary mb-6">
                    Crée ton compte pour commencer.
                  </p>

                  {/* Google button */}
                  <button
                    onClick={handleGoogle}
                    disabled={googleLoading}
                    className="w-full flex items-center justify-center gap-3 py-3 bg-white text-[#1f1f1f] font-semibold text-sm rounded-lg hover:bg-gray-100 transition disabled:opacity-50 mb-4"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {googleLoading ? "Redirection..." : "Continuer avec Google"}
                  </button>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[11px] text-text-tertiary">ou par email</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">Prénom</label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className={inputClass}
                          placeholder="Lucas"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">Nom</label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className={inputClass}
                          placeholder="Meriaux"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass}
                        placeholder="lucas@example.com"
                        readOnly={!!invitationToken}
                        style={invitationToken ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
                      />
                      {invitationContext && (
                        <p className="text-xs mt-1.5" style={{ color: "#C8FF00" }}>
                          Tu as été crédité·e comme {invitationContext.role}
                          {invitationContext.projectTitle ? ` sur « ${invitationContext.projectTitle} »` : ""}.
                          Cet email est lié à ton invitation.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">Mot de passe</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={inputClass}
                        placeholder="Minimum 6 caractères"
                      />
                      {password.length > 0 && (
                        <div className="mt-2">
                          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${passwordStrength(password).color} transition-all duration-300 rounded-full`}
                              style={{ width: passwordStrength(password).width }}
                            />
                          </div>
                          <p className="text-[10px] text-text-tertiary mt-1">{passwordStrength(password).label}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ===== STEP 3 — Professional profile ===== */}
              {step === 3 && (
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-text-primary mb-1">
                    Ton profil pro
                  </h1>
                  <p className="text-sm text-text-secondary mb-6">
                    Dis-nous ce que tu fais dans l&apos;audiovisuel.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-2">Tes métiers * <span className="text-text-tertiary">(max 5)</span></label>
                      <RoleSelector
                        selectedRoles={selectedRoles}
                        onChange={setSelectedRoles}
                        maxSelection={5}
                        placeholder="Rechercher ton métier..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">Ville</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={inputClass}
                        placeholder="Paris, Lyon, Marseille..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">
                        Bio courte
                        <span className="text-text-tertiary ml-1">({bio.length}/280)</span>
                      </label>
                      <textarea
                        rows={3}
                        maxLength={280}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className={`${inputClass} resize-none`}
                        placeholder="Parle de toi en quelques lignes..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ===== STEP 4A — Creator: first project ===== */}
              {step === 4 && accountType === "creator" && (
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-text-primary mb-1">
                    Ton premier film sur Unkast
                  </h1>
                  <p className="text-sm text-text-secondary mb-6">
                    Optionnel — tu pourras le faire depuis ton dashboard.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">Titre du projet</label>
                      <input
                        type="text"
                        value={projectTitle}
                        onChange={(e) => setProjectTitle(e.target.value)}
                        className={inputClass}
                        placeholder="Le titre de ton film, clip, pub..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">URL YouTube ou Vimeo</label>
                      <input
                        type="url"
                        value={projectUrl}
                        onChange={(e) => setProjectUrl(e.target.value)}
                        className={inputClass}
                        placeholder="https://vimeo.com/... ou https://youtube.com/..."
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">Annee</label>
                        <select
                          value={projectYear}
                          onChange={(e) => setProjectYear(e.target.value)}
                          className={selectClass}
                        >
                          {years.map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">Catégorie</label>
                        <select
                          value={projectCategory}
                          onChange={(e) => setProjectCategory(e.target.value as ProjectCategory)}
                          className={selectClass}
                        >
                          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-start gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-text-tertiary text-xs mt-0.5">i</span>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Tu pourras publier 2 films maximum en version gratuite. Chaque film publié te permet d&apos;inviter ton équipe.
                    </p>
                  </div>
                </div>
              )}

              {/* ===== STEP 4B — Talent: claim credit ===== */}
              {step === 4 && accountType === "talent" && (
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-text-primary mb-1">
                    Tu as travaille sur un film ?
                  </h1>
                  <p className="text-sm text-text-secondary mb-6">
                    Recherche un projet déjà présent sur Unkast pour demander à y être crédité.
                  </p>

                  {!claimProjectId ? (
                    <div>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); }}
                        className={inputClass}
                        placeholder="Rechercher un projet..."
                      />

                      {searching && (
                        <p className="text-xs text-text-tertiary mt-3">Recherche...</p>
                      )}

                      {searchResults.length > 0 && (
                        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                          {searchResults.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setClaimProjectId(p.id);
                                setClaimProjectTitle(p.title);
                                setClaimProjectOwner(p.owner_name || "");
                                setSearchQuery("");
                                setSearchResults([]);
                              }}
                              className="w-full text-left px-4 py-3 rounded-xl border border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04] transition"
                            >
                              <p className="text-sm font-medium text-text-primary">{p.title}</p>
                              <p className="text-xs text-text-tertiary">
                                {p.owner_name && `par ${p.owner_name} · `}
                                {CATEGORY_LABELS[p.category]} · {p.year}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                        <p className="text-xs text-text-tertiary mt-3">Aucun projet trouvé.</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="px-4 py-3 rounded-xl border border-lime/30 bg-lime/5 mb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-text-primary">{claimProjectTitle}</p>
                            {claimProjectOwner && (
                              <p className="text-xs text-text-tertiary">par {claimProjectOwner}</p>
                            )}
                          </div>
                          <button
                            onClick={() => { setClaimProjectId(null); setClaimProjectTitle(""); setClaimProjectOwner(""); setClaimRole(""); }}
                            className="text-xs text-text-tertiary hover:text-text-primary transition"
                          >
                            Changer
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">Ton rôle dans ce projet</label>
                        <RoleSelector
                          selectedRoles={claimRole ? [claimRole] : []}
                          onChange={(roles) => setClaimRole(roles[0] || "")}
                          maxSelection={1}
                          singleSelect
                          placeholder="Ton rôle dans ce projet..."
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-5 flex items-start gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-text-tertiary text-xs mt-0.5">i</span>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Le réalisateur recevra ta demande et pourra l&apos;accepter ou la refuser.
                    </p>
                  </div>
                </div>
              )}

              {/* ===== STEP 4C — Recruiter profile ===== */}
              {step === 4 && accountType === "recruiter" && (
                <div>
                  <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px", color: "#f0f0f0", marginBottom: 4 }}>
                    Ton profil recruteur
                  </h1>
                  <p style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
                    Ces informations seront vérifiées par l&apos;équipe Unkast avant activation.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">Société / Structure</label>
                      <input type="text" value={recruiterCompany} onChange={(e) => setRecruiterCompany(e.target.value)} className={inputClass} placeholder="Nom de ta société de production" />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">Ton poste</label>
                      <select value={recruiterRole} onChange={(e) => setRecruiterRole(e.target.value)} className={selectClass}>
                        <option value="">Sélectionne ton poste</option>
                        {["Directeur de casting", "Producteur", "Réalisateur", "Chargé de production", "Agent artistique", "Autre"].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">Site web ou lien pro</label>
                      <input type="url" value={recruiterWebsite} onChange={(e) => setRecruiterWebsite(e.target.value)} className={inputClass} placeholder="https://..." />
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14 }}>
                      <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>
                        Pour valider ton profil recruteur, envoie un justificatif a <span style={{ color: "#C8FF00" }}>pro@unkast.com</span> (carte de visite, extrait KBIS, lien LinkedIn pro).
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">
                        Ce que tu recherches <span className="text-text-tertiary">(optionnel · {isLookingFor.length}/200)</span>
                      </label>
                      <textarea rows={3} maxLength={200} value={isLookingFor} onChange={(e) => setIsLookingFor(e.target.value)} className={`${inputClass} resize-none`} placeholder="Ex: Comédiens 20-30 ans pour court-métrage..." />
                    </div>
                  </div>
                </div>
              )}

              {/* ===== STEP 5 — Confirmation ===== */}
              {step === 5 && accountType !== "recruiter" && (
                <div className="text-center py-12">
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(200,255,0,0.1)", border: "1px solid rgba(200,255,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px", color: "#f0f0f0", marginBottom: 12 }}>
                    Bienvenue sur Unkast !
                  </h1>
                  <p style={{ fontSize: 14, color: "#666", maxWidth: 320, margin: "0 auto 32px", lineHeight: 1.6 }}>
                    Ton compte est actif. Tu peux dès maintenant explorer les projets et gérer ton profil.
                  </p>
                  {videoSkipped && (
                    <div style={{ background: "rgba(255,180,0,0.08)", border: "1px solid rgba(255,180,0,0.3)", borderRadius: 12, padding: "14px 18px", maxWidth: 360, margin: "0 auto 28px", textAlign: "left" }}>
                      <p style={{ fontSize: 13, color: "#e0b020", lineHeight: 1.6, margin: 0 }}>
                        Ton compte est créé, mais cette vidéo est déjà référencée sur Unkast — ton film n'a pas été ajouté. Ajoutes-en une autre depuis ton dashboard.
                      </p>
                    </div>
                  )}
                  <button onClick={() => router.replace("/dashboard")} style={{ background: "#C8FF00", color: "#0d0d0d", fontSize: 15, fontWeight: 600, borderRadius: 12, padding: "14px 32px", border: "none", cursor: "pointer" }}>
                    Accéder à mon dashboard
                  </button>
                </div>
              )}

              {/* ===== STEP 5 — Recruiter confirmation ===== */}
              {step === 5 && accountType === "recruiter" && (
                <div className="text-center py-12">
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(200,255,0,0.1)", border: "1px solid rgba(200,255,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px", color: "#f0f0f0", marginBottom: 12 }}>
                    Demande envoyee !
                  </h1>
                  <p style={{ fontSize: 14, color: "#666", maxWidth: 320, margin: "0 auto 32px", lineHeight: 1.6 }}>
                    Ton profil recruteur est en cours de vérification. Tu recevras un email sous 48h. En attendant, tu peux explorer la plateforme.
                  </p>
                  <button onClick={() => router.replace("/feed")} style={{ background: "#C8FF00", color: "#0d0d0d", fontSize: 15, fontWeight: 600, borderRadius: 12, padding: "14px 32px", border: "none", cursor: "pointer" }}>
                    Explorer Unkast
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Navigation buttons */}
          {step >= 2 && step <= 4 && (
            <div className="flex justify-between mt-8">
              <button
                onClick={prevStep}
                className="px-5 py-3 border border-white/10 text-text-secondary text-sm rounded-lg hover:border-white/20 hover:text-text-primary transition"
              >
                Retour
              </button>

              <div className="flex gap-3">
                {step === 4 && (
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-5 py-3 border border-white/10 text-text-secondary text-sm rounded-lg hover:border-white/20 hover:text-text-primary transition disabled:opacity-40"
                  >
                    {loading ? "Envoi..." : "Passer cette étape"}
                  </button>
                )}
                <button
                  onClick={nextStep}
                  disabled={!canProceed() || loading}
                  className="px-6 py-3 bg-lime text-[#0d0d0d] font-bold text-sm rounded-lg hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading
                    ? "Envoi..."
                    : step === 4
                      ? "Créer mon profil"
                      : "Continuer"}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </motion.div>
  );
}
