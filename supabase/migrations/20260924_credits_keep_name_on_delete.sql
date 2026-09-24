-- =============================================================================
-- Suppression d'un utilisateur credite : figer son nom dans ses credits
-- =============================================================================
--
-- POURQUOI CE FICHIER (bug releve le 24/09/2026, voir docs/ROADMAP.md)
-- Supprimer un utilisateur credite sur un film echoue et annule toute la
-- suppression. Chaine : auth.users -> profiles (ON DELETE CASCADE), puis
-- project_credits.profile_id (ON DELETE SET NULL). Un credit lie a un compte a
-- ghost_name = NULL (credit proprietaire insere sans nom dans
-- api/dashboard/projects et api/signup ; invitation acceptee qui remet
-- ghost_name a NULL dans api/signup). Le SET NULL produit une ligne sans
-- profile_id ni ghost_name : le CHECK credit_has_person est viole.
--
-- DECISION PRODUIT (Maxime, 24/09/2026)
-- Le credit est conserve et devient un credit fantome portant le nom public de
-- la personne : stage_name s'il est defini (non vide), sinon full_name.
--
-- CE QU'IL FAIT
-- Trigger BEFORE DELETE sur profiles : avant la suppression de la ligne, remplit
-- ghost_name sur tous ses credits ou il est vide. Un trigger BEFORE de ligne se
-- declenche aussi lors d'une suppression en cascade depuis auth.users, et avant
-- l'action referentielle SET NULL (executee apres la suppression de la ligne).
-- Un ghost_name deja renseigne n'est jamais ecrase.
--
-- CE QU'IL NE FAIT PAS
--   - Aucun changement de schema, de FK, de CHECK, ni de code applicatif.
--   - Ne touche pas aux autres FK vers profiles : si l'une d'elles est en
--     RESTRICT / NO ACTION, elle bloquera encore la suppression (voir la
--     requete de verification ci-dessous).
--
-- SECURITY DEFINER : la suppression est declenchee par supabase_auth_admin
-- (dashboard, auth.admin.deleteUser) ou le service role ; la fonction doit
-- pouvoir ecrire project_credits quel que soit l'appelant. search_path vide et
-- noms qualifies.
--
-- Idempotent : create or replace + drop trigger if exists.
-- Rollback : 20260924_credits_keep_name_on_delete_rollback.sql
--
-- =============================================================================
-- VERIFICATION AVANT EXECUTION
-- =============================================================================
--   -- 1. Credits qui bloquent aujourd'hui la suppression de leur titulaire
--   select count(*) as credits_sans_nom
--   from public.project_credits
--   where profile_id is not null and ghost_name is null;
--
--   -- 2. Toutes les FK vers profiles et leur action ON DELETE
--   --    (a = NO ACTION, r = RESTRICT, c = CASCADE, n = SET NULL, d = SET DEFAULT)
--   select conrelid::regclass as table_source, conname, confdeltype
--   from pg_constraint
--   where contype = 'f' and confrelid = 'public.profiles'::regclass
--   order by 1, 2;
--   --    Toute ligne en 'a' ou 'r' peut encore bloquer une suppression.
-- =============================================================================

begin;

create or replace function public.keep_credit_name_on_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.project_credits
  set ghost_name = coalesce(nullif(btrim(old.stage_name), ''), old.full_name)
  where profile_id = old.id
    and ghost_name is null;
  return old;
end;
$$;

revoke all on function public.keep_credit_name_on_profile_delete() from public, anon, authenticated;

drop trigger if exists keep_credit_name_on_profile_delete on public.profiles;
create trigger keep_credit_name_on_profile_delete
  before delete on public.profiles
  for each row execute function public.keep_credit_name_on_profile_delete();

commit;

-- =============================================================================
-- VERIFICATION APRES EXECUTION
-- =============================================================================
--   -- Trigger present
--   select tgname, tgenabled from pg_trigger
--   where tgrelid = 'public.profiles'::regclass
--     and tgname = 'keep_credit_name_on_profile_delete';
--
--   -- Test sans effet (transaction annulee) sur un compte credite.
--   -- Choisir un profil de test ayant au moins un credit sans ghost_name :
--   select c.profile_id, p.full_name, p.stage_name, count(*)
--   from public.project_credits c join public.profiles p on p.id = c.profile_id
--   where c.ghost_name is null
--   group by 1, 2, 3;
--
--   begin;
--   create temp table t_credits on commit drop as
--     select id from public.project_credits where profile_id = '<uuid>';
--   delete from auth.users where id = '<uuid>';     -- ne doit plus echouer
--   select c.id, c.profile_id, c.ghost_name, c.role_on_project
--   from public.project_credits c
--   where c.id in (select id from t_credits);
--   -- Attendu : credits sur les films des autres -> profile_id NULL,
--   -- ghost_name = nom public. Credits sur ses propres films : supprimes
--   -- avec le film (projects en cascade), donc absents.
--   rollback;                                        -- OBLIGATOIRE
-- =============================================================================
