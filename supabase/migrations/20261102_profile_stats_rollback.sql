-- =============================================================================
-- ROLLBACK de 20261102_profile_stats.sql
-- =============================================================================
-- ATTENTION, perte de donnees : toutes les statistiques de profil collectees
-- (evenements, compteurs par jour, sels) sont supprimees.
-- Sans ces objets, le code reste sans erreur visible : le comptage echoue en
-- silence et /moi affiche « Statistiques indisponibles » aux Pro.
-- =============================================================================

begin;

drop function if exists public.record_profile_event(uuid, text, text);
drop table if exists public.profile_stat_events;
drop table if exists public.profile_stats_daily;
drop table if exists public.profile_stat_salts;

commit;

-- Verification : aucune ligne
--   select tablename from pg_tables where schemaname = 'public' and tablename like 'profile_stat%';
--   select proname from pg_proc where proname = 'record_profile_event';
