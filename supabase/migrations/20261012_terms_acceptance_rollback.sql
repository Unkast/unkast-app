-- =============================================================================
-- ROLLBACK de 20261012_terms_acceptance.sql
-- =============================================================================
--
-- Supprime les colonnes terms_version et terms_accepted_at de profiles.
--
-- CE QUI EST PERDU : la trace des acceptations (version et date) de tous les
-- membres. A exporter avant si elle doit etre conservee :
--   select id, terms_version, terms_accepted_at from public.profiles
--   where terms_accepted_at is not null;
--
-- A lancer APRES avoir remis en ligne le code d'avant ce lot (le code de ce
-- lot ecrit ces colonnes a l'inscription).
-- =============================================================================

begin;

alter table public.profiles
  drop constraint if exists profiles_terms_acceptance_check;

alter table public.profiles
  drop column if exists terms_version,
  drop column if exists terms_accepted_at;

commit;
