-- =============================================================================
-- 20261030_credit_by_email.sql — credit par email, reinvitation, retrait des credits
-- =============================================================================
-- A EXECUTER A LA MAIN dans le SQL Editor, en une fois.
-- Retour arriere : 20261030_credit_by_email_rollback.sql
--
-- ORDRE : executer AVANT de deployer le code du lot « credit par email ». Sans cette
-- migration, le nouveau code ne trouve pas la fonction user_id_by_email et refuse
-- les invitations par email (erreur serveur), et une reinvitation apres refus
-- echoue sur l'ancienne contrainte d'unicite.
-- Compatible avec le code actuellement en ligne : il n'appelle aucun de ces objets,
-- et la suppression de la policy C ne touche aucune route (elles ecrivent toutes
-- en service role).
--
-- CE QUE FAIT CETTE MIGRATION
--   A. Fonction user_id_by_email : retrouver le compte qui porte un email.
--      `profiles` n'a pas de colonne email (contact_email est un autre champ, saisi
--      par le membre). Seule la route serveur api/invitations l'appelle, en service
--      role : ni la cle publique ni un membre connecte ne peuvent l'executer, sinon
--      n'importe qui pourrait tester si un email a un compte.
--   B. Invitations a un membre (project_invitations) :
--      - l'unicite ne porte plus que sur les invitations EN ATTENTE. Une personne qui
--        a refuse peut etre reinvitee ; le delai de 30 jours apres un refus est
--        controle par la route (decision C du 30/10/2026) ;
--      - colonne responded_at : date de la reponse (acceptee ou refusee), ecrite par
--        la route PATCH api/invitations/project/[id]. Sert au delai de 30 jours. Les
--        refus anterieurs a cette migration n'ont pas de date : la route se rabat
--        alors sur created_at.
--   C. Credits (project_credits) : plus de suppression directe par un gestionnaire
--      (decision D du 30/10/2026). Un co-gestionnaire ne retire pas les autres. Le
--      retrait passera par une route serveur : le Responsable retire n'importe qui,
--      chacun peut se retirer lui-meme (DELETE api/dashboard/credits, deja en place).
--      Aucune route n'utilisait cette policy : toutes les suppressions de credits
--      passent deja par le service role.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- A. Retrouver un compte par son email (service role seulement)
-- -----------------------------------------------------------------------------
create or replace function public.user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(btrim(p_email))
  limit 1;
$$;

revoke all on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;

comment on function public.user_id_by_email(text) is
  'Compte portant cet email (ou null). Service role seulement : appelee par api/invitations.';

-- -----------------------------------------------------------------------------
-- B. Invitations a un membre : une seule EN ATTENTE par personne et par film
-- -----------------------------------------------------------------------------
-- La contrainte d'origine (relevee en production le 30/10/2026, absente des
-- migrations du depot) interdisait toute nouvelle invitation, meme apres un refus.
alter table public.project_invitations
  drop constraint if exists project_invitations_project_id_invited_profile_id_key;

create unique index if not exists project_invitations_one_pending
  on public.project_invitations (project_id, invited_profile_id)
  where status = 'pending';

alter table public.project_invitations
  add column if not exists responded_at timestamptz;

-- -----------------------------------------------------------------------------
-- C. Credits : plus de suppression directe par un client
-- -----------------------------------------------------------------------------
drop policy if exists "Managers can delete credits" on public.project_credits;
revoke delete on public.project_credits from anon, authenticated;

commit;


-- =============================================================================
-- CONTROLES (lecture seule), a lancer apres l'execution
-- =============================================================================

-- 1. La fonction existe et n'est executable que par le service role.
--    Attendu : une ligne, anon = false, authenticated = false, service_role = true.
-- select
--   has_function_privilege('anon', 'public.user_id_by_email(text)', 'execute') as anon,
--   has_function_privilege('authenticated', 'public.user_id_by_email(text)', 'execute') as authenticated,
--   has_function_privilege('service_role', 'public.user_id_by_email(text)', 'execute') as service_role;

-- 2. Unicite des invitations. Attendu : project_invitations_one_pending present,
--    plus aucune contrainte project_invitations_project_id_invited_profile_id_key.
-- select indexname, indexdef from pg_indexes
--  where schemaname = 'public' and tablename = 'project_invitations';
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.project_invitations'::regclass;

-- 3. Colonne responded_at. Attendu : une ligne, timestamp with time zone.
-- select column_name, data_type from information_schema.columns
--  where table_schema = 'public' and table_name = 'project_invitations'
--    and column_name = 'responded_at';

-- 4. Credits : plus aucune policy d'ecriture. Attendu : aucune ligne.
-- select policyname, cmd from pg_policies
--  where schemaname = 'public' and tablename = 'project_credits' and cmd <> 'SELECT';

-- 5. Credits : plus aucun droit d'ecriture pour les clients. Attendu : aucune ligne.
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_schema = 'public' and table_name = 'project_credits'
--    and grantee in ('anon', 'authenticated')
--    and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
