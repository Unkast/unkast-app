# Unkast — Base de donnees

## Enums

| Type | Valeurs |
|---|---|
| `profile_status` | `pending`, `approved`, `rejected` |
| `project_category` | `court-metrage`, `publicite`, `clip`, `documentaire`, `bande-demo`, `scene-extrait` |
| `contact_subject` | `collaboration`, `project`, `question`, `other` |
| `contact_status` | `pending`, `accepted`, `declined` |

## Tables

### profiles

Table principale. Un enregistrement par utilisateur. Liee 1:1 a `auth.users`.

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | UUID | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| `full_name` | TEXT | NOT NULL |
| `slug` | TEXT | UNIQUE NOT NULL |
| `bio` | TEXT | nullable |
| `avatar_url` | TEXT | nullable |
| `location` | TEXT | nullable |
| `is_available` | BOOLEAN | DEFAULT FALSE |
| `status` | `profile_status` | DEFAULT 'pending' |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Trigger** : `profiles_updated_at` — BEFORE UPDATE met a jour `updated_at` automatiquement.

### profile_roles

Roles multiples par profil (many-to-one vers profiles).

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() |
| `profile_id` | UUID | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE |
| `role_name` | TEXT | NOT NULL |

### projects

Projets audiovisuels lies a un profil.

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() |
| `profile_id` | UUID | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE |
| `title` | TEXT | NOT NULL |
| `slug` | TEXT | UNIQUE NOT NULL |
| `description` | TEXT | nullable |
| `category` | `project_category` | NOT NULL |
| `year` | INTEGER | NOT NULL |
| `video_url` | TEXT | NOT NULL |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

### project_credits

Credits croises entre profils et projets. Mecanisme de decouverte central d'Unkast.

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() |
| `project_id` | UUID | NOT NULL, FK → `projects(id)` ON DELETE CASCADE |
| `profile_id` | UUID | nullable, FK → `profiles(id)` ON DELETE SET NULL |
| `ghost_name` | TEXT | nullable |
| `role_on_project` | TEXT | NOT NULL |

**CHECK** : `credit_has_person` — au moins un de `profile_id` ou `ghost_name` doit etre NOT NULL.

### contact_requests

Demandes de contact entrantes vers un profil.

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() |
| `from_name` | TEXT | NOT NULL |
| `from_email` | TEXT | NOT NULL |
| `to_profile_id` | UUID | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE |
| `subject` | `contact_subject` | NOT NULL |
| `message` | TEXT | NOT NULL |
| `status` | `contact_status` | DEFAULT 'pending' |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

## Index

| Nom | Table | Colonne(s) |
|---|---|---|
| `idx_profiles_slug` | profiles | slug |
| `idx_profiles_status` | profiles | status |
| `idx_projects_slug` | projects | slug |
| `idx_projects_profile_id` | projects | profile_id |
| `idx_project_credits_project_id` | project_credits | project_id |
| `idx_project_credits_profile_id` | project_credits | profile_id |
| `idx_contact_requests_to_profile` | contact_requests | to_profile_id |
| `idx_profile_roles_profile_id` | profile_roles | profile_id |

## Row Level Security (RLS)

RLS active sur les 5 tables.

### profiles

| Policy | Operation | Condition |
|---|---|---|
| Approved profiles are public | SELECT | `status = 'approved'` |
| Users can view own profile | SELECT | `auth.uid() = id` |
| Users can insert own profile | INSERT | `auth.uid() = id` |
| Users can update own profile | UPDATE | `auth.uid() = id` |

Pas de DELETE policy — les utilisateurs ne peuvent pas supprimer leur profil via RLS.

### profile_roles

| Policy | Operation | Condition |
|---|---|---|
| Public profile roles | SELECT | Profil approved OU appartient a auth.uid() |
| Users can manage own roles | INSERT | Profil appartient a auth.uid() |
| Users can delete own roles | DELETE | Profil appartient a auth.uid() |

Pas de UPDATE policy — pour modifier un role, supprimer et re-creer.

### projects

| Policy | Operation | Condition |
|---|---|---|
| Public projects | SELECT | Profil owner approved OU owner = auth.uid() |
| Users can insert own projects | INSERT | `auth.uid() = profile_id` |
| Users can update own projects | UPDATE | `auth.uid() = profile_id` |
| Users can delete own projects | DELETE | `auth.uid() = profile_id` |

### project_credits

| Policy | Operation | Condition |
|---|---|---|
| Public project credits | SELECT | Profil owner du projet approved OU owner = auth.uid() |
| Project owners can manage credits | INSERT | L'utilisateur est owner du projet |
| Project owners can update credits | UPDATE | L'utilisateur est owner du projet |
| Project owners can delete credits | DELETE | L'utilisateur est owner du projet |

### contact_requests

| Policy | Operation | Condition |
|---|---|---|
| Anyone can send contact request | INSERT | `true` (ouvert a tous, meme anonymes) |
| Recipients can view their requests | SELECT | `auth.uid() = to_profile_id` |
| Recipients can update request status | UPDATE | `auth.uid() = to_profile_id` |

Pas de DELETE policy. Les expediteurs ne peuvent pas voir leurs propres demandes envoyees.

## Fonction et trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

Seule la table `profiles` a ce trigger. Les autres tables n'ont pas de colonne `updated_at`.

## Observations

1. Pas de policy admin — l'approbation des profils necessite un service role key ou le Supabase Dashboard
2. Les expediteurs de contact_requests n'ont pas de visibilite sur leurs demandes envoyees
3. `updated_at` n'existe que sur `profiles`
4. Les valeurs de `project_category` utilisent des tirets, ce qui est valide en PostgreSQL mais necessite du quoting dans certains contextes
