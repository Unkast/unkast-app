-- =============================================================================
-- 20261030_credit_by_email_rollback.sql — retour arriere de 20261030_credit_by_email.sql
-- =============================================================================
-- A EXECUTER A LA MAIN dans le SQL Editor, en une fois.
--
-- ORDRE : redeployer d'abord la version precedente du code (sans le lot « credit par
-- email »), executer ensuite. Le code du lot appelle user_id_by_email : sans elle,
-- toute invitation par email repond « erreur serveur ».
--
-- CE QUI EST PERDU
--   - Les dates de reponse (responded_at) des invitations a un membre.
--   - Aucune invitation n'est supprimee. Si une personne a ete reinvitee sur un film
--     apres un refus, elle a deux lignes pour ce film et l'ancienne contrainte ne
--     peut pas etre reposee : le bloc ci-dessous echoue alors volontairement, et la
--     transaction entiere est annulee. Lancer la requete 0 pour voir ces doublons,
--     et decider a la main lesquels supprimer (en general les anciens refus).
-- =============================================================================

-- 0. Doublons qui bloqueraient le retour arriere (lecture seule).
--    Attendu : aucune ligne.
-- select project_id, invited_profile_id, count(*) as nb,
--        array_agg(status || ' ' || coalesce(created_at::text, '?') order by created_at) as invitations
-- from public.project_invitations
-- group by project_id, invited_profile_id
-- having count(*) > 1;

begin;

-- -----------------------------------------------------------------------------
-- C. Credits : suppression directe par un gestionnaire, comme avant
-- -----------------------------------------------------------------------------
grant delete on public.project_credits to authenticated;
drop policy if exists "Managers can delete credits" on public.project_credits;
create policy "Managers can delete credits"
  on public.project_credits for delete
  using (public.is_project_manager(project_id));

-- -----------------------------------------------------------------------------
-- B. Invitations a un membre : une seule par personne et par film, tous statuts
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.project_invitations
    group by project_id, invited_profile_id
    having count(*) > 1
  ) then
    raise exception 'Invitations en double sur un meme film (reinvitations apres refus) : lance la requete 0 en tete de ce fichier et supprime les doublons avant le retour arriere.';
  end if;
end $$;

drop index if exists public.project_invitations_one_pending;

alter table public.project_invitations
  add constraint project_invitations_project_id_invited_profile_id_key
  unique (project_id, invited_profile_id);

alter table public.project_invitations
  drop column if exists responded_at;

-- -----------------------------------------------------------------------------
-- A. Fonction de recherche par email
-- -----------------------------------------------------------------------------
drop function if exists public.user_id_by_email(text);

commit;


-- =============================================================================
-- CONTROLES (lecture seule), a lancer apres l'execution
-- =============================================================================

-- 1. Attendu : aucune ligne.
-- select proname from pg_proc where proname = 'user_id_by_email';

-- 2. Attendu : la contrainte project_invitations_project_id_invited_profile_id_key,
--    UNIQUE (project_id, invited_profile_id).
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.project_invitations'::regclass;

-- 3. Attendu : une ligne, "Managers can delete credits", DELETE.
-- select policyname, cmd from pg_policies
--  where schemaname = 'public' and tablename = 'project_credits' and cmd <> 'SELECT';
