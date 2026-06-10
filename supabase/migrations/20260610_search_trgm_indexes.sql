-- ============================================================================
-- Migration : index trigram pour accélérer la recherche (P5)
-- À EXÉCUTER MANUELLEMENT dans le SQL Editor Supabase. Ne pas exécuter en auto.
--
-- Contexte : /api/search fait des `ILIKE '%terme%'` (wildcard en tête) sur
-- profiles.full_name, profiles.bio, profiles.location, projects.title,
-- projects.description. Un ILIKE avec '%' en tête ne peut PAS utiliser un index
-- btree classique → scan séquentiel de toute la table. L'extension pg_trgm +
-- des index GIN trigram rendent ces recherches indexables.
--
-- Sûr à ré-exécuter (IF NOT EXISTS partout). Index créés SANS `concurrently`
-- car le SQL Editor Supabase exécute dans une transaction (où CONCURRENTLY est
-- interdit). Sur des tables petites/moyennes c'est instantané ; le verrou en
-- écriture est négligeable. Si les tables deviennent très volumineuses un jour,
-- recréer avec CONCURRENTLY via une connexion psql hors transaction.
-- ============================================================================

-- 1. Extension trigram
create extension if not exists pg_trgm;

-- 2. Index GIN trigram sur les colonnes recherchées
create index if not exists idx_profiles_full_name_trgm
  on public.profiles using gin (full_name gin_trgm_ops);

create index if not exists idx_profiles_bio_trgm
  on public.profiles using gin (bio gin_trgm_ops);

create index if not exists idx_profiles_location_trgm
  on public.profiles using gin (location gin_trgm_ops);

create index if not exists idx_projects_title_trgm
  on public.projects using gin (title gin_trgm_ops);

create index if not exists idx_projects_description_trgm
  on public.projects using gin (description gin_trgm_ops);

-- 3. Index sur les filtres status/category fréquents (recherche + pages publiques)
create index if not exists idx_profiles_status
  on public.profiles (status);

create index if not exists idx_projects_status_category
  on public.projects (status, category);
