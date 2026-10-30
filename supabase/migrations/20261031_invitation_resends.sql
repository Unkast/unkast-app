-- =============================================================================
-- 20261031_invitation_resends.sql — renvoi d'une invitation par email (3 au plus)
-- =============================================================================
-- A EXECUTER A LA MAIN dans le SQL Editor, en une fois.
-- Retour arriere : 20261031_invitation_resends_rollback.sql
--
-- ORDRE : executer AVANT de deployer le code du point 4 (liste de l'equipe dans
-- l'onglet Créditer). Sans cette colonne, le renvoi d'une invitation repond
-- « erreur serveur » ; le reste de la liste fonctionne.
-- Compatible avec le code en ligne : il ne lit ni n'ecrit cette colonne.
--
-- CE QUE FAIT CETTE MIGRATION
--   invitations.resend_count : nombre de renvois d'une invitation par email. La
--   route POST /api/invitations/[id]/resend (service role) l'incremente en meme
--   temps qu'elle pose un nouveau lien (token) et une nouvelle echeance
--   (expires_at). 3 renvois au plus par invitation (decision du 30/10/2026) :
--   controle dans la route, et filet en base (contrainte CHECK).
--   Aucune ecriture cliente : invitations est fermee aux clients depuis
--   20261020_close_direct_writes.sql.
-- =============================================================================

begin;

alter table public.invitations
  add column if not exists resend_count integer not null default 0;

alter table public.invitations drop constraint if exists invitations_resend_count_check;
alter table public.invitations
  add constraint invitations_resend_count_check check (resend_count between 0 and 3);

commit;


-- =============================================================================
-- CONTROLE (lecture seule), a lancer apres l'execution
-- =============================================================================
-- Attendu : une ligne, integer, not null, defaut 0 ; puis la contrainte CHECK.
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'invitations' and column_name = 'resend_count';
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.invitations'::regclass and conname = 'invitations_resend_count_check';
