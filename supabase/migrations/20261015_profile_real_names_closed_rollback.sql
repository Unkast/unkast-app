-- =============================================================================
-- ROLLBACK de 20261015_profile_real_names_closed.sql
-- =============================================================================
--
-- Redonne a anon et authenticated la lecture des cinq colonnes de nom de
-- profiles (etat d'avant l'etape B). Aucune donnee n'est touchee.
-- A lancer immediatement si une page repond « permission denied » apres
-- l'etape B. L'etape A (colonne display_name) n'est pas concernee.
-- =============================================================================

begin;

grant select (full_name, first_name, last_name, stage_name, display_name_preference)
  on table public.profiles
  to anon, authenticated;

commit;
