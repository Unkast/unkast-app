-- =============================================================================
-- ROLLBACK de 20261014_profile_display_name.sql
-- =============================================================================
--
-- Supprime l'index et la colonne display_name (son droit de lecture part avec
-- elle). Aucune autre donnee n'est touchee : les colonnes de nom d'origine n'ont
-- pas ete modifiees.
--
-- A lancer APRES avoir remis en ligne le code d'avant ce lot (le nouveau code
-- lit display_name), et seulement si l'etape B n'a pas ete executee, ou apres
-- son propre rollback.
--
-- CE QUI N'EST PAS DEFAIT
--   - Les adresses de profil changees depuis l'admin ou par un passage au nom de
--     scene : les anciennes adresses ne sont pas conservees.
-- =============================================================================

begin;

drop index if exists public.idx_profiles_display_name_trgm;
alter table public.profiles drop column if exists display_name;

commit;
