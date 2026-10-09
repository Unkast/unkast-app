"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import RoleSelector from "@/components/RoleSelector";
import CastingFieldsForm from "@/components/CastingFieldsForm";
import { isActingRole, type CastingFields } from "@/lib/constants";
import { EnterItem, EnterList } from "@/components/motion";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import GlassCard from "@/components/ui/GlassCard";
import Toggle from "@/components/ui/Toggle";

type FinalizeAccountType = "talent" | "creator";

// Memes classes que l'etape 1 de RejoindreClient (cartes de type de compte).
const LABEL = "text-sm font-medium text-text-secondary";
const ACCOUNT_CARD =
  "glass rounded-card text-left transition-[transform,opacity,border-color,box-shadow]! duration-fast! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime";
const ACCOUNT_CARD_SELECTED = "border-lime/60 shadow-[0_0_24px_rgba(200,255,0,0.15)]";
const TEXT_LINK =
  "underline underline-offset-2 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-50";

const ACCOUNT_TYPES: { value: FinalizeAccountType; title: string; text: string; icon: ReactNode }[] = [
  {
    value: "talent",
    title: "Talent",
    text: "J'ai participé à des films.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    value: "creator",
    title: "Créateur",
    text: "Je réalise ou produis des films.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="4" width="16" height="16" rx="2" />
        <path d="M22 7l-4 3v4l4 3V7z" />
        <line x1="6" y1="4" x2="6" y2="20" />
        <line x1="2" y1="8" x2="6" y2="8" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="2" y1="16" x2="6" y2="16" />
      </svg>
    ),
  },
];

export default function FinaliserClient({
  initialFirstName,
  initialLastName,
  initialStageName,
  next,
}: {
  initialFirstName: string;
  initialLastName: string;
  initialStageName: string;
  next: string;
}) {
  const router = useRouter();
  const [accountType, setAccountType] = useState<FinalizeAccountType | null>(null);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [stageName, setStageName] = useState(initialStageName);
  const [showStageName, setShowStageName] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [city, setCity] = useState("");
  // Champs facultatifs (lot 8) : âge de jeu, type de rôles, langues.
  const [casting, setCasting] = useState<CastingFields>({ playing_ages: null, role_type: null, languages: null });
  const isActor = selectedRoles.some(isActingRole);
  const [loading, setLoading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");

  const first = firstName.trim();
  const last = lastName.trim();
  const stage = stageName.trim();

  const missing = [
    !accountType && "ton type de compte",
    !first && "ton prénom",
    !last && "ton nom",
    selectedRoles.length === 0 && "au moins un métier",
  ].filter((m): m is string => !!m);
  const ready = missing.length === 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready || loading) return;
    setError("");
    setLoading(true);
    try {
      // Le compte existe deja : un seul PATCH du profil, jamais /api/signup.
      const res = await fetch("/api/dashboard/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_type: accountType,
          first_name: first,
          last_name: last,
          full_name: `${first} ${last}`,
          stage_name: stage || null,
          display_name_preference: stage && showStageName ? "stage_name" : "real_name",
          location: city.trim() || null,
          roles: selectedRoles,
          playing_ages: isActor ? casting.playing_ages : null,
          role_type: isActor ? casting.role_type : null,
          languages: casting.languages,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Enregistrement impossible. Réessaie dans un instant.");
      }
      router.replace(next || "/feed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible. Réessaie dans un instant.");
      setLoading(false);
    }
  }

  // Deconnexion (meme sequence que /moi), puis chargement complet de la page
  // cible : le proxy et AppShell repartent sans session.
  async function signOutTo(path: string) {
    if (leaving) return;
    setLeaving(true);
    try {
      await createClient().auth.signOut();
      await fetch("/api/logout", { method: "POST" });
      sessionStorage.removeItem("unkast_has_explored");
      localStorage.removeItem("unkast_splash_time");
    } catch {
      /* la page cible renverra ici si la session est toujours la */
    }
    window.location.assign(path);
  }

  return (
    <EnterList className="mx-auto w-full max-w-xl px-4 py-4 sm:px-6 sm:py-8">
      <EnterItem>
        <form onSubmit={handleSubmit} noValidate>
          <GlassCard radius="panel" className="p-5 sm:p-8">
            <h1 className="text-sheen pb-0.5 text-[28px] font-bold tracking-tight sm:text-4xl">
              Finalise ton profil
            </h1>
            <p className="mt-1.5 mb-6 text-sm text-text-secondary">
              Bienvenue sur Unkast. Encore quelques infos et ton profil est prêt.
            </p>

            <div className="space-y-5">
              {/* 1. Type de compte */}
              <div role="group" aria-labelledby="finalize-account-type">
                <p id="finalize-account-type" className={`${LABEL} mb-2`}>Tu es *</p>
                <div className="grid grid-cols-2 items-stretch gap-2.5">
                  {ACCOUNT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setAccountType(t.value)}
                      aria-pressed={accountType === t.value}
                      className={`${ACCOUNT_CARD} p-3.5 ${accountType === t.value ? ACCOUNT_CARD_SELECTED : "hover:border-white/20"}`}
                    >
                      {t.icon}
                      <span className="mt-2.5 block text-[15px] font-semibold text-text-primary">{t.title}</span>
                      <span className="mt-1 block text-xs leading-snug text-text-secondary">{t.text}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-text-tertiary">
                  Tu recrutes ?{" "}
                  <button type="button" onClick={() => signOutTo("/rejoindre")} disabled={leaving} className={TEXT_LINK}>
                    Inscris-toi par email
                  </button>
                  , avec une autre adresse que celle de ce compte Google. Tu seras déconnecté·e : le compte
                  recruteur se crée à part.
                </p>
              </div>

              {/* 2. Prenom et nom */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
                <Field
                  label="Prénom *"
                  type="text"
                  autoComplete="given-name"
                  autoCapitalize="words"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Lucas"
                />
                <Field
                  label="Nom *"
                  type="text"
                  autoComplete="family-name"
                  autoCapitalize="words"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Meriaux"
                />
              </div>

              {/* 3. Nom de scene */}
              <div>
                <Field
                  label={<>Nom de scène <span className="text-text-tertiary">(facultatif)</span></>}
                  type="text"
                  autoComplete="off"
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  placeholder="Si tu travailles sous un autre nom"
                />
                {stage && (
                  <Toggle
                    checked={showStageName}
                    onChange={setShowStageName}
                    label="Afficher mon nom de scène à la place de mon nom"
                    className="mt-1.5"
                  />
                )}
              </div>

              {/* 4. Metiers : memes props que l'etape 3 de l'inscription */}
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

              {/* 5. Ville */}
              <Field
                label={<>Ville <span className="text-text-tertiary">(facultatif)</span></>}
                type="text"
                autoComplete="address-level2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Paris, Lyon, Marseille..."
              />

              {/* 6. Champs facultatifs : âge de jeu et type de rôles (comédiens), langues */}
              <CastingFieldsForm value={casting} onChange={setCasting} showActing={isActor} />
            </div>

            {error && (
              <div role="alert" className="mt-5 rounded-card border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <Button type="submit" size="lg" fullWidth disabled={!ready || loading || leaving} className="mt-6">
              {loading ? "Enregistrement..." : "Terminer"}
            </Button>
            {!ready && (
              <p className="mt-2.5 text-center text-xs leading-relaxed text-text-secondary">
                Il manque : {missing.join(", ")}.
              </p>
            )}
          </GlassCard>
        </form>
      </EnterItem>

      <EnterItem className="mt-6 text-center">
        <button
          type="button"
          onClick={() => signOutTo("/")}
          disabled={leaving}
          className={`min-h-11 px-3 text-sm text-text-secondary ${TEXT_LINK}`}
        >
          Me déconnecter
        </button>
      </EnterItem>
    </EnterList>
  );
}
