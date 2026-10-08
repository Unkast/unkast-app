"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createBrowserClient } from "@supabase/ssr";
import {
  CATEGORY_LABELS,
  MAX_PROJECTS_FREE,
  DECLARED_ROLES,
  RIGHTS_DECLARATION_TEXT,
  CLIENT_AUTHORIZATION_TEXT,
  CLIENT_AUTHORIZATION_CATEGORIES,
} from "@/lib/constants";
import type { ProjectCategory, AccountType, DeclaredRole } from "@/types/database";
import RoleSelector from "@/components/RoleSelector";
import { EnterItem, EnterList } from "@/components/motion";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Field from "@/components/ui/Field";
import GlassCard from "@/components/ui/GlassCard";
import ProgressSteps from "@/components/ui/ProgressSteps";
import Select from "@/components/ui/Select";
import Toggle from "@/components/ui/Toggle";
import LegalLinks, { TermsCheckbox } from "@/components/LegalLinks";
import { TERMS_VERSION } from "@/lib/legal";

// Compte créé mais film non créé : message selon video_skipped_reason (api/signup).
const VIDEO_SKIPPED_MESSAGES: Record<string, string> = {
  duplicate:
    "Cette vidéo est déjà sur Unkast : ton film n'a pas été ajouté. Une fois connecté·e, tu pourras demander à y être crédité·e ou le revendiquer depuis ton espace.",
  rights:
    "Ton film n'a pas été ajouté : la déclaration de droits est manquante. Tu pourras le publier depuis ton espace une fois connecté·e.",
  private:
    "Ton film n'a pas été ajouté : la vidéo est privée ou introuvable. Vérifie le lien, puis ajoute-le depuis ton espace une fois connecté·e.",
};
const VIDEO_SKIPPED_FALLBACK =
  "Ton film n'a pas été ajouté. Tu pourras le publier depuis ton espace une fois connecté·e.";

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_COUNT = 5;

// Années proposées directement en Chip ; les plus anciennes derrière « Plus ancien ».
const RECENT_YEARS = 5;

// Glissement de 40 px + fondu, sens selon la direction. Reduced motion : fondu seul.
type Slide = { dir: number; reduced: boolean };
const stepVariants = {
  enter: ({ dir, reduced }: Slide) => ({ x: reduced ? 0 : dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: ({ dir, reduced }: Slide) => ({ x: reduced ? 0 : dir > 0 ? -40 : 40, opacity: 0 }),
};

const TITLE = "text-sheen pb-0.5 text-[28px] font-bold tracking-tight sm:text-4xl";
const SUBTITLE = "mt-1.5 mb-6 text-sm text-text-secondary";
const LABEL = "text-sm font-medium text-text-secondary";
const ACCOUNT_CARD =
  "glass rounded-card text-left transition-[transform,opacity,border-color,box-shadow]! duration-fast! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime";
const ACCOUNT_CARD_SELECTED = "border-lime/60 shadow-[0_0_24px_rgba(200,255,0,0.15)]";

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
  director_name?: string | null;
}

export default function RejoindreClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState(1);
  const reduced = useReducedMotion();
  const slide: Slide = { dir: direction, reduced: !!reduced };
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoSkipped, setVideoSkipped] = useState(false);
  const [videoSkippedReason, setVideoSkippedReason] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  async function resendConfirmation() {
    if (!email || resendState === "sending") return;
    setResendState("sending");
    try {
      await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      /* réponse générique de toute façon */
    }
    setResendState("sent");
  }

  // CGU et politique de confidentialité : case obligatoire, jamais cochée d'avance.
  // Demandée à l'étape 2 (avant « Continuer avec Google ») et à l'étape 4 (là où
  // /api/signup crée le compte). Même état : cochée une fois, elle le reste.
  const [termsAccepted, setTermsAccepted] = useState(false);

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
  const [showOlderYears, setShowOlderYears] = useState(false);
  // Déclaration de droits : rôle déclaré + case(s) à cocher, exigés par
  // api/signup pour créer le film (sinon video_skipped_reason = 'rights').
  const [declaredRole, setDeclaredRole] = useState<DeclaredRole | "">("");
  const [rightsAccepted, setRightsAccepted] = useState(false);
  const [clientAuthorized, setClientAuthorized] = useState(false);

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
    // La case est cochée : la version acceptée part dans l'adresse de retour,
    // et /auth/callback l'enregistre à la création du profil. Il envoie ensuite
    // vers /rejoindre/finaliser (jamais vers cette inscription classique).
    if (!termsAccepted) return;
    setGoogleLoading(true);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/feed&terms=${encodeURIComponent(TERMS_VERSION)}`,
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

  // Étape film : un film commencé ne part que complet.
  const needsClientAuthorization = CLIENT_AUTHORIZATION_CATEGORIES.includes(projectCategory);
  const filmStarted = !!projectTitle || !!projectUrl;
  const filmReady =
    !!projectTitle && !!projectUrl && !!declaredRole && rightsAccepted &&
    (!needsClientAuthorization || clientAuthorized);

  function canProceed(): boolean {
    if (step === 1) return !!accountType;
    if (step === 2) return !!firstName && !!lastName && !!email && password.length >= 6;
    if (step === 3) return selectedRoles.length > 0;
    // 4A, 4B et 4C sont optionnelles. Seule exception : un film commencé (4A)
    // doit être complet pour partir, sinon « Passer cette étape ».
    // La case des CGU est exigée dans tous les cas : c'est ici que le compte est créé.
    if (step === 4) return termsAccepted && (accountType !== "creator" || !filmStarted || filmReady);
    return false;
  }

  async function handleSubmit() {
    if (!termsAccepted) {
      setError("Accepte les CGU et la politique de confidentialité pour créer ton compte.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const fullName = `${firstName} ${lastName}`.trim();

      const payload: Record<string, unknown> = {
        email,
        password,
        full_name: fullName,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        roles: selectedRoles,
        location: city || null,
        bio: bio || null,
        avatar_url: null,
        account_type: accountType,
        // Exigé par /api/signup (sinon 400 terms_required, affiché comme toute erreur).
        terms_accepted: termsAccepted,
        ...(invitationToken ? { invitation_token: invitationToken } : {}),
      };

      // Creator: include project if complete (titre, lien, rôle déclaré, déclaration
      // de droits, accord client si pub ou clip). Incomplet = pas de film envoyé.
      if (accountType === "creator" && filmReady) {
        // Réalisateur / producteur : le serveur crée ce crédit tout seul. Le
        // premier métier ne part en owner_role que s'il en diffère (pas de doublon).
        const autoCredit = DECLARED_ROLES.find((r) => r.value === declaredRole)?.credit ?? null;
        const firstRole = selectedRoles[0] || "";
        payload.project = {
          title: projectTitle,
          category: projectCategory,
          year: parseInt(projectYear) || new Date().getFullYear(),
          video_url: projectUrl,
          description: null,
          owner_role: firstRole.toLowerCase() === autoCredit?.toLowerCase() ? "" : firstRole,
          credits: [],
          declared_role: declaredRole,
          rights_accepted: rightsAccepted,
          client_authorized: needsClientAuthorization && clientAuthorized,
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

      // Le compte est créé, mais le film a été sauté (doublon, déclaration
      // manquante, vidéo privée) : on prévient sur l'écran de confirmation.
      if (data.video_skipped) {
        setVideoSkipped(true);
        setVideoSkippedReason(data.video_skipped_reason ?? null);
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

  const recentYears = years.slice(0, RECENT_YEARS);
  const olderYears = years.slice(RECENT_YEARS);
  const olderYearSelected = olderYears.includes(Number(projectYear));
  const strength = passwordStrength(password);

  return (
    <EnterList className="mx-auto w-full max-w-2xl overflow-x-clip px-4 py-4 sm:px-6 sm:py-8">
      {/* Progression */}
      {step < 5 && (
        <EnterItem className="mb-6 flex items-center justify-between gap-4">
          <ProgressSteps total={STEP_COUNT} current={step - 1} />
          <p className="font-mono text-[11px] text-text-tertiary">
            Étape {step} sur {STEP_COUNT}
          </p>
        </EnterItem>
      )}

      <EnterItem>
        <AnimatePresence mode="wait" custom={slide}>
          <motion.div
            key={step}
            custom={slide}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduced ? 0.15 : 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {/* ===== STEP 1 — Account type (3 cards) ===== */}
            {step === 1 && (
              <div>
                <h1 className={TITLE}>Comment vas-tu utiliser Unkast ?</h1>
                <p className={SUBTITLE}>Tu pourras modifier ça plus tard depuis ton profil.</p>

                {/* Row 1 — 2 free cards side by side */}
                <div className="grid grid-cols-2 items-stretch gap-2.5">
                  {/* TALENT card */}
                  <button
                    type="button"
                    onClick={() => selectAccountType("talent")}
                    aria-pressed={accountType === "talent"}
                    className={`${ACCOUNT_CARD} flex flex-col justify-between p-3.5 ${accountType === "talent" ? ACCOUNT_CARD_SELECTED : "hover:border-white/20"}`}
                  >
                    <div>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <p className="mt-2.5 text-[15px] font-semibold text-text-primary">Je suis un talent</p>
                      <p className="mt-1 text-xs leading-snug text-text-secondary">
                        Comédien, technicien, monteur... Sois contacté par des pros.
                      </p>
                      <CheckList items={["Profil public complet", "Apparaître dans les crédits", "Recevoir des messages"]} />
                    </div>
                    <Badge variant="available" className="mt-3 self-start">Gratuit</Badge>
                  </button>

                  {/* CREATOR card */}
                  <button
                    type="button"
                    onClick={() => selectAccountType("creator")}
                    aria-pressed={accountType === "creator"}
                    className={`${ACCOUNT_CARD} flex flex-col justify-between p-3.5 ${accountType === "creator" ? ACCOUNT_CARD_SELECTED : "hover:border-white/20"}`}
                  >
                    <div>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="2" y="4" width="16" height="16" rx="2" />
                        <path d="M22 7l-4 3v4l4 3V7z" />
                        <line x1="6" y1="4" x2="6" y2="20" />
                        <line x1="2" y1="8" x2="6" y2="8" />
                        <line x1="2" y1="12" x2="6" y2="12" />
                        <line x1="2" y1="16" x2="6" y2="16" />
                      </svg>
                      <p className="mt-2.5 text-[15px] font-semibold text-text-primary">Je publie des œuvres</p>
                      <p className="mt-1 text-xs leading-snug text-text-secondary">
                        Réalisateur, producteur.<br />Mets tes films en ligne.
                      </p>
                      <CheckList items={[`${MAX_PROJECTS_FREE} films gratuits`, "Gérer ton équipe", "Recevoir des messages"]} />
                    </div>
                    <Badge variant="available" className="mt-3 self-start">Gratuit</Badge>
                  </button>
                </div>

                {/* Reassurance between free cards and Pro card */}
                <p className="my-3 flex items-center justify-center gap-1.5 text-center text-[13px] text-text-secondary">
                  {CHECK_GREEN}
                  Aucune carte bancaire requise pour les comptes gratuits
                </p>

                {/* Row 2 — Pro recruiter card full width */}
                <button
                  type="button"
                  onClick={() => selectAccountType("recruiter")}
                  aria-pressed={accountType === "recruiter"}
                  className={`${ACCOUNT_CARD} w-full p-4 sm:p-5 ${accountType === "recruiter" ? ACCOUNT_CARD_SELECTED : "border-lime/20 hover:border-lime/40"}`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Left column */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center gap-2.5">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          <path d="M10 8a2 2 0 114 0 2 2 0 01-4 0zM8 14a4 4 0 018 0" />
                        </svg>
                        <span className="text-[15px] font-semibold text-text-primary">Je cherche des talents</span>
                      </div>
                      <p className="mb-3 text-xs leading-normal text-text-secondary">
                        Directeur de casting, producteur, réalisateur qui recrute.
                      </p>
                      <CheckList lime items={["Accès à tous les profils", "Messagerie directe illimitée", "Profil recruteur vérifié"]} />
                    </div>

                    {/* Right column */}
                    <div className="flex shrink-0 flex-col items-end justify-between gap-3 self-stretch">
                      <Badge variant="pro">Pro requis</Badge>
                      <div className="text-right">
                        <div>
                          <span className="text-[22px] font-bold tracking-tight text-text-primary">9,99€</span>
                          <span className="text-[11px] text-text-secondary">/mois</span>
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-lime">Découvrir →</p>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* ===== STEP 2 — Personal info ===== */}
            {step === 2 && (
              <GlassCard radius="panel" className="p-5 sm:p-8">
                <h1 className={TITLE}>Tes informations</h1>
                <p className={SUBTITLE}>Crée ton compte pour commencer.</p>

                <TermsCheckbox checked={termsAccepted} onChange={setTermsAccepted} ageNote className="mb-4" />

                {/* Google button */}
                <Button variant="light" onClick={handleGoogle} disabled={googleLoading || !termsAccepted} fullWidth>
                  {GOOGLE_LOGO}
                  {googleLoading ? "Redirection..." : "Continuer avec Google"}
                </Button>
                {!termsAccepted && (
                  <p className="mt-2 text-center text-xs text-text-secondary">
                    Coche la case pour continuer avec Google.
                  </p>
                )}

                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[11px] text-text-tertiary">ou par email</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
                    <Field label="Prénom" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Lucas" />
                    <Field label="Nom" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Meriaux" />
                  </div>

                  <div>
                    <Field
                      label="Email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="lucas@example.com"
                      readOnly={!!invitationToken}
                      className={invitationToken ? "opacity-70 [&_input]:cursor-not-allowed" : ""}
                    />
                    {invitationContext && (
                      <p className="mt-2 text-xs text-lime">
                        Tu as été crédité·e comme {invitationContext.role}
                        {invitationContext.projectTitle ? ` sur « ${invitationContext.projectTitle} »` : ""}.
                        Cet email est lié à ton invitation.
                      </p>
                    )}
                  </div>

                  <div>
                    <Field
                      label="Mot de passe"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 caractères"
                    />
                    {password.length > 0 && (
                      <div className="mt-2.5">
                        <div className="h-1.5 overflow-hidden rounded-pill bg-white/10">
                          <div
                            className={`h-full rounded-pill transition-[width,background-color] duration-slow ease-glass ${strength.color}`}
                            style={{ width: strength.width }}
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] text-text-secondary">{strength.label}</p>
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>
            )}

            {/* ===== STEP 3 — Professional profile ===== */}
            {step === 3 && (
              <GlassCard radius="panel" className="p-5 sm:p-8">
                <h1 className={TITLE}>Ton profil pro</h1>
                <p className={SUBTITLE}>Dis-nous ce que tu fais dans l&apos;audiovisuel.</p>

                <div className="space-y-4">
                  <div>
                    <p className={`${LABEL} mb-2`}>Tes métiers * <span className="text-text-tertiary">(max 5)</span></p>
                    <RoleSelector
                      selectedRoles={selectedRoles}
                      onChange={setSelectedRoles}
                      maxSelection={5}
                      placeholder="Rechercher ton métier..."
                      allowCustom={false}
                    />
                  </div>

                  <Field label="Ville" type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Paris, Lyon, Marseille..." />

                  <Field
                    multiline
                    rows={3}
                    maxLength={280}
                    label={<>Bio courte <span className="ml-1 text-text-tertiary">({bio.length}/280)</span></>}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Parle de toi en quelques lignes..."
                  />
                </div>
              </GlassCard>
            )}

            {/* ===== STEP 4A — Creator: first project ===== */}
            {step === 4 && accountType === "creator" && (
              <GlassCard radius="panel" className="p-5 sm:p-8">
                <h1 className={TITLE}>Ton premier film sur Unkast</h1>
                <p className={SUBTITLE}>Optionnel : tu pourras le faire depuis ton dashboard.</p>

                <div className="space-y-4">
                  <Field label="Titre du projet" type="text" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} placeholder="Le titre de ton film, clip, pub..." />

                  <Field label="URL YouTube ou Vimeo" type="url" value={projectUrl} onChange={(e) => setProjectUrl(e.target.value)} placeholder="https://vimeo.com/... ou https://youtube.com/..." />

                  {/* Année : 5 dernières années en Chip, les plus anciennes sur demande.
                      Même liste et même valeur (chaîne) que l'ancien <select>. */}
                  <div role="group" aria-labelledby="project-year-label">
                    <p id="project-year-label" className={`${LABEL} mb-2`}>Année</p>
                    <div className="flex flex-wrap gap-2">
                      {recentYears.map((y) => (
                        <Chip
                          key={y}
                          selected={projectYear === String(y)}
                          onClick={() => { setProjectYear(String(y)); setShowOlderYears(false); }}
                        >
                          {y}
                        </Chip>
                      ))}
                      <Chip
                        selected={olderYearSelected}
                        aria-expanded={showOlderYears}
                        onClick={() => setShowOlderYears((v) => !v)}
                      >
                        {olderYearSelected ? `Plus ancien · ${projectYear}` : "Plus ancien"}
                      </Chip>
                    </div>
                    {showOlderYears && (
                      <div className="mt-2.5 flex max-h-44 flex-wrap gap-2 overflow-y-auto rounded-card border border-white/10 bg-white/5 p-3">
                        {olderYears.map((y) => (
                          <Chip key={y} selected={projectYear === String(y)} onClick={() => setProjectYear(String(y))}>
                            {y}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </div>

                  <Select label="Catégorie" value={projectCategory} onChange={(e) => { setProjectCategory(e.target.value as ProjectCategory); setClientAuthorized(false); }}>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </Select>

                  <Select label="Ton rôle sur ce film" value={declaredRole} onChange={(e) => setDeclaredRole(e.target.value as DeclaredRole | "")}>
                    <option value="">Sélectionne ton rôle</option>
                    {DECLARED_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </Select>

                  <div className="rounded-card border border-white/10 bg-white/5 px-3.5 py-1.5">
                    <Toggle checked={rightsAccepted} onChange={setRightsAccepted} label={RIGHTS_DECLARATION_TEXT} />
                    {needsClientAuthorization && (
                      <Toggle checked={clientAuthorized} onChange={setClientAuthorized} label={CLIENT_AUTHORIZATION_TEXT} className="border-t border-white/10" />
                    )}
                  </div>

                  {filmStarted && !filmReady && (
                    <p className="text-xs leading-relaxed text-text-secondary">
                      Pour envoyer ce film, renseigne le titre, le lien et ton rôle, puis coche {needsClientAuthorization ? "les deux déclarations" : "la déclaration"}. Sinon, passe cette étape : tu pourras le publier plus tard.
                    </p>
                  )}
                </div>

                <InfoNote>
                  Tu pourras publier {MAX_PROJECTS_FREE} films maximum en version gratuite. Chaque film publié te permet d&apos;inviter ton équipe.
                </InfoNote>
              </GlassCard>
            )}

            {/* ===== STEP 4B — Talent: claim credit ===== */}
            {step === 4 && accountType === "talent" && (
              <GlassCard radius="panel" className="p-5 sm:p-8">
                <h1 className={TITLE}>Tu as travaille sur un film ?</h1>
                <p className={SUBTITLE}>
                  Recherche un projet déjà présent sur Unkast pour demander à y être crédité.
                </p>

                {!claimProjectId ? (
                  <div>
                    <Field
                      aria-label="Rechercher un projet"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); }}
                      onClear={() => setSearchQuery("")}
                      placeholder="Rechercher un projet..."
                      icon={
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                        </svg>
                      }
                    />

                    {searching && (
                      <div className="mt-3 space-y-2" role="status">
                        <span className="sr-only">Recherche...</span>
                        <div className="h-[62px] animate-pulse rounded-card border border-white/10 bg-white/5" />
                        <div className="h-[62px] animate-pulse rounded-card border border-white/10 bg-white/5" />
                      </div>
                    )}

                    {searchResults.length > 0 && (
                      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                        {searchResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setClaimProjectId(p.id);
                              setClaimProjectTitle(p.title);
                              setClaimProjectOwner(p.director_name || "");
                              setSearchQuery("");
                              setSearchResults([]);
                            }}
                            className="w-full rounded-card border border-white/10 bg-white/5 px-4 py-3 text-left hover:border-white/20 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
                          >
                            <p className="text-sm font-medium text-text-primary">{p.title}</p>
                            <p className="text-xs text-text-secondary">
                              {p.director_name && `de ${p.director_name} · `}
                              {CATEGORY_LABELS[p.category]} · {p.year}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                      <p className="mt-3 text-xs text-text-secondary">Aucun projet trouvé.</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 flex items-center justify-between gap-3 rounded-card border border-lime/30 bg-lime/5 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary">{claimProjectTitle}</p>
                        {claimProjectOwner && (
                          <p className="truncate text-xs text-text-secondary">de {claimProjectOwner}</p>
                        )}
                      </div>
                      <Button
                        variant="glass"
                        size="sm"
                        onClick={() => { setClaimProjectId(null); setClaimProjectTitle(""); setClaimProjectOwner(""); setClaimRole(""); }}
                      >
                        Changer
                      </Button>
                    </div>

                    <div>
                      <p className={`${LABEL} mb-2`}>Ton rôle dans ce projet</p>
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

                <InfoNote>
                  Le réalisateur recevra ta demande et pourra l&apos;accepter ou la refuser.
                </InfoNote>
              </GlassCard>
            )}

            {/* ===== STEP 4C — Recruiter profile ===== */}
            {step === 4 && accountType === "recruiter" && (
              <GlassCard radius="panel" className="p-5 sm:p-8">
                <h1 className={TITLE}>Ton profil recruteur</h1>
                <p className={SUBTITLE}>
                  Ces informations seront vérifiées par l&apos;équipe Unkast avant activation.
                </p>

                <div className="space-y-4">
                  <Field label="Société / Structure" type="text" value={recruiterCompany} onChange={(e) => setRecruiterCompany(e.target.value)} placeholder="Nom de ta société de production" />

                  <Select label="Ton poste" value={recruiterRole} onChange={(e) => setRecruiterRole(e.target.value)}>
                    <option value="">Sélectionne ton poste</option>
                    {["Directeur de casting", "Producteur", "Réalisateur", "Chargé de production", "Agent artistique", "Autre"].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </Select>

                  <Field label="Site web ou lien pro" type="url" value={recruiterWebsite} onChange={(e) => setRecruiterWebsite(e.target.value)} placeholder="https://..." />

                  <div className="rounded-card border border-white/10 bg-white/5 p-3.5">
                    <p className="text-[13px] leading-relaxed text-text-secondary">
                      Pour valider ton profil recruteur, envoie un justificatif a <span className="text-lime">pro@unkast.com</span> (carte de visite, extrait KBIS, lien LinkedIn pro).
                    </p>
                  </div>

                  <Field
                    multiline
                    rows={3}
                    maxLength={200}
                    label={<>Ce que tu recherches <span className="text-text-tertiary">(optionnel · {isLookingFor.length}/200)</span></>}
                    value={isLookingFor}
                    onChange={(e) => setIsLookingFor(e.target.value)}
                    placeholder="Ex: Comédiens 20-30 ans pour court-métrage..."
                  />
                </div>
              </GlassCard>
            )}

            {/* ===== STEP 5 — Confirmation email (tous les comptes) ===== */}
            {step === 5 && (
              <GlassCard radius="panel" className="px-5 py-10 text-center sm:px-8 sm:py-12">
                <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-card border border-lime/30 bg-lime/10 shadow-[0_0_24px_rgba(200,255,0,0.2)]">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <h1 className={`${TITLE} mb-3`}>Confirme ton email</h1>
                <p className="mx-auto mb-2 max-w-[340px] text-sm leading-relaxed text-text-secondary">
                  On t&apos;a envoyé un email de confirmation à
                </p>
                <p className="mb-4 break-all text-[15px] font-semibold text-lime">{email}</p>
                <p className="mx-auto mb-7 max-w-[340px] text-sm leading-relaxed text-text-secondary">
                  Clique sur le lien dans l&apos;email pour activer ton compte, puis tu seras connecté·e automatiquement.
                </p>

                {accountType === "recruiter" && (
                  <div className="mx-auto mb-5 max-w-[360px] rounded-card border border-white/10 bg-white/5 px-4 py-3.5 text-left">
                    <p className="text-[13px] leading-relaxed text-text-secondary">
                      Ton profil recruteur sera ensuite vérifié manuellement (sous 48h). Envoie un justificatif à <span className="text-lime">pro@unkast.com</span>.
                    </p>
                  </div>
                )}

                {videoSkipped && (
                  <div className="mx-auto mb-5 max-w-[360px] rounded-card border border-yellow-500/30 bg-yellow-500/10 px-4 py-3.5 text-left">
                    <p className="text-[13px] leading-relaxed text-yellow-400">
                      {(videoSkippedReason && VIDEO_SKIPPED_MESSAGES[videoSkippedReason]) || VIDEO_SKIPPED_FALLBACK}
                    </p>
                  </div>
                )}

                {resendState === "sent" ? (
                  <p className="text-[13px] text-lime" role="status">Email renvoyé ✓ Pense à vérifier tes spams.</p>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                    <span className="text-[13px] text-text-secondary">Pas reçu ?</span>
                    <Button variant="glass" size="sm" onClick={resendConfirmation} disabled={resendState === "sending"}>
                      {resendState === "sending" ? "Envoi…" : "Renvoyer l'email"}
                    </Button>
                  </div>
                )}

                <div className="mt-6">
                  <Button variant="glass" href="/connexion">Aller à la connexion</Button>
                </div>
              </GlassCard>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Le compte est créé à la fin de l'étape 4 : la case est demandée ici. */}
        {step === 4 && (
          <TermsCheckbox checked={termsAccepted} onChange={setTermsAccepted} ageNote className="mt-4" />
        )}

        {/* Error */}
        {error && (
          <div role="alert" className="mt-4 rounded-card border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Navigation buttons */}
        {step >= 2 && step <= 4 && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="glass" onClick={prevStep}>Retour</Button>
            <div className="flex-1" />
            {step === 4 && (
              <Button variant="glass" onClick={handleSubmit} disabled={loading || !termsAccepted} className="order-last w-full sm:order-none sm:w-auto">
                {loading ? "Envoi..." : "Passer cette étape"}
              </Button>
            )}
            <Button onClick={nextStep} disabled={!canProceed() || loading} className="disabled:cursor-not-allowed">
              {loading
                ? "Envoi..."
                : step === 4
                  ? "Créer mon profil"
                  : "Continuer"}
            </Button>
          </div>
        )}
        {step === 4 && !termsAccepted && (
          <p className="mt-3 text-xs text-text-secondary sm:text-right">
            Coche la case ci-dessus pour créer ton compte.
          </p>
        )}
      </EnterItem>

      {/* Nouvel onglet : le formulaire en cours n'est pas perdu. */}
      <EnterItem className="mt-8">
        <LegalLinks newTab className="justify-center" />
      </EnterItem>
    </EnterList>
  );
}

/* ============= Habillage local ============= */

const CHECK_GREEN = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0"><path d="M5 13l4 4L19 7" /></svg>
);

const CHECK_LIME = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0"><path d="M5 13l4 4L19 7" /></svg>
);

const GOOGLE_LOGO = (
  <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

function CheckList({ items, lime = false }: { items: string[]; lime?: boolean }) {
  return (
    <ul className="mt-2.5 flex flex-col gap-1.5">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-1.5 text-xs leading-snug text-text-secondary">
          {lime ? CHECK_LIME : CHECK_GREEN}
          {t}
        </li>
      ))}
    </ul>
  );
}

function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 flex items-start gap-2.5 rounded-card border border-white/10 bg-white/5 p-3">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="mt-0.5 shrink-0 text-text-secondary">
        <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.01" />
      </svg>
      <p className="text-xs leading-relaxed text-text-secondary">{children}</p>
    </div>
  );
}
