-- =============================================================================
-- 20261031_invitation_resends_rollback.sql — retour arriere de 20261031_invitation_resends.sql
-- =============================================================================
-- A EXECUTER A LA MAIN dans le SQL Editor, en une fois.
-- ORDRE : redeployer d'abord le code sans le renvoi d'invitation, executer ensuite.
-- Perdu : le nombre de renvois deja faits. Les liens et echeances renouveles
-- restent valables.
-- =============================================================================

begin;

alter table public.invitations drop constraint if exists invitations_resend_count_check;
alter table public.invitations drop column if exists resend_count;

commit;

-- Controle (lecture seule). Attendu : aucune ligne.
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'invitations' and column_name = 'resend_count';
