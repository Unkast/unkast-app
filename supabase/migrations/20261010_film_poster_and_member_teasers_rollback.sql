-- =============================================================================
-- ROLLBACK de 20261010_film_poster_and_member_teasers.sql
-- =============================================================================
--
-- Supprime la fonction member_only_film_teasers.
--
-- CE QUI N'EST PAS DEFAIT
--   - Le bucket `posters` et ses fichiers : les films dont l'image a ete envoyee
--     pointent dessus (projects.poster_url). Le supprimer casserait ces images.
--     A vider a la main depuis le tableau de bord si besoin, apres avoir remis
--     les films concernes sur l'image de la video :
--       select id, title from public.projects where poster_url like '%/posters/%';
--   - Les vignettes ecrites dans projects.poster_url (elles sont justes).
--
-- A lancer APRES avoir remis en ligne le code d'avant ce lot.
-- =============================================================================

begin;

drop function if exists public.member_only_film_teasers(text, uuid);

commit;
