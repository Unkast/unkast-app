# Unkast — Routes API

## Resume

| Route | Methodes | Auth | Tables lues | Tables ecrites | Services externes |
|---|---|---|---|---|---|
| `/api/contact` | POST | Non | — | `contact_requests` | Aucun |
| `/api/search` | GET | Non | `profiles`, `profile_roles`, `projects` | — | Aucun |
| `/api/signup` | POST | Non | — | `profiles`, `profile_roles`, `projects`, `project_credits` | Aucun |
| `/api/dashboard/profile` | GET, PATCH | Oui | `profiles`, `profile_roles` | `profiles`, `profile_roles` | Aucun |
| `/api/dashboard/projects` | GET, POST, DELETE | Oui | `projects`, `project_credits` | `projects`, `project_credits` | Aucun |
| `/api/dashboard/contacts` | GET, PATCH | Oui | `contact_requests` | `contact_requests` | Aucun |

## Detail par route

### POST /api/contact

**Fichier** : `src/app/api/contact/route.ts`

Accepte une demande de contact (nom, email, profil destinataire, sujet, message). Insere dans `contact_requests`. Tous les champs requis, retourne 400 si manquant. Aucune authentification requise.

### GET /api/search

**Fichier** : `src/app/api/search/route.ts`

Recherche unifiee talents + projets. Parametres :
- `q` — texte de recherche
- `type` — `all` | `talents` | `projets`
- `category` — filtre par categorie de projet
- `location` — filtre par localisation
- `role` — filtre par metier
- `sort` — `pertinence` | `date` | `projets`

Filtre les profils par `status = "approved"`. Enrichit chaque talent avec roles et nombre de projets, chaque projet avec nom du createur. Limite 50 resultats par type.

**Attention** : pattern N+1 — chaque talent declenche 2 requetes supplementaires (roles + project_count), chaque projet 1 requete (owner name). Jusqu'a ~150 requetes par appel.

Retourne : `{ talents[], projects[], counts: { talents, projects, total } }`

### POST /api/signup

**Fichier** : `src/app/api/signup/route.ts`

Inscription complete en une requete :
1. Cree un utilisateur Supabase Auth
2. Insere un profil avec `status: "pending"`
3. Insere les roles
4. (Optionnel) Cree un premier projet avec credits

Champs requis : `email`, `password`, `full_name`. Le reste est optionnel.
Genere des slugs via `slugify()` locale (non partagee).

### GET /api/dashboard/profile

**Fichier** : `src/app/api/dashboard/profile/route.ts`

Retourne le profil de l'utilisateur authentifie + ses roles. 401 si non connecte.

### PATCH /api/dashboard/profile

**Fichier** : `src/app/api/dashboard/profile/route.ts`

Met a jour le profil (partial update). Champs possibles : `full_name`, `bio`, `location`, `is_available`, `avatar_url`. Si `roles[]` fourni, remplace tous les roles existants (delete all + re-insert). 401 si non connecte.

**Note** : le remplacement des roles n'est pas atomique (2 operations separees).

### GET /api/dashboard/projects

**Fichier** : `src/app/api/dashboard/projects/route.ts`

Retourne tous les projets de l'utilisateur avec leurs credits. Tri par date decroissante. 401 si non connecte.

### POST /api/dashboard/projects

**Fichier** : `src/app/api/dashboard/projects/route.ts`

Cree un nouveau projet. Verifie la limite gratuite (`MAX_PROJECTS_FREE = 3`). Champs requis : `title`, `category`, `video_url`. Genere un slug, insere le projet, puis insere le credit owner + credits ghost optionnels. 401 si non connecte.

### DELETE /api/dashboard/projects

**Fichier** : `src/app/api/dashboard/projects/route.ts`

Supprime un projet par `?id=`. Filtre par `profile_id = user.id` pour empecher la suppression des projets d'autrui. 401 si non connecte.

### GET /api/dashboard/contacts

**Fichier** : `src/app/api/dashboard/contacts/route.ts`

Retourne toutes les demandes de contact recues par l'utilisateur. Tri par date decroissante. 401 si non connecte.

### PATCH /api/dashboard/contacts

**Fichier** : `src/app/api/dashboard/contacts/route.ts`

Met a jour le statut d'une demande de contact (`accepted` ou `declined`). Filtre par `to_profile_id = user.id`. 401 si non connecte.

**Note** : aucune notification email n'est envoyee lors de l'acceptation ou du refus.

## Observations

1. **Aucun service externe connecte** — Resend est installe mais pas utilise. Aucun email transactionnel n'est envoye.
2. **Pas de route d'edit projet** — un projet ne peut pas etre modifie apres creation, seulement supprime.
3. **Pas de route admin** — l'approbation des profils (pending → approved) n'est pas exposee via API.
4. **`slugify()` dupliquee** dans `/api/signup` et `/api/dashboard/projects` — devrait etre factorisee dans `src/lib/`.
