"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS } from "@/lib/constants";
import type { ProjectCategory } from "@/types/database";

type Step = 1 | 2 | 3 | 4;

interface Credit {
  name: string;
  role: string;
}

const STEP_LABELS = [
  "Compte",
  "Profil pro",
  "Premier projet",
  "Confirmation",
];

const ROLES_SUGGESTIONS = [
  "Realisateur",
  "Realisatrice",
  "Chef operateur",
  "Directeur de la photographie",
  "Monteur",
  "Monteuse",
  "Ingenieur son",
  "Directeur artistique",
  "Scenariste",
  "Producteur",
  "Productrice",
  "Comedien",
  "Comedienne",
  "Cascadeur",
  "Compositeur",
  "Etalonneur",
  "Maquilleur",
  "Costumier",
];

export default function RejoindreClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // Step 2: Profile
  const [roles, setRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");

  // Step 3: First project
  const [projectTitle, setProjectTitle] = useState("");
  const [projectCategory, setProjectCategory] = useState<ProjectCategory>("court-metrage");
  const [projectYear, setProjectYear] = useState(new Date().getFullYear());
  const [projectVideoUrl, setProjectVideoUrl] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectOwnerRole, setProjectOwnerRole] = useState("");
  const [credits, setCredits] = useState<Credit[]>([]);
  const [creditName, setCreditName] = useState("");
  const [creditRole, setCreditRole] = useState("");

  function addRole() {
    const r = roleInput.trim();
    if (r && !roles.includes(r)) {
      setRoles([...roles, r]);
      setRoleInput("");
    }
  }

  function removeRole(r: string) {
    setRoles(roles.filter((x) => x !== r));
  }

  function addCredit() {
    if (creditName.trim() && creditRole.trim()) {
      setCredits([...credits, { name: creditName.trim(), role: creditRole.trim() }]);
      setCreditName("");
      setCreditRole("");
    }
  }

  function removeCredit(idx: number) {
    setCredits(credits.filter((_, i) => i !== idx));
  }

  function canProceed(): boolean {
    if (step === 1) return !!email && !!password && password.length >= 6 && !!fullName;
    if (step === 2) return roles.length > 0;
    if (step === 3) return true; // project is optional
    return false;
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        email,
        password,
        full_name: fullName,
        roles,
        location: location || null,
        bio: bio || null,
        avatar_url: null,
      };

      // Include project if filled
      if (projectTitle && projectVideoUrl) {
        payload.project = {
          title: projectTitle,
          category: projectCategory,
          year: projectYear,
          video_url: projectVideoUrl,
          description: projectDescription || null,
          owner_role: projectOwnerRole || roles[0] || "",
          credits,
        };
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

      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  function nextStep() {
    if (step === 3) {
      handleSubmit();
    } else if (step < 4) {
      setStep((step + 1) as Step);
    }
  }

  function prevStep() {
    if (step > 1 && step < 4) {
      setStep((step - 1) as Step);
    }
  }

  return (
    <div className="pb-16 lg:pb-0">
      <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6">
        {/* Progress bar */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            {STEP_LABELS.map((label, i) => {
              const stepNum = i + 1;
              const isActive = step === stepNum;
              const isDone = step > stepNum;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition ${
                      isDone
                        ? "bg-lime text-[#0d0d0d] border-lime"
                        : isActive
                          ? "border-lime text-lime"
                          : "border-border text-text-tertiary"
                    }`}
                  >
                    {isDone ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      stepNum
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:inline ${
                      isActive ? "text-text-primary" : "text-text-tertiary"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-lime transition-all duration-300"
              style={{ width: `${((step - 1) / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Account info */}
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-extrabold text-text-primary mb-2">
              Creer ton compte
            </h1>
            <p className="text-sm text-text-secondary mb-5">
              Commence par les informations de base.
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Nom complet
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition"
                  placeholder="Lucas Meriaux"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition"
                  placeholder="lucas@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Mot de passe
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition"
                  placeholder="Minimum 6 caracteres"
                />
                {password.length > 0 && password.length < 6 && (
                  <p className="text-xs text-red-400 mt-1">Minimum 6 caracteres</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Pro profile */}
        {step === 2 && (
          <div>
            <h1 className="text-2xl font-extrabold text-text-primary mb-2">
              Ton profil pro
            </h1>
            <p className="text-sm text-text-secondary mb-5">
              Dis-nous ce que tu fais dans l&apos;audiovisuel.
            </p>

            <div className="space-y-5">
              {/* Roles */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Metier(s) *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRole(); } }}
                    list="roles-list"
                    className="flex-1 px-4 py-3 bg-card border border-border rounded-xl text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition"
                    placeholder="Ex: Realisateur, Monteur..."
                  />
                  <datalist id="roles-list">
                    {ROLES_SUGGESTIONS.filter((r) => !roles.includes(r)).map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={addRole}
                    className="px-4 py-3 bg-card border border-border rounded-xl text-text-secondary hover:border-lime/50 hover:text-lime transition text-sm"
                  >
                    +
                  </button>
                </div>
                {roles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {roles.map((r) => (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime/10 border border-lime/30 text-lime text-xs font-semibold"
                      >
                        {r}
                        <button
                          onClick={() => removeRole(r)}
                          className="hover:text-white transition"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Localisation
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition"
                  placeholder="Paris, Lyon, Marseille..."
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Bio
                </label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition resize-none"
                  placeholder="Parle de toi en quelques lignes..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: First project */}
        {step === 3 && (
          <div>
            <h1 className="text-2xl font-extrabold text-text-primary mb-2">
              Ton premier projet
            </h1>
            <p className="text-sm text-text-secondary mb-5">
              Ajoute un projet pour donner vie a ton profil. Tu pourras en ajouter d&apos;autres plus tard.
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Titre du projet
                </label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition"
                  placeholder="Le titre de ton film, clip, pub..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Categorie
                  </label>
                  <select
                    value={projectCategory}
                    onChange={(e) => setProjectCategory(e.target.value as ProjectCategory)}
                    className="w-full px-4 py-3 bg-card border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-lime/50 transition"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Annee
                  </label>
                  <input
                    type="number"
                    value={projectYear}
                    onChange={(e) => setProjectYear(parseInt(e.target.value) || new Date().getFullYear())}
                    className="w-full px-4 py-3 bg-card border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-lime/50 transition"
                    min={1990}
                    max={2030}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  URL video (Vimeo ou YouTube)
                </label>
                <input
                  type="url"
                  value={projectVideoUrl}
                  onChange={(e) => setProjectVideoUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition"
                  placeholder="https://vimeo.com/... ou https://youtube.com/..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Ton role sur ce projet
                </label>
                <input
                  type="text"
                  value={projectOwnerRole}
                  onChange={(e) => setProjectOwnerRole(e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition"
                  placeholder="Ex: Realisateur, Chef operateur..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition resize-none"
                  placeholder="Decris brievement le projet..."
                />
              </div>

              {/* Credits */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Credits (collaborateurs)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={creditName}
                    onChange={(e) => setCreditName(e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-card border border-border rounded-xl text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition"
                    placeholder="Nom"
                  />
                  <input
                    type="text"
                    value={creditRole}
                    onChange={(e) => setCreditRole(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCredit(); } }}
                    className="flex-1 px-4 py-2.5 bg-card border border-border rounded-xl text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition"
                    placeholder="Role"
                  />
                  <button
                    type="button"
                    onClick={addCredit}
                    className="px-4 py-2.5 bg-card border border-border rounded-xl text-text-secondary hover:border-lime/50 hover:text-lime transition text-sm"
                  >
                    +
                  </button>
                </div>
                {credits.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {credits.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 bg-background border border-border rounded-lg"
                      >
                        <span className="text-sm text-text-primary">
                          {c.name}{" "}
                          <span className="text-text-tertiary">— {c.role}</span>
                        </span>
                        <button
                          onClick={() => removeCredit(i)}
                          className="text-text-tertiary hover:text-red-400 transition text-sm"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-text-tertiary mt-4">
              Tu peux passer cette etape et ajouter un projet plus tard depuis ton dashboard.
            </p>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-lime/10 border border-lime/30 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-lime" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold text-text-primary mb-3">
              Ton profil est en attente de validation
            </h1>
            <p className="text-text-secondary max-w-md mx-auto mb-8">
              Nous verifions chaque profil manuellement pour garantir la qualite de la plateforme.
              Tu recevras un email des que ton profil sera approuve.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => router.push("/")}
                className="px-6 py-3 bg-lime text-[#0d0d0d] font-bold text-sm rounded-lg hover:brightness-110 transition"
              >
                Retour a l&apos;accueil
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="px-6 py-3 border border-border-active text-text-secondary text-sm rounded-lg hover:border-border-hover hover:text-text-primary transition"
              >
                Aller au dashboard
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Navigation buttons */}
        {step < 4 && (
          <div className="flex justify-between mt-10">
            {step > 1 ? (
              <button
                onClick={prevStep}
                className="px-6 py-3 border border-border-active text-text-secondary text-sm rounded-lg hover:border-border-hover hover:text-text-primary transition"
              >
                Retour
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={nextStep}
              disabled={!canProceed() || loading}
              className="px-8 py-3 bg-lime text-[#0d0d0d] font-bold text-sm rounded-lg hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading
                ? "Envoi..."
                : step === 3
                  ? projectTitle
                    ? "Creer mon profil"
                    : "Passer et creer mon profil"
                  : "Continuer"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
