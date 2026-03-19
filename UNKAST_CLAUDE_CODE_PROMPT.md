# KYNK — Prompt pour Claude Code

## Contexte projet

Unkast est une plateforme web où les professionnels du cinéma et de l'audiovisuel français créent un profil, publient jusqu'à 3 projets vidéo (via embeds Vimeo/YouTube), créditent leurs collaborateurs sur chaque projet, et se font découvrir par des recruteurs/producteurs à travers leur travail.

Tagline : "Découvre l'oeuvre. Trouve le talent."

Concept clé : les talents sont découverts à travers leurs réalisations, pas à travers un CV. Chaque projet crédite chaque collaborateur. Un visiteur regarde un film, aime le travail, clique sur un membre de l'équipe, découvre son profil et ses autres projets.

## Stack technique

- **Framework** : Next.js 14+ (App Router) avec TypeScript
- **Backend / BDD / Auth** : Supabase (PostgreSQL + Auth + Row Level Security)
- **Hébergement** : Vercel
- **Styling** : Tailwind CSS
- **Vidéo** : Embeds Vimeo/YouTube uniquement (pas d'hébergement vidéo natif)
- **Email transactionnel** : Resend (pour notifications de demande de contact)

## Design system

- **Theme** : Dark mode premium exclusivement
- **Background principal** : #0d0d0d
- **Background cards** : #141414
- **Borders** : #1f1f1f (subtil), #2a2a2a (hover), #333 (actif)
- **Texte principal** : #e0e0e0
- **Texte secondaire** : #888888
- **Texte tertiaire** : #555555
- **Accent primaire (CTA, highlights)** : #C8FF00 (lime)
- **Accent secondaire** : #00D4AA (teal, pour badges "disponible")
- **Accent catégories** : Court-métrage=#C8FF00, Publicité=#00D4AA, Clip=#AA88FF, Documentaire=#FF8844, Bande démo=#FF5577
- **Font** : DM Sans (body) + JetBrains Mono (accents monospace)
- **Border radius** : 8px (boutons), 10-12px (cards), 14-16px (grands containers), 20px (pills)
- **Nav** : sticky, fond semi-transparent avec backdrop-filter blur(20px), border-bottom #1a1a1a
- **Logo** : "Unkast" en bold 800 + point lime "."
- **Bouton primaire** : fond #C8FF00, texte #0d0d0d, font-weight 700, border-radius 8-10px
- **Bouton secondaire** : fond transparent, border #333, texte #888

## Base de données Supabase — Tables

### profiles
- id (uuid, PK, lié à auth.users)
- full_name (text)
- slug (text, unique — pour URL /profil/lucas-meriaux)
- bio (text, nullable)
- avatar_url (text, nullable)
- location (text, nullable)
- is_available (boolean, default false)
- status (enum: 'pending', 'approved', 'rejected' — validation manuelle)
- created_at (timestamptz)
- updated_at (timestamptz)

### profile_roles
- id (uuid, PK)
- profile_id (uuid, FK → profiles)
- role_name (text — ex: "Réalisateur", "Chef opérateur", "Cascadeur")

### projects
- id (uuid, PK)
- profile_id (uuid, FK → profiles — le créateur du projet)
- title (text)
- slug (text, unique)
- description (text, nullable)
- category (enum: 'court-metrage', 'publicite', 'clip', 'documentaire', 'bande-demo', 'scene-extrait')
- year (integer)
- video_url (text — URL Vimeo ou YouTube)
- created_at (timestamptz)

### project_credits
- id (uuid, PK)
- project_id (uuid, FK → projects)
- profile_id (uuid, FK → profiles, nullable — null si profil fantôme)
- ghost_name (text, nullable — nom affiché si la personne n'a pas de compte)
- role_on_project (text — ex: "Monteur", "Comédienne")

### contact_requests
- id (uuid, PK)
- from_name (text)
- from_email (text)
- to_profile_id (uuid, FK → profiles)
- subject (enum: 'collaboration', 'project', 'question', 'other')
- message (text)
- status (enum: 'pending', 'accepted', 'declined')
- created_at (timestamptz)

## Pages à construire (6 écrans)

### 1. Page d'accueil — /
- Hero avec tagline "Découvre l'oeuvre. Trouve le talent." + badge "Beta — France"
- Barre de recherche centrale
- Filtres rapides par métier (pills cliquables)
- Section catégories avec compteurs
- Grille de projets récents (cards avec thumbnail embed, catégorie pill, créateur, taille équipe)
- Section "Talents à découvrir" (cards profil avec avatar, rôles, localisation, nombre de projets)
- CTA double : "Créer mon profil" / "Je cherche des talents"
- Stats en bas (profils actifs, projets publiés, métiers représentés)

### 2. Page profil public — /profil/[slug]
- Avatar + nom + badge "Disponible" si is_available
- Rôles en pills lime
- Localisation + bio
- Bouton "Demander le contact" (ouvre modale) + "Partager le profil"
- Section projets avec filtres (Tous / par catégorie)
- Chaque projet : thumbnail embed vidéo, catégorie pill, rôle sur le projet, description
- Crédits croisés dépliables sur chaque projet — chaque collaborateur est cliquable (lien vers son profil ou profil fantôme)
- Modale de contact : nom, objet (select), message, bouton envoyer. Texte explicatif "la personne devra accepter avant échange"

### 3. Page projet — /projet/[slug]
- Player vidéo (embed Vimeo/YouTube) avec aspect ratio cinématique
- Titre + catégorie + année + genre + format + durée
- Description longue
- Sélections & Prix si applicable
- Onglet "Équipe" : liste de tous les crédits croisés, chacun cliquable vers son profil. Le créateur a un badge "Créateur". Chaque personne affiche ses rôles, localisation, nombre de projets sur Unkast
- Onglet "Projets liés" : projets qui partagent des collaborateurs, avec indication "X collaborateurs en commun"
- Sidebar droite (desktop) : fiche technique + carte créateur avec CTA "Voir le profil complet"

### 4. Page recherche — /recherche
- Barre de recherche avec filtrage en temps réel
- Onglets : Tout / Talents / Projets avec compteurs
- Panneau de filtres dépliable : Métier, Catégorie de projet, Localisation
- Résultats mixtes talents + projets
- Toggle affichage liste/grille
- Tri par pertinence, date, nombre de projets
- État vide si aucun résultat

### 5. Flow d'inscription — /rejoindre
- Step 1 : Infos de base (nom, email, mot de passe)
- Step 2 : Profil pro (métier(s), localisation, bio, avatar)
- Step 3 : Premier projet (titre, catégorie, URL vidéo, description, crédits)
- Step 4 : Confirmation "Ton profil est en attente de validation"
- Progress bar en haut montrant les 4 étapes
- Le profil créé a status='pending' jusqu'à validation manuelle

### 6. Dashboard privé — /dashboard
- Vue "Mon profil" avec preview de la page publique
- Section "Mes projets" avec bouton ajouter (max 3 pour gratuit)
- Section "Demandes de contact" reçues (pending/accepted/declined)
- Bouton éditer profil / éditer projet
- Badge de statut du profil (en attente / approuvé)

## Règles importantes

1. Inscription sur candidature : les profils sont créés avec status='pending'. Ils ne sont visibles publiquement qu'une fois status='approved'. L'admin (toi) approuve manuellement via Supabase dashboard au début.
2. Maximum 3 projets par profil en version gratuite.
3. Les crédits croisés peuvent référencer des profils existants OU des "profils fantômes" (ghost_name) si la personne n'a pas encore de compte.
4. La demande de contact nécessite l'acceptation de la personne contactée avant tout échange. Pas de messagerie interne — juste un système de demande avec notification email via Resend.
5. Les vidéos ne sont PAS hébergées. On embed des URLs Vimeo/YouTube. Utiliser react-player ou un composant d'embed pour gérer les deux.
6. SEO : chaque page profil et projet doit avoir des métadonnées Open Graph propres (titre, description, image). Utiliser le SSR de Next.js App Router.
7. Row Level Security Supabase : les profils 'approved' sont lisibles par tous. Les profils 'pending' ne sont visibles que par leur propriétaire. Les projets suivent la visibilité du profil associé.
8. Responsive : toutes les pages doivent fonctionner sur mobile ET desktop.

## Comment procéder

Commence par :
1. Initialiser le projet Next.js + Tailwind + TypeScript
2. Configurer Supabase (créer les tables, activer RLS)
3. Construire les pages une par une en commençant par le profil public (c'est le coeur du produit)
4. Ajouter l'auth et le flow d'inscription
5. Ajouter le dashboard
6. Ajouter la recherche et la page d'accueil

Demande-moi confirmation avant de passer d'une étape à la suivante.
