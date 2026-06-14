# Unkast — Roadmap & suivi d'avancement

> **Pour Claude Code :** ce fichier est la source de vérité de l'avancement produit.
> Après CHAQUE tâche réalisée : (1) coche la ligne correspondante, (2) déplace-la
> dans « ✅ Terminé » avec la date, (3) ajoute toute nouvelle tâche découverte en
> cours de route dans la bonne section, (4) mets à jour la date en bas.
> Ne supprime jamais une ligne terminée — on garde l'historique.

Dernière mise à jour : 14 juin 2026 (ajout chantiers 9 — anti-vol d'œuvre / authenticité des films — et 10 — invitation des collaborateurs crédités)

---

## ✅ Terminé

### Remise en ordre des fondations (audit post-restructuration)
- [x] **Resynchroniser le typage** — `src/types/database.ts` réécrit sur le schéma Supabase réel (15 tables, `profiles` 35 colonnes, `projects` 12 colonnes). *(14 juin 2026)*
- [x] **Régénérer la doc** — `database.md`, `architecture.md`, `api-routes.md` mis à jour sur le réel ; corrections factuelles (`MAX_PROJECTS_FREE=2`, `slugify()` centralisée, pas de N+1 dans search, `Navbar` supprimé, admin via API). *(14 juin 2026)*
- [x] **Audit RLS** — les 15 tables vérifiées : RLS active partout, policies saines (messages/conversations scopés aux participants, reports/waitlist/admin réservés admin). Pas de fuite. Doc RLS mise à jour. *(14 juin 2026)*

### Modèle de comptes (réconciliation rôle vs plan)
- [x] **Décision** — séparation nette : `account_type` = rôle (`talent`/`creator`/`recruiter`), `plan` = `free`/`pro`, indépendants. *(14 juin 2026)*
- [x] **Migration SQL** — 6 `member` → `talent`, contraintes CHECK posées sur `account_type` et `plan`. *(14 juin 2026)*
- [x] **Code aligné** — `member` retiré partout, `auth/callback` crée en `talent`, type `AccountType` strict, règle `recruiter ⇒ pro` ancrée à l'approbation admin. *(14 juin 2026)*

### Chantier 1 — Rendre le Pro réel ✅ BOUCLÉ
- [x] **Plafond films plan-aware** — `MAX_PROJECTS_PRO = 30` ; 2 si free / 30 si pro (lu côté serveur). UI `/moi` + `DashboardClient` affichent la limite selon le plan. *(14 juin 2026)*
- [x] **Badge « Je recrute »** — réservé Pro + rôle creator/recruteur (gate serveur, forcé `false` sinon). Toggle UI masqué si non éligible. *(14 juin 2026)*
- [x] **Prix page /pro** — « 9,99 €/mois ou 99,90 €/an (2 mois offerts) », « illimité » → « 30 films » (sur /pro et carte upsell /moi). *(14 juin 2026)*
- [x] **Mise en avant recherche** — tie-break Pro modéré, critère secondaire (`plan` jamais exposé, jamais « Pro d'abord »). Appliqué à `/api/search` + `recherche/page.tsx`. *(14 juin 2026)*
- [x] **Rôle modifiable** — bascule `talent ↔ creator` par l'utilisateur ; toute autre transition → 403 ; `creator → talent` nettoie le badge ; `plan` jamais touché. Switcher UI dans /moi (onglet Compte). *(14 juin 2026)*

### Chantier 4 (partiel) — Formats des œuvres
- [x] **Moyen / long métrage** — `moyen-metrage` et `long-metrage` ajoutés à l'enum `project_category` (migration SQL manuelle), au type TS, aux labels (« Moyen métrage »/« Long métrage ») et couleurs, à `VALID_CATEGORIES` (pages catégorie) et aux cartes de filtre recherche. Ordre UI : court → moyen → long → reste. *(14 juin 2026)*

### Chantier 5 — Refonte UI desktop ✅ BOUCLÉ
- [x] **Feed/Accueil desktop façon Netflix** — conteneur centré `max-w-[1600px]` ; hero **billboard** desktop (backdrop crossfade + texte + boutons à largeur intrinsèque + rail de vignettes), le fan 3D restant le hero **mobile inchangé** ; rangées agrandies/aérées + cartes au survol (framer-motion sobre) ; **boutons trop larges corrigés** (hero + `ConversionBanner` en toast bas-droite). 100 % en `lg:`, mobile préservé par construction. Sert de **modèle visuel** pour les autres pages. *(14 juin 2026)*
- [x] **Profil desktop** — conteneur `max-w-[1600px]` (langage Feed, `lg:px-12 xl:px-16`, respiration `lg:py-10`), rail gauche sticky conservé, **grille de projets `xl:grid-cols-2`** (fini la colonne étirée), cartes au survol harmonisées (bord + ombre), bouton « Contacter » aligné Feed. Mobile préservé (espacement inclus). *(14 juin 2026)*
- [x] **Projet desktop** — création d'une mise en page 2-colonnes (inexistante avant) : **bannière cinéma plein-bleed** (titre/année en surimpression) puis grille `max-w-[1280px]` `[1fr_360px]` ; **sidebar sticky** = fiche technique + Regarder (intrinsèque) + carte « Réalisé par » + CTA crédit ; « Du même réalisateur » repris en **cartes Feed** (16:9). Boutons larges corrigés. Mobile préservé via `lg:hidden`/`hidden lg:block`. *(14 juin 2026)*
- [x] **Recherche, Dashboard, /Moi desktop** — pages-outils contenues : **/Moi** et **Dashboard** resserrés en colonne de lecture `max-w-2xl` (fin des champs `w-full` qui traversaient l'écran) ; **Recherche** en `max-w-[1600px]`, grille de catégories `md:grid-cols-3 lg:grid-cols-4`, champ+filtres en `lg:max-w-2xl`, **résultats en grille de cartes Feed** sur desktop (liste compacte conservée sur mobile). Boutons primaires alignés Feed. *(14 juin 2026)*

---

## 🔜 Chantiers à venir (par ordre de priorité recommandé)

### Chantier 2 — Recrutement (Je recrute / Disponible) *(nouvelle fonctionnalité)*

**Concept général.** Le recrutement ne passe **pas** par des fiches projet ni des annonces (Unkast n'est pas un site d'annonces). **Aucune information sur le film** n'est montrée au talent : ni titre, ni pitch, ni genre. Sur le profil d'un **Pro recruteur/créateur**, un badge « Je recrute » affiche **uniquement les postes recherchés** (acteur, cascadeur, chef opérateur, machiniste…). Le talent juge l'opportunité **en regardant l'œuvre du recruteur** : ses films réalisés **ET** ses crédits croisés (`project_credits`). Un directeur de casting sans films propres est jugé sur les films où il est crédité.

**Côté talent (gratuit).** ✅ codé *(14 juin 2026)* — base créée (migration `20260614_recruitment.sql`, 4 tables + RLS), types, route `/api/availability` (GET/POST/PATCH/DELETE), bloc « Te signaler disponible » sur `profil/[slug]`.
- [x] Sur un profil qui affiche « Je recrute », le talent clique **« Disponible »** pour **un poste précis** parmi ceux affichés. C'est un **signal**, pas un message (zéro texte → zéro spam). *(bouton par poste, masqué pour les Pro / sur son propre profil ; invite à se connecter si anonyme. `is_recruiting` sert de proxy de Pro — `plan` jamais exposé publiquement.)*
- [x] Le signal **expire automatiquement après 30 jours**, **prolongeable** (actions « Prolonger » / « Retirer »). *(Rappel avant expiration : à câbler plus tard, non bloquant.)* Affichage filtré sur `expires_at > now()`.
- [x] Le talent **ne voit jamais** les films du recruteur ni s'il a été écarté/rangé — garanti **structurellement** par la RLS (tables dossiers/écartement sans aucune policy SELECT talent).

**Côté recruteur (Pro) — espace de pré-casting privé.** ✅ codé *(14 juin 2026)* — onglet « Recrutement » dans `/moi` (composant `RecruitmentSpace`, visible dès qu'on est Pro createur/recruteur, indépendant du badge), routes `/api/recruitment/*` (candidates, folders, folders/[id], dispatch, dismissals).
- [x] Reçoit **une seule liste de candidatures par poste** (signaux actifs `MINUS` écartés, jointe au profil talent — cliquable vers `/profil`).
- [x] Dispose de **dossiers-films privés** : créer/renommer/supprimer ; **dispatch** d'un candidat dans un ou plusieurs dossiers (cases à cocher « Ranger ») ; même personne dans plusieurs films, plusieurs candidats par poste.
- [x] Peut **écarter** un profil — **silencieux** (le talent n'en sait rien, garanti RLS) ; UX = **undo toast** (« Annuler » quelques secondes) plutôt qu'un confirm.
- [x] Pour contacter un candidat retenu → **messagerie Pro existante** (`/api/messages/conversation` → `/messages/<id>`, aucune route recréée).
- [x] **Pro ↔ Pro** : contact direct (déjà en place via la messagerie Pro), sans passer par « Disponible ».
- [x] **Vue d'un dossier** = casting idéal par film (candidats rangés, groupés par poste) avec « Contacter » / « Retirer du dossier ».

**Crédibilité & confiance.** ✅ codé *(14 juin 2026)* — migration `20260614_recruiter_verification.sql` (`bio_pending`, `recruiter_verified`, `recruiter_verified_at`, `recruiter_review_status`), PATCH profil (bio recruteur → en attente), `api/admin` + interface (modifs en attente, vérifier/retirer), badge sur le profil public, bandeau /moi.
- [x] La confiance repose **entièrement sur la validation manuelle par l'admin** (IMDb/AlloCiné abandonné).
- [x] Un recruteur **décrit son parcours dans sa description** (films faits, postes occupés — **texte libre, option A**). Cette description n'est **publiée qu'après validation admin** (`bio` publique vs `bio_pending`).
- [x] **Badge « recruteur vérifié »** (`recruiter_verified`) accordé/retiré par l'admin (`grant_recruiter_verified` / `revoke_recruiter_verified`).
- [x] **Re-vérification obligatoire après modification** : toute modif de la description **repasse par la validation admin** ; le public voit la **dernière version validée**. Empêche l'auto-attribution de faux crédits sous couvert du badge.
- [x] **Pattern réutilisé** : même logique `pending → approved` que la modération des films.
- [x] **Champs sensibles** (description pro) ↔ **anodins** (avatar, localisation, liens, coordonnées → publication directe) bien distingués.
- [x] **Décision badge** : une modif en attente **ne met pas** le badge en pause (le public ne voit que la version validée) ; seuls un refus+révocation explicite ou une suspension le retirent.
- [ ] *(évolution future, non prioritaire)* champ **structuré** `recruiter_credits` pour les films revendiqués (au lieu du texte libre dans la bio) — à reconsidérer à l'usage. Réalisateur jugé par ses films / directeur de casting par ses **crédits croisés** reste le principe.

**Existant réutilisable (déjà en base) :** `is_recruiting`, `recruiting_roles` (badge Je recrute), `project_credits` (crédibilité), workflow recruteur (`recruiter_status`/`recruiter_company`/`recruiter_document_url`).
**État :** ✅ **chantier 2 totalement bouclé** *(14 juin 2026)* — côté talent (signal « Disponible »), côté recruteur (espace de pré-casting : candidatures par poste, dossiers-films, dispatch, écartement, contact) **et** Crédibilité & confiance (description pro validée par l'admin + badge « recruteur vérifié » + re-vérification des champs sensibles) sont livrés. **Restent (non bloquants, hors cœur)** : le **rappel avant expiration** d'un signal ; le champ structuré `recruiter_credits` (évolution) ; les notes futures ci-dessous.

**Notes / évolutions futures (non prioritaires).**
- [ ] Lien **IMDb / AlloCiné** pour importer la crédibilité de gros professionnels dont l'œuvre n'est pas sur Unkast → chantier séparé, lourd (accès données, juridique), à reconsidérer plus tard. La validation manuelle + badge vérifié suffit au lancement.
- [ ] Le **crédit croisé** sert aussi de **filtre anti-faux-recruteur** (à relier au chantier 3 modération).
- [ ] **Reste à concevoir au prochain cycle :** cycle de vie complet d'un signal, UI de l'espace de pré-casting, cas du **talent multi-métiers**.

### Chantier 3 — Modération / sécurité / anti-abus ✅ BOUCLÉ *(14 juin 2026)*
Audit puis correctifs priorisés. Garde commun `getActiveUser` ([lib/auth-guard.ts](../src/lib/auth-guard.ts)).
- [x] **Signalement visible** : boutons sur profils + films (existants) **+ ajouté dans les conversations** (`messages/[id]` → `ReportModal` ciblant le profil de l'interlocuteur, actionnable admin).
- [x] **Signalements groupés** → **alerte prioritaire** (pas de gel auto, décision actée) : `api/admin` trie par `total_reports` desc + flag `urgent` à ≥3 ; remontée en tête + marqueur « URGENT » dans l'UI admin.
- [x] **Suspension réellement effective** (était le trou n°1) : (a) **garde serveur** `getActiveUser` bloque les comptes suspendus sur messages/reports/availability/recruitment ; (b) **retrait de la vue publique** (recherche, feed, profil → 404, projet → 404 si owner suspendu).
- [x] **Plafond conversations/jour + délai relance** : déjà en place (messagerie : 5/j + 48 h) — confirmé à l'audit.
- [x] **Masquage des coordonnées** *(en conversation)* : déjà actif (regex, < 3 messages). Côté **profil** : réglages `show_*_to` **non branchés** → cleanup (helper mort supprimé, toggles masqués ; coordonnées jamais affichées publiquement — cohérent anti-fuite).
- [x] **Rate-limit** ajouté sur `api/reports` (10/h), `api/availability` (30/h), `api/recruitment/*` écritures (60/h) — réutilise `checkRateLimit`.
- [x] **Faux recruteurs / anti-prédateurs** : validation manuelle recruteur + badge vérifié (chantier 2) + signalement + suspension effective + coordonnées masquées en chat = combinaison en place.
- [x] **Contournement creator-spam** : atténué (Pro payant + 5 conv/j + coordonnées bloquées + signalement).
- [ ] *(évolution future, non prioritaire)* exploiter les **crédits croisés** comme signal anti-faux-profil automatisé ; bloquer les **API en lecture** pour un suspendu (aujourd'hui seules les écritures le sont).

### Chantier 4 — Formats & modélisation des œuvres
- [x] Ajouter **moyen métrage** et **long métrage** à l'enum `project_category`. ✅ *(voir « Terminé », 14 juin 2026)*
- [ ] Gérer les **séries** : regrouper des épisodes en une seule œuvre, pour qu'une série compte comme 1 entrée dans le plafond (vs 12 épisodes = 12 films). Changement de structure (la base ne connaît que des projets isolés).
- [ ] Revoir le plafond Pro (30) à la lumière des séries.

### Chantier 5 — Refonte mise en page (UI) ✅ BOUCLÉ
- [x] **Toutes les pages principales déclinées en desktop** — Feed, Profil, Projet, Recherche, Dashboard, /Moi : largeurs maîtrisées, cartes Feed, boutons intrinsèques, mobile préservé. *(voir « Terminé », 14 juin 2026)*
- [ ] *(polish optionnel, non bloquant)* fondus dégradés en bord de rangée (écartés à cause du bleed `-mx`) ; quelques ajustements mobiles ponctuels si besoin.

### Chantier 6 — Valorisation du mérite / engagement *(à creuser, PAS d'étoiles classiques)*
- [ ] Trouver un système qui fait remonter la qualité sans punir l'audace ni noter les personnes.
- [ ] Pistes retenues : signal **positif uniquement** (coup de cœur, pas de mauvaise note) ; ou mise en avant par **engagement réel** (vu jusqu'au bout, partagé, équipe contactée) ; ou **recommandations entre pairs** (fiabilité/professionnalisme).
- [ ] Éviter : notes par étoiles classiques (subjectives, punitives, truquables, attachent une mauvaise note à des talents qui ne contrôlent pas l'ensemble).

### Chantier 7 — Paiement Stripe *(architecture construite en MODE TEST — 14 juin 2026)*
Système complet et testable, **à basculer en live à la fin du dev** (rien encaissé).
- [x] **Schéma** — migration `20260614_stripe_billing.sql` : `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `current_period_end`, `pro_source` (+ index). `plan`/`pro_since` restent la porte effective.
- [x] **SDK + client** — `stripe` (Node) + `src/lib/stripe.ts` (clé via env, singleton paresseux).
- [x] **Routes** — `api/billing/checkout` (Checkout Session mensuel/annuel), `api/billing/webhook` (**seule source de vérité**, signature vérifiée sur raw body, pose/retire le Pro), `api/billing/portal` (Customer Portal). Pages `/pro/success` & `/pro/cancel`.
- [x] **`/pro`** — boutons Mensuel/Annuel/« Gérer » visibles si `NEXT_PUBLIC_BILLING_ENABLED===true` **OU** `is_admin` (test) ; sinon **waitlist publique conservée** ; bandeau « mode test ».
- [x] **Garde-fou coexistence** — `set_pro`/`approve_recruiter` posent `pro_source='admin'` ; le webhook ne touche jamais un profil sans `stripe_customer_id` **ni** un `pro_source='admin'` (Pro manuel = à vie). Décision : pas d'essai gratuit.
- [ ] **Côté Stripe (à faire par l'admin, MODE TEST)** : créer Produit + 2 prix (9,99 €/mois, 99,90 €/an), récupérer `sk_test_`, configurer le webhook test (CLI `stripe listen` ou endpoint), activer le Customer Portal, renseigner `.env.local`.
- [ ] **Passage en LIVE (lancement)** : activer le compte (entité Dubaï), recréer Produit/prix en live, clés `sk_live_`, webhook live sur `app.unkast.com`, Portal live, env vars Vercel Production, `NEXT_PUBLIC_BILLING_ENABLED=true`. Dubaï → digital, **pas** de TVA/facturation FR ; confirmer Stripe Tax off, devise EUR.
- Tarifs actés : 9,99 €/mois ou 99,90 €/an (2 mois offerts). Prérequis Pro (chantier 1) — fait.

### Chantier 8 — Recherche intelligente *(découlé du chantier 1)*
- [ ] La recherche trie aujourd'hui par ordre alphabétique, pas par pertinence réelle. Construire un vrai score de correspondance (métier cherché, localisation…). C'est ce qui donnera tout son sens à la « mise en avant Pro ».

### Chantier 9 — Authenticité des films / anti-vol d'œuvre *(à concevoir plus tard)*
**Problème** : Unkast repose sur « on est crédible par son œuvre ». Rien n'empêche aujourd'hui de coller l'URL YouTube/Vimeo du film d'un autre et de se l'attribuer. Impossible à bloquer à 100 % techniquement ; **objectif = rendre la triche risquée et réparable.** Couches retenues, par priorité :
- [x] **(priorité) Détection des doublons** ✅ *(14 juin 2026)* : identifiant **canonique** `youtube:<id>`/`vimeo:<id>` (`extractVideoKey`, `lib/utils.ts`) stocké en colonne `projects.video_key` ; **index unique partiel** `WHERE video_key IS NOT NULL` (dernier rempart). Vérif applicative dans `api/dashboard/projects` (POST → **409**) et `api/signup` (compte créé, **film sauté** + avertissement, jamais de refus global). Filet course `23505` → 409. Migrations manuelles en 3 temps (A colonne+backfill+détection / resolve / B index). Films non normalisables (`video_key` NULL) jamais bloqués. **Restent** : crédit croisé social + motif de signalement ciblé (couches suivantes).
- [ ] **Crédit croisé comme preuve sociale** : un vrai film crédite une équipe reliée ; un film volé est **orphelin**. Si le vrai auteur est sur Unkast, il voit son film sur un profil imposteur et peut le signaler.
- [ ] **Signalement ciblé** « ce film n'est pas de cette personne » : ajouter ce **motif** au système `reports` existant ; l'admin tranche.
- [ ] *(plus tard, lourd, NON recommandé au lancement)* **Vérification de propriété** : code unique à insérer dans la description YouTube/Vimeo, ou preuve de contrôle de la chaîne. Friction pour les vrais utilisateurs → à reconsidérer **seulement si** le problème devient réel.
- *Note* : la modération existante (`reports` + suspension, chantier 3) couvre déjà la **réparation** des cas. Le manque réel = la **détection des doublons**.

### Chantier 10 — Invitation des collaborateurs crédités ✅ BOUCLÉ *(14 juin 2026)*
**Objectif** : quand on poste un film, les personnes créditées ne sont pas forcément sur Unkast. Permettre de **(a)** chercher un collaborateur déjà sur Unkast pour le créditer, ou **(b)** **inviter par email/lien** quelqu'un qui n'y est pas. **Moteur d'acquisition naturel.**
**Livré** : migrations `20260614_invitations_email_A.sql` (colonnes `credit_id`/`inviter_id`/`status`/`expires_at` + durcissement `token` UUID unique + détection doublons) et `_B.sql` (unicité `(lower(email), project_id)`). `lib/email.ts` (client **Resend paresseux**, email sauté en dev sans clé). `POST /api/invitations` durci + `GET /api/invitations/claim`. Rattachement au signup. Éditeur d'équipe dans MoiClient + DashboardClient ; `RejoindreClient` lit `?invitation=<token>` (pré-remplit + verrouille l'email).
- [x] **Plafond strict** : `invite:<userId>` **5/jour** **+** `invite:global` **200/jour** (double garde-fou individuel + anti-attaque coordonnée), via `rate_limits` → 429.
- [x] Invitation **TOUJOURS liée à un crédit réel** : la route crée le **ghost credit** dans le même appel, exige un projet **possédé** par l'inviteur ; pas d'envoi d'email libre.
- [x] Envoi via **Resend uniquement** (`lib/email.ts`), jamais de SMTP serveur ; clé en **variable d'env** (`RESEND_API_KEY`/`INVITE_FROM_EMAIL`).
- [x] **Une seule invitation par (email, projet)** (index unique) → 409 ; **token usage unique + expirant 30 j**.
- [x] Flux complet : créditer → absent → invitation email → inscription `?invitation=<token>` → **rattachement ghost_credit → compte UNIQUEMENT si email du compte == email invité** (anti-détournement) ; route `claim` **ne révèle rien** si invalide (anti-énumération).
- [ ] *(évolution future)* webhook Resend pour gérer bounces/désabonnements ; relance manuelle encadrée.

---

## 📌 Décisions produit actées (référence)

- **Talent** = gratuit. Explore, référencé dans les films, visible, reçoit et répond aux messages. **Ne peut jamais initier** un contact.
- **Pro** (9,99 €/mois ou 99,90 €/an) = pour ceux qui cherchent (créateurs/recruteurs). Débloque : initier contacts, 30 films, mise en avant recherche, badge « Je recrute ».
- **Prix unique** : pas de tarif différent selon le rôle.
- **Badge « Je recrute »** : réservé au Pro + rôle creator/recruteur.
- **Rôle modifiable** par l'utilisateur (`talent ↔ creator`) ; devenir `recruiter` passe par la validation admin.
- **Flux fondamental** : recruteur/créateur → talent. Unkast n'est **pas** un site d'annonces ; on découvre par l'œuvre.
- **Règle messagerie** : initier = Pro ; recevoir/répondre = tout le monde (déjà codé).
- **Ergonomie messagerie — premier message** *(14 juin 2026)* : pour éviter d'« épuiser » l'unique message autorisé (règle relance 48h) par un envoi accidentel — (1) **Entrée = saut de ligne**, envoi seulement via le bouton (ou Ctrl/Cmd+Entrée desktop) ; (2) **avertissement** au-dessus du champ au 1er message ; (3) **pop-up de confirmation** (Modifier / Envoyer) au 1er message uniquement. « Premier message » = conversation existante sans message (`messages.length === 0`).
- **Canal de contact unique = la messagerie** *(nettoyage, 14 juin 2026)* : l'ancien formulaire `contact_requests` (`ContactModal` + `/api/contact` + `/api/dashboard/contacts`) est retiré du code. Le bouton « Contacter » d'un profil : **Pro** → ouvre une conversation directe (`/api/messages/conversation` → `/messages/<id>`) ; **gratuit** → CTA `/pro` ; **anonyme** → CTA `/rejoindre`. Table `contact_requests` conservée en base (legacy, pas de `DROP`).
