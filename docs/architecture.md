# Unkast — Architecture

> Mis a jour 2026-06-13 (audit doc vs code). Le code a depasse le MVP : ajout de l'admin,
> la messagerie, les credits, les invitations, les comptes Pro/recruteur, la suspension,
> les notifications push. Toutes les routes ci-dessous sont sous le groupe `src/app/(app)/`.

## Stack technique

- **Framework** : Next.js 16.2.0 (App Router) + React 19 + TypeScript 5
- **Backend / BDD / Auth** : Supabase (PostgreSQL + Auth + RLS)
- **Hosting** : Vercel
- **Styling** : Tailwind CSS 4
- **Animations** : framer-motion 12
- **Video** : react-player 3 (embeds Vimeo/YouTube)
- **Mobile natif** : Capacitor (Android) — notifications push via `@capacitor/push-notifications` + FCM
- **Email** : resend 6 (dependance installee, **toujours pas connectee**)

## Legende

```
CORE     = Infrastructure de base (layout, auth, navigation)
FEATURE  = Fonctionnalite metier (page principale)
SUB      = Sous-fonctionnalite d'une FEATURE
HOOK     = Hook React custom
UTILITY  = Helper / utilitaire

RELATIONS :
  [utilise]       = Importe et utilise directement
  [declenche]     = Provoque une action dans
  [depend de]     = Ne fonctionne pas sans
  [persiste dans] = Ecrit/lit dans cette table
```

## Coeur (CORE)

```
CORE  Layout racine (src/app/layout.tsx)
  HTML wrapper, metadata, fonts, PWA manifest. NE contient PAS AppShell.
  Script inline en tete de <body> (chantier 7, 08/10/2026) : sur Android (user agent), pose la
  classe .lite sur <html> avant le premier rendu → tout .glass / .glass-strong devient opaque,
  sans backdrop-filter (regles .lite de globals.css). Vaut pour toute l'app, admin compris.
  Viewport : interactive-widget=resizes-content (le clavier virtuel redimensionne la mise en page).

CORE  Layout app (src/app/(app)/layout.tsx)
  [utilise] AppShell (enveloppe toutes les pages du groupe (app))

CORE  AppShell (src/components/AppShell.tsx)
  Sidebar desktop + navigation mobile + header. Indicateur anime (framer-motion layoutId).
  En-tete desktop (lot 7, 09/10/2026) : champ de recherche centre « Un film, un talent, un metier »
  (Ctrl K ou Cmd K), Entree envoie vers /recherche?q= ; absent sur /recherche. Remplace le libelle
  de section et l'icone loupe.
  [utilise] framer-motion, LiquidDock, MobileTabBar ; [depend de] next/navigation (usePathname)
  Deux rendus de navigation mobile (07/10/2026), choisis en CSS par la classe app-installed
  sur <html> : LiquidDock si l'app est installee (Capacitor natif ou PWA standalone),
  MobileTabBar (barre plate) dans un navigateur — rendu par defaut. La classe est posee par un
  script inline rendu dans le HTML serveur (avant le premier rendu, sans flash) et par un
  useLayoutEffect (montage client depuis /). Les deux nav sont dans le DOM, une seule affichee.
  Hauteur du shell : 100dvh (repli 100vh) ; clavier ouvert, elle suit visualViewport.
  Conversation (/messages/[id]) en mobile : header d'AppShell masque, navigation masquee,
  <main> sans defilement — la page occupe toute la zone visible.
  Refonte verre liquide (07/10/2026) : sidebar flottante .glass-strong (marges 14 px, rayon 30),
  indicateur = pastille verre + trait citron, header .glass-strong (dans le flux, PAS en
  surimpression : ProfileClient et ProjetClient ont des colonnes lg:sticky qui passeraient dessous).
  Reserve basse (chantier 5, 07/10/2026) : <main> porte .pb-tabbar (globals.css) et reserve seul
  la navigation mobile pour TOUTES les pages : 56 px + safe area (barre plate du navigateur),
  92 px + safe area (dock de l'app installee : 88 px + 4 px d'air), 0 en desktop. Les pages ne
  reservent plus rien (ni .pb-tabbar, ni pb-16) ; rien dans une conversation (navigation masquee).
  En-tete mobile : pas de titre de page sur /rejoindre (il ne tient pas a 360 px a cote de
  « Se connecter » et « Rejoindre ») ; « Se connecter » ne passe jamais a la ligne.
  Navigation masquee (prop hidden) dans une conversation ouverte et quand le clavier virtuel est
  ouvert : useKeyboardOpen(), hook local a AppShell (focus d'un champ de texte + visualViewport).

CORE  MobileTabBar (src/components/MobileTabBar.tsx) — barre d'onglets mobile du NAVIGATEUR
  Plate, .glass-strong, collee en bas, 56 px + safe area. Onglet actif = icone + libelle citron.
  Memes props que LiquidDock (items, activeIndex, hidden). Masquee si html.app-installed.

CORE  LiquidDock (src/components/LiquidDock.tsx) — dock mobile de l'APP INSTALLEE (html.app-installed)
  Barre flottante 56 px (marges 12, bas = safe-area-inset-bottom + 10), bille citron 44 px qui
  depasse de 14 px sur l'onglet actif, collerette 60 px fusionnee a la barre par un filtre SVG
  goo (#dock-goo). Hauteur totale depuis le bas : 88 px + safe area.
  Fond OPAQUE obligatoire (#121217), lisere produit par le filtre. Deplacement en CSS
  (600 ms ease-dock, collerette +140 ms), coupe par la regle reduced motion de globals.css.
  L'icone ne passe en sombre qu'a l'arrivee de la bille (transition de couleur retardee de 420 ms).
  Props : items (href, label, icon, badge), activeIndex (-1 = aucun onglet actif, pas de bille),
  hidden (sort par le bas en 250 ms, fondu seul en reduced motion, nav inerte).
  [depend de] globals.css (--accent-gradient, --accent-halo, duration-slower, ease-dock)

CORE  SplashScreen (src/components/SplashScreen.tsx)
  Video /public/splash.mp4, une fois par session (sessionStorage).

CORE  Proxy (src/proxy.ts, ex-middleware.ts — renomme 2026-08-10 via le codemod officiel
  `npx @next/codemod middleware-to-proxy`, Next 16 deprecie la convention "middleware")
  Rafraichit la session Supabase + applique les redirections de garde.
  [utilise] src/lib/supabase/middleware.ts (nom de fichier inchange, ce n'est pas
  le fichier de convention — seule la fonction exportee `updateSession` compte)
  Logique : lit profiles.is_admin (fail-closed, service role) et profiles.is_suspended
  (ex. redirige vers /suspended). Lecture de is_suspended (client utilisateur, RLS) :
  transitoire (reseau/5xx/pool) → FAIL-OPEN + log ; PGRST116 (profil Auth orphelin,
  permanent) → FAIL-CLOSED, redirige vers /compte-introuvable (pas /suspended, qui
  mentirait sur la cause).

CORE  Supabase Server Client (src/lib/supabase/server.ts)   — SSR/API (cookies)
CORE  Supabase Browser Client (src/lib/supabase/client.ts)  — navigateur
CORE  Supabase Admin Client (src/lib/supabase/admin.ts)     — service role (bypass RLS, usage admin)

CORE  Constants (src/lib/constants.ts)
  CATEGORY_COLORS, CATEGORY_LABELS, MAX_PROJECTS_FREE (= 3), MAX_PROJECTS_PRO (= 30),
  ACCOUNT_TYPES, ROLES_BY_CATEGORY, ALL_ROLES, ROLE_CATEGORIES, POPULAR_ROLES

CORE  Types (src/types/database.ts) — SOURCE DE VERITE du schema (introspecte 13/06/2026)
  15 interfaces de tables : Profile (35 col.), ProfileRole, Project (12 col.), ProjectCredit,
    ContactRequest, Conversation, Message, CreditRequest, Invitation, ProjectInvitation,
    AdminLog, PushToken, RateLimit, Report, Waitlist
  4 vrais enums Postgres : ProfileStatus, ProjectCategory, ContactSubject, ContactStatus
  Contraints par CHECK : AccountType (talent/creator/recruiter), Plan (free/pro)
  Pseudo-enums (colonnes TEXT libres, NON contraintes en base) : RecruiterStatus,
    DisplayNamePreference, VisibilityAudience, ProjectStatus, CreditRequestStatus,
    InvitationStatus, ReportStatus, WaitlistStatus
  NB : pas de type `Database` (clients Supabase non generiques). Voir docs/database.md.
  ⚠️ supabase/schema.sql est en retard (5 tables) — a regenerer.

CORE  Motion Primitives (src/components/motion.tsx)
  Variants staggerContainer/fadeUp/fadeIn/scaleIn, cardHover, FadeInView, ModalBackdrop
  Verre liquide (07/10/2026) : cardSpring (260/28), listStagger (80 ms), enterUp (18 px + flou
  8 px, 450 ms), enterFade (variante reduced motion), EnterList / EnterItem (useReducedMotion)
  Chantier 5 : enterUp / enterFade finissent sur filter: none (transitionEnd), pour qu'un .glass
  enfant continue de flouter les halos du fond ; ModalBackdrop = panneau .glass-strong teinte
  (bg-glass-solid/80), rounded-panel.
  Chantier 7 : ModalBackdrop ne se ferme que si mousedown ET clic ont lieu sur le fond (un
  glisser de selection de texte commence dans la modale ne la ferme plus).

UTILITY  lib/utils.ts        — slugify() PARTAGE (utilise par signup, dashboard/projects, auth/callback)
UTILITY  lib/rate-limit.ts   — checkRateLimit() (RPC check_rate_limit, FAIL-CLOSED ; RPC absente toleree hors prod)
UTILITY  lib/messaging.ts    — quota conversations/jour PARTAGE (DAILY_CONVERSATION_LIMIT, countConversationsInitiatedToday)
UTILITY  lib/api.ts          — readJsonBody()/invalidBodyResponse() : body JSON defensif, 400 uniforme (toutes les routes a body)
UTILITY  lib/push.ts         — envoi de notifications push (lit push_tokens)
UTILITY  lib/firebase-admin.ts — init FCM cote serveur
UTILITY  lib/profile.ts      — helpers profil

HOOK  useUserStatus (src/hooks/useUserStatus.ts)        — "anonymous" | "free" | "pro"
HOOK  usePushNotifications (src/hooks/usePushNotifications.ts) — enregistrement push natif (Capacitor)
```

## Fonctionnalites (FEATURE)

```
FEATURE  Welcome / racine — / (src/app/page.tsx + WelcomeClient.tsx)

FEATURE  Feed — /feed (src/app/(app)/feed/page.tsx) [Server Component]
  Bloc « A la une » + rangees par categorie + talents a decouvrir.
  [utilise] HeroCarousel, FilmRow, HomeAnimations, ConversionBanner, FilmPoster, FilmLink
  Lot 7 (09/10/2026) : HeroCarousel = bloc arrondi 32 px, texte a gauche (A LA UNE 01 / 05, titre,
  FilmMeta, description sur 2 lignes, avatars de l'equipe, « Voir le film », « Voir l'equipe »,
  fleches sur la ligne des boutons), affiche a droite dans un cadre fixe 16:9 (une colonne sous xl,
  affiche en haut). Hauteur du bloc constante d'un film a l'autre : titre et description sur 2
  lignes reservees, ligne equipe toujours presente. Lumiere =
  l'affiche tres floutee (.film-ambient) sous un voile sombre, puis les 5 films en vignettes avec
  barre de progression (8 s par film, minuteur JS + .hero-progress). Le carrousel 3D mobile et
  HeroPlayer.tsx sont supprimes. FilmRow (client) = rangee avec fleches et fondu du bord droit
  (masque). RestoreFilmScroll remet le defilement du <main> au retour d'un film.
  [persiste dans] profiles, projects, profile_roles, project_credits (lecture)
  Verre liquide (chantier 4, 07/10/2026) : infos du film en text-sheen + pilule categorie a point
  de couleur, cartes video rounded-media (ombre, elevation au survol, lecture en verre), talents
  en GlassCard. ConversionBanner = pilule .glass-strong posee 12 px au-dessus de la navigation
  mobile (bottom 68 px + safe area en navigateur, 100 px + safe area si html.app-installed,
  bottom-6 en desktop), avec un espaceur de 72 px dans le flux quand elle est visible.
  Elle ecoute le defilement du <main> d'AppShell (premier <main> du document, c'est lui qui
  defile, pas window) et apparait apres 300 px, visiteur non connecte seulement (corrige au
  chantier 5 : elle ecoutait window.scrollY et ne s'affichait jamais).

FEATURE  Profil public — /profil/[slug] (src/app/(app)/profil/[slug]/) [Server + ProfileClient]
  Fetch profil approuve + roles + projets + credits. Bouton contact + partage.
  [utilise] ProfileClient, VideoEmbed, ContactModal, ReportModal
  Verre liquide (chantier 4) : colonne gauche en panneau .glass (toujours lg:sticky), avatar
  112 px avec halo citron, Badge Disponible / Recruteur verifie (pas de badge Pro : `plan` n'est
  pas expose au client par page.tsx), metiers en Chip.
  Filmographie (lot 5, 09/10/2026) : une seule liste « Films » = films publies par la personne
  (elle en est Responsable) + films ou elle est creditee, sans doublon, tries par annee. Filtre
  Tous / Publies / Credite en Chip (affiche seulement si la fiche mele les deux), qui remplace
  le filtre par categorie. Chaque carte montre le role de la personne. Visibilite : public pour
  tous, membres pour les connectes, carte verrouillee (avec le role) pour un visiteur.

FEATURE  Page projet — /projet/[slug] (src/app/(app)/projet/[slug]/) [Server + ProjetClient]
  Lot 7 (09/10/2026) : « Retour », lecteur 16:9 (max 1080 px, affiche entiere, aucun texte dessus,
  lumiere floutee derriere), mention cookies, puis deux colonnes : FilmMeta, titre, description,
  « Lancer le film », « Partager », equipe en generique (role, avatar, nom jamais coupe ; le role
  passe au-dessus du nom quand la ligne est etroite), encart « Rejoindre »
  pour les visiteurs ; colonne collante : « Realise par », fiche technique, « Signaler ce film ».
  « Films lies » en grille de 4. Lecture dans le cadre en desktop, modale plein ecran en mobile,
  toujours apres un clic. Le menu trois points est supprime. Duree non affichee (voir ROADMAP).
  [utilise] VideoEmbed, FilmPoster, FilmLink (FilmPlayerFrame), lib/film-transition
  Verre liquide (chantier 4) : hero en panneau rounded-panel dans le conteneur (plus bord a bord),
  cartes d'equipe, fiche technique et carte createur en GlassCard. Equipe et projets lies restent
  empiles (pas d'onglets).

FEATURE  Recherche — voir ci-dessous. Verre liquide (chantier 4) : bascule Parcourir / Rechercher,
  filtres et metiers en Chip, champ de recherche .glass, tuiles de categorie rounded-panel,
  resultats en GlassCard.

FEATURE  Recherche — /recherche (src/app/(app)/recherche/) [+ RechercheClient]
  Recherche debounced, filtres role/categorie/localisation. [declenche] GET /api/search
  ?q= (lot 7) : ouvre la page en mode Rechercher avec ce texte (champ de l'en-tete d'AppShell).

FEATURE  Categories — /categories/[slug] (src/app/(app)/categories/[slug]/)
  Listing par categorie (Server Component).
  Verre liquide (chantier 6, 08/10/2026) : titre text-sheen + compteur en Badge neutral (point a la
  couleur de la categorie), film a la une en panneau rounded-panel, grille de GlassCard (media
  rounded-media, 2 / 3 / 4 colonnes), etat vide en GlassCard, loading.tsx en squelette de verre.

FEATURE  Inscription — /rejoindre (src/app/(app)/rejoindre/ + RejoindreClient)
  Wizard multi-etapes. [declenche] POST /api/signup
  Verre liquide (chantier 6, 08/10/2026) : ProgressSteps (5 etapes), transition entre etapes =
  glissement de 40 px + fondu selon le sens (fondu seul en reduced motion), etapes en GlassCard,
  Field / Button / Chip partout. Annee du film : Chip sur les 5 dernieres annees + « Plus ancien »
  (revele les annees anterieures de la meme liste, payload inchange). Selects restants (categorie,
  poste recruteur) : brique ui/Select.
  [utilise] RoleSelector, ui/*, motion.tsx

FEATURE  Connexion — /connexion (src/app/(app)/connexion/ + ConnexionClient)
  Login. Callback OAuth/magic-link : src/app/(app)/auth/callback/route.ts
  Pas de « mot de passe oublie » (aucune route, aucun appel resetPasswordForEmail).
  Verre liquide (chantier 6) : carte GlassCard, Field, Button, titre text-sheen ; meme habillage
  pour /auth/confirm.

FEATURE  Dashboard — /dashboard, /dashboard/projets, /dashboard/contacts (+ DashboardClient)
  ⚠️ INATTEIGNABLE : next.config.ts redirige en permanent /dashboard* vers /moi. Le code reste
  en place mais n'a pas ete refait au chantier 6.
  Profil (view/edit), projets (CRUD, max 3 gratuit / 30 en Pro), contacts, credits.
  [declenche] /api/dashboard/{profile,projects,contacts,credits}, /api/avatar

FEATURE  Mon compte — /moi (src/app/(app)/moi/ + MoiClient + RecruitmentSpace + parts.tsx)
  Verre liquide (chantier 6, 08/10/2026) : en-tete permanent en verre (avatar a halo citron, nom
  text-sheen, Badge Pro / Recruteur verifie / Disponible / Validation en attente), onglets en Chip,
  jauge de films « X sur limite » (projectLimit existant), cartes de films avec statut en Badge,
  « Ajouter un film » en Button accent, formulaires en Field, squelette de verre.
  parts.tsx = sous-composants de presentation locaux (SectionLabel, FilmThumb, MoiSkeleton,
  ListSkeleton) ; Select, Toggle, Toast et les statuts sont des briques ui/ depuis le chantier 7. RecruitmentSpace : barre « ecarte / Annuler »
  portee dans <body> et calee au-dessus de la navigation mobile (68 px + safe area, 100 px si
  app-installed, 24 px en desktop).
  [utilise] RoleSelector, AvatarUpload, Avatar, ui/*, motion.tsx

FEATURE  Messagerie — /messages, /messages/[id] (src/app/(app)/messages/)
  Conversations + messages. Quotas (5 conv/j, anti-coordonnees, relance 48h).
  [declenche] /api/messages*  [persiste dans] conversations, messages
  Verre liquide (chantier 6, 08/10/2026), habillage seul. Liste : conversations en GlassCard
  (avatar, apercu, heure, compteur de non lus citron), recherche en Field, squelettes de verre.
  Conversation : bulles a moi en --accent-gradient (texte sombre), bulles des autres en
  `glass lite` (verre opaque SANS backdrop-filter : une bulle floutee par message couterait trop
  cher sur Android), en-tete .glass, barre de saisie .glass-strong. Pas d'animation d'entree sur
  les messages (defilement automatique). Structure plein ecran et logique inchangees.
  Champ de saisie en 16 px (pas de zoom iOS au focus), ligne de 22 px, padding vertical 8 px :
  40 px sur une ligne, 120 px max ; adjustTextarea ajoute les 2 px de bordure a scrollHeight.

FEATURE  Pro / Freemium — /pro (src/app/(app)/pro/)
  Page offre Pro. Deux sources cumulables (chantier grants, 10/08/2026) : abonnement Stripe
  (api/billing/checkout+webhook+portal) et Pro OFFERT par l'admin (grant, voir CRON ci-dessous).
  Bandeau "Pro offert" si grant valide ; boutons d'achat visibles si NEXT_PUBLIC_BILLING_ENABLED
  ou is_admin ; "Gerer mon abonnement" visible seulement si has_stripe_customer (pas juste isPro).
  Detail complet : docs/database.md section "Modele Pro".
  [utilise] /api/me (plan, pro_grant_type, pro_grant_expires_at, has_stripe_customer)
  (pro/page.tsx n'utilise pas useUserStatus.)
  Verre liquide (chantier 6, 08/10/2026) : deux panneaux GlassCard (Pro en strong, bord citron),
  prix en text-sheen 60 / 72 px, boutons en Button, liste d'attente en Field, pro/loading.tsx en
  squelette de verre (couvre aussi /pro/success et /pro/cancel). En mobile le panneau Pro passe
  en premier. Textes commerciaux et prix inchanges (a revoir avec la monetisation).

CORE  Cron expiration Pro — /api/cron/pro-expiry (src/app/api/cron/pro-expiry/)
  Vercel Cron quotidien (vercel.json, 0 6 * * *), secouru par CRON_SECRET (header Authorization).
  Recompute les grants 'launch' echus (RPC recompute_plan) + envoie le rappel J-7 avant echeance
  (lib/email.ts -> sendProExpiryReminderEmail). Jamais de balayage global sur profiles (index
  partiel profiles_pro_grant_expiry_idx).
  [persiste dans] profiles (plan via recompute_plan, pro_grant_reminder_sent_at)

FEATURE  Suspendu — /suspended (src/app/(app)/suspended/)
  Ecran pour comptes is_suspended (lit suspended_reason).

FEATURE  Compte introuvable — /compte-introuvable (src/app/(app)/compte-introuvable/,
  ajoutee 2026-08-10) — cible du fail-closed PGRST116 du proxy (src/lib/supabase/middleware.ts)
  sur un utilisateur Auth sans ligne `profiles` (orphelin, meme diagnostic que
  lib/auth-guard.ts). Pas de fetch dynamique (aucune ligne a lire). Contact
  pro@unkast.com (seule adresse avec un usage reel constate dans le code, mailto:
  a 4 endroits — contact@unkast.com de /suspended n'a aucune trace de configuration,
  pas de var d'env, pas de binding Resend, et n'est meme pas un lien cliquable).
  Mentionne que Google se repare seul (auth/callback recree le profil au relogin).

FEATURE  Admin — /admin (src/app/admin/ + AdminClient) — HORS groupe (app) depuis le 07/08/2026
  Espace structurellement separe de la vue client : pas d'AppShell, layout propre
  (src/app/admin/layout.tsx) avec garde serveur getAdminId() (lib/adminGuard.ts,
  helper partage avec /api/admin) + lien « Retour a l'app ». Entree cote client :
  lien « Administration » dans le menu utilisateur desktop d'AppShell (visible si
  is_admin via fetch /api/me).
  Back-office : recruteurs, reports, users, films. [declenche] GET/PATCH /api/admin
  Onglets : approbation/revocation recruteur (approve_recruiter, revoke_recruiter_approval),
  moderation reports, suspension + Pro offert (grant_pro/revoke_pro_grant, badge d'origine
  Stripe/offert/recruteur), approbation films. Voir docs/database.md "Modele Pro".
```

### Gestion des films *(lots 2 et 3, 08/10/2026 ; dépend de la migration `20261008`, pas encore en production)*

Modèle et règles : [database.md](database.md), [ADR 0014](adr/0014-responsable-et-co-gestionnaires.md). Routes : [api-routes.md](api-routes.md).

| Fichier | Type | Rôle |
|---|---|---|
| `src/app/(app)/moi/FilmsSection.tsx` | FEATURE | onglet « Mes films », ouvert à tous les types de compte : jauge (films dont on est Responsable), invitations à co-gérer reçues, liste, ajout |
| `src/app/(app)/moi/FilmCard.tsx` | SUB | un film : modifier (titre, description, catégorie, année), visibilité, créditer, gestion, supprimer |
| `src/app/(app)/moi/FilmManagers.tsx` | SUB | Responsable, co-gestionnaires, demandes, invitations, transfert |
| `src/app/(app)/moi/PublishForm.tsx` | SUB | publication avec rôle déclaré et déclaration de droits |
| `src/app/(app)/moi/DuplicateFilm.tsx` | SUB | vidéo déjà sur Unkast : être crédité, co-gérer, revendiquer |
| `src/app/(app)/moi/RightsDeclaration.tsx` | SUB | bloc rôle + cases, partagé entre publication et modification |
| `src/app/(app)/moi/CareerSection.tsx` | FEATURE | Parcours du profil (onglet Profil) |
| `src/app/(app)/moi/api.ts` | UTILITY | `callApi` et types des réponses de /moi |
| `src/app/(app)/projet/[slug]/ClaimModal.tsx` | SUB | bouton « Signaler » unique de la page film : « Un problème avec ce film » ouvre `ReportModal` (table `reports`), « Je détiens les droits de ce film » envoie une revendication avec justificatif (table `project_claims`) |
| `src/lib/film-team.ts` | UTILITY | réalisateur et équipe d'un film pour les pages de lecture ; visiteur via `public_project_credits`, un appel par page |
| `src/lib/credits.ts` | UTILITY | `isDirectorRole`, `directorNames` |
| `src/lib/contact-detector.ts`, `src/lib/contact-flag.ts` | UTILITY | détecteur de coordonnées et signalement automatique |
| `src/lib/title-change.ts` | UTILITY | `titleChangedALot` : titre nettement différent du titre validé (liste « modifiés récemment » de l'admin) |
| `src/app/(app)/rejoindre/finaliser` | FEATURE | fin de l'inscription par Google (type de compte, nom, nom de scène, métiers, ville) ; enregistre par `PATCH /api/dashboard/profile`, ne crée jamais de compte |
| `src/lib/legal.ts` | UTILITY | `TERMS_VERSION`, informations de la société à remplir (`LEGAL`), liens des pages légales |
| `src/components/LegalPage.tsx` | UTILITY | mise en page des trois pages légales ; `Info` surligne toute information de société non remplie |
| `src/app/(app)/cgu`, `confidentialite`, `mentions-legales` | FEATURE | pages légales de la bêta, publiques |
| `src/components/LegalLinks.tsx` | UTILITY | liens vers les pages légales (accueil, connexion, inscription, /moi) |
| `src/lib/oembed.ts` | UTILITY | titre, chaîne et vignette d'une vidéo (YouTube : meilleure définition disponible), refus d'une vidéo privée |
| `src/app/(app)/moi/PosterUpload.tsx` | SUB | image du film : consignes de format avant le choix du fichier, recadrage 16:9 avec aperçu en direct (petite carte, à la une, page du film), avertissement sous 1280 × 720 px (envoi permis) et pour une image verticale, compression dans le navigateur (sortie 1920 × 1080 au plus), retour à l'image de la vidéo |
| `src/components/FilmMeta.tsx` | UTILITY | ligne d infos d un film sous son titre : point de couleur + categorie, puis auteur et annee. Regle (09/10/2026) : aucun texte ni badge sur la vignette d un film (feed, recherche, fiche, films lies, carte verrouillee, ou seul le cadenas reste) ; la mention cookies de `VideoFacade` est sous la vignette |
| `src/components/FilmPoster.tsx` | UTILITY | affiche d'un film (lot 7), toujours entiere et a son format reel (lu au chargement de l'image, 16:9 en attendant), sans bande ni fond. Deux usages : hauteur fixee par l'appelant (classe `h-*`, la largeur suit le format : rangees, films lies, /moi) ou `framed` (cadre fixe 16:9, l'affiche y tient a son format : a la une, lecteur, grilles, `VideoFacade`). Vignettes YouTube 4:3 a bandes noires (hqdefault, sddefault) recadrees en 16:9. Porte le nom de transition (`shareKey`, `player`). A utiliser pour toute vignette de film |
| `src/components/FilmLink.tsx` | UTILITY | `FilmLink` (lien vers un film : marque la vignette cliquee, precharge au survol), `FilmPlayerFrame` (lecteur en cours de lecture et squelette), `RestoreFilmScroll` |
| `src/lib/film-transition.ts` | UTILITY | etat de la transition partagee vignette → lecteur (View Transitions de React) : seule la vignette cliquee porte le nom `film-poster` ; `backWithTransition` anime le bouton « Retour » (React n'anime pas un retour d'historique) ; position de defilement du `<main>` gardee au clic |
| `src/components/LockedFilmCard.tsx` | UTILITY | carte verrouillée d'un film « membres seulement » pour un visiteur (image floutée, cadenas, titre, bouton d'inscription) ; utilisée par la page film et la fiche profil |

Points de vigilance :
- Le nom affiché sur un film est celui du **crédit de réalisation**, jamais du Responsable. `/api/search` renvoie `director_name` (plus `owner_name`).
- Un visiteur ne lit plus `project_credits` : passer par `src/lib/film-team.ts`.
- Les embeds PostgREST entre `profiles` et `projects` doivent être **qualifiés** (`projects!projects_profile_id_fkey`, `profiles!projects_profile_id_fkey`) : `project_managers` crée une seconde relation entre les deux tables. À confirmer une fois la base migrée.
- Toute lecture de films avec le service role doit filtrer elle-même statut et visibilité.
- **Inscription par Google** : `auth/callback` crée un profil minimal puis envoie vers `/rejoindre/finaliser`. Un compte est **finalisé** quand il a au moins un métier (`profile_roles`). Le proxy (`src/lib/supabase/middleware.ts`) renvoie vers la finalisation tout compte connecté sans métier, sur toute page sauf la finalisation, les pages légales, `/admin`, `/auth`, `/api`, `/`, `/suspended` et `/compte-introuvable`. Les recruteurs en sont dispensés (autre parcours). `/rejoindre` (inscription classique) n'est jamais montrée à une personne connectée. La case des CGU cochée avant le clic Google voyage dans l'adresse de retour (`terms=<version>`) et est enregistrée à la création du profil.
- **Vidéos et cookies** : un lecteur YouTube ou Vimeo ne se monte **jamais** avant un clic (`VideoFacade`, ou modale de la page film). YouTube est servi depuis `youtube-nocookie.com` (`playerSrc` dans `VideoEmbed`). C'est ce qui dispense l'app d'un bandeau de cookies : tout nouvel usage de `VideoEmbed` doit rester derrière un clic, et tout outil de mesure d'audience ajouté rendrait le bandeau obligatoire.
- **Nom d'une personne** : toujours le nom d'affichage, calculé côté serveur (`DISPLAY_NAME_COLUMNS`, `displayNameOf`, `withDisplayName` dans `src/lib/profile.ts`, `guard.profile.display_name` dans `src/lib/auth-guard.ts`). Depuis le lot « vrais noms fermés » (09/10/2026), `DISPLAY_NAME_COLUMNS` vaut `display_name`, colonne calculée par la base (migration `20261014`) : c'est la seule colonne de nom qu'une requête du client utilisateur a le droit de nommer. `full_name`, `first_name`, `last_name`, `stage_name` et `display_name_preference` ne se lisent que par le client de confiance : administration, facturation, et le compte de la personne elle-même (`GET /api/dashboard/profile`, page de finalisation). `getDisplayName` ne sert plus qu'à son propre profil. La recherche filtre et trie sur `display_name`. **Adresse du profil** : elle ne change que lorsque la personne passe de son vrai nom à un nom de scène (`PATCH /api/dashboard/profile`, `newProfileSlug` dans `src/lib/utils.ts`, suffixe aléatoire) ; l'ancienne adresse répond 404, sans redirection. Rattrapage des adresses existantes : action admin `fix_profile_slugs` (liste, puis confirmation).

## Composants transverses (UTILITY / partages)

```
UTILITY  VideoEmbed (src/components/VideoEmbed.tsx)  — wrapper SSR-safe react-player
         (dynamic ssr:false ; conteneur 16/9 transparent, plus de fond opaque avant le chargement
         du lecteur, chantier 6)
         + VideoFacade.tsx (facade clic-pour-charger) : bouton lecture .glass-strong, fond
         translucide, prop className (plus de styles en ligne a surcharger)
UTILITY  ContactModal (src/components/ContactModal.tsx)   [declenche] POST /api/contact
UTILITY  ReportModal (src/components/ReportModal.tsx)     [declenche] POST /api/reports
UTILITY  AvatarUpload (src/components/AvatarUpload.tsx)   [declenche] /api/avatar
         Chantier 6 : feuille, recadreur et toast en verre, rendus par createPortal(document.body)
         (un parent en verre devient le bloc conteneur d'un position: fixed).
UTILITY  RoleSelector (src/components/RoleSelector.tsx) + icons/RoleIcons.tsx
         Refait au chantier 6 (08/10/2026), API de props inchangee (selectedRoles, onChange,
         maxSelection, placeholder, singleSelect). Selection en Chip retirables au-dessus du
         declencheur, la premiere = « Titre principal ». Feuille en verre (basse en mobile, modale
         centree des sm) rendue par createPortal(document.body) : Populaires, puis metiers groupes
         par famille (ROLE_CATEGORIES), recherche en Field, metier libre, Echap, fermeture au clic
         exterieur protegee contre le drag-select.
         singleSelect (chantier 7) : un clic sur un autre metier REMPLACE le precedent (les autres
         metiers ne sont plus desactives).
UTILITY  skeletons/ (Feed, Profile, Project, Search) — en verre, cales sur la mise en page des
         pages (memes conteneurs, memes rayons) ; a tenir a jour si une de ces pages change
UTILITY  ui/ (src/components/ui/) — briques du style verre liquide (refonte visuelle, 07/10/2026) :
         Button, Chip, Badge, GlassCard, Field, ProgressSteps, Select, Toggle, Toast.
         [depend de] tokens et utilitaires de globals.css (.glass, .glass-strong, .btn-accent,
         .press-spring, rounded-card/panel/pill, duration-fast/slow, ease-glass)
         Button [utilise] framer-motion (appui ressort, useReducedMotion)
         Consommees depuis le chantier 4 (07/10/2026) par Feed (ConversionBanner, page), Profil
         public (ProfileClient), Page projet (ProjetClient), Recherche (RechercheClient), et par
         la vitrine /dev/ui ; depuis le chantier 6 (08/10/2026) aussi par Inscription, Connexion,
         /auth/confirm, /moi, Messagerie, Pro, Categories, RoleSelector, AvatarUpload.
         API (chantier 5, 07/10/2026) :
         Button — variant accent | light | glass | dashed | icon (aria-label obligatoire),
           size sm (36) | compact (40) | md (44) | lg (48), fullWidth, href (rendu en next/link,
           memes styles et meme appui).
         Chip — variant filter (bouton, selected) | static (span, affichage seul) | removable
           (element d'une selection, croix a droite, le clic le retire ; aria-label a fournir).
         Badge — variant verified | pro | available | neutral (children) | pending | published
           (« Publié ») | rejected (« Refusé ») ; libelle surchargeable en children.
         Select — <select> natif aux cotes de Field md, label optionnel (sinon aria-label),
           className sur l'enveloppe.
         Toggle — interrupteur (checkbox role="switch") : checked, onChange(bool), label.
         Toast — message ; affiche tant que la chaine n'est pas vide (l'appelant la vide),
           portail sur le body, sous l'en-tete d'AppShell, z-index 10000.
         Field — label optionnel (sinon aria-label), icon (a gauche), onClear (bouton
           d'effacement tant qu'il y a une valeur), multiline (textarea), size md | lg (lg =
           grand champ en verre). className va sur l'enveloppe, pas sur le champ.
         GlassCard — strong, radius card | panel.
UTILITY  Vitrine UI — /dev/ui (src/app/dev/ui/page.tsx + UiShowcase.tsx) — HORS groupe (app),
         notFound() si NODE_ENV=production (donc 404 aussi sur les previews Vercel), non liee.
```

## Notes importantes (corrigees — etat reel du code)

1. **Des hooks custom existent** — `src/hooks/` contient `useUserStatus` et `usePushNotifications`. *(ancienne note « pas de hooks custom » : fausse)*
2. **Pas de state management global** — toujours `useState` local + 2 hooks. *(confirme)*
3. **`slugify()` est factorisee** dans `src/lib/utils.ts`, importee par 3 routes. *(ancienne note « dupliquee » : fausse)*
4. **Resend non connecte** — dependance installee, aucun email envoye. *(confirme)*
5. **L'admin API existe** — `/api/admin` (GET/PATCH) + back-office `/admin`, autorisation `profiles.is_admin`. *(ancienne note « pas d'admin API » : fausse)*
6. **Edition d'un film** — depuis le 08/10/2026 (branche `main`, migration `20261008` requise), un film se modifie par PATCH `/api/dashboard/projects` (titre, description, categorie, annee, visibilite) ; video et images ne se modifient pas.
7. **`Navbar.tsx` n'existe plus** — le fichier a ete supprime (remplace par AppShell). *(ancienne entree ORPHELIN : obsolete)*
8. **`database.ts` est desormais la source de verite** (15 tables, profiles 35 col., projects 12 col., introspecte). En revanche **`supabase/schema.sql` reste en retard** (5 tables seulement) et doit etre regenere — voir docs/database.md.
9. **`account_type` (ROLE) et `plan` contraints par CHECK** — `account_type` ∈ {talent, creator, recruiter} (defaut talent, `member` supprime), `plan` ∈ {free, pro}. **Role et plan totalement independants depuis le 10/08/2026** : la regle `recruiter ⇒ pro` n'existe plus (`approve_recruiter` ne donne plus le Pro). Restent NON contraints : `projects.status`, `recruiter_status`, `display_name_preference`, `show_*_to`, statuts invitations/credits/reports/waitlist (dette technique).
