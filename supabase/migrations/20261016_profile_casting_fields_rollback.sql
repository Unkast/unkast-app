-- =============================================================================
-- ROLLBACK de 20261016_profile_casting_fields.sql
-- =============================================================================
-- Supprime les colonnes playing_ages, role_type et languages de profiles, avec
-- leurs contraintes, leurs droits et leurs index (tous emportes par le DROP).
--
-- ATTENTION : les valeurs saisies par les membres sont PERDUES.
-- A executer APRES avoir retire le code du lot 8 : sinon les filtres age de jeu,
-- type de roles et langue de la recherche renvoient une erreur.
-- =============================================================================

begin;

drop index if exists public.idx_profiles_languages;
drop index if exists public.idx_profiles_playing_ages;

alter table public.profiles
  drop column if exists playing_ages,
  drop column if exists role_type,
  drop column if exists languages;

commit;
