-- =============================================================================
-- 20261020_close_direct_writes.sql — suites de l'audit RLS du 09/10/2026
-- =============================================================================
-- A EXECUTER A LA MAIN dans le SQL Editor, en une fois.
--
-- ORDRE IMPERATIF : deployer d'abord le code de ce commit, executer ensuite.
-- Deux routes ecrivaient avec le client utilisateur et passent en service role dans
-- ce commit (api/credits/[id] pour l'acceptation d'un credit, api/dashboard/profile
-- pour les metiers). Avec l'ancien code en ligne, cette migration casserait
-- l'enregistrement des metiers et l'acceptation des demandes de credit.
--
-- PRINCIPE : la cle publique est dans le navigateur, tout membre peut appeler la base
-- sans passer par les routes. Chaque ecriture que le code fait deja en service role
-- est fermee aux clients ; les regles qui n'existaient que dans une route ne peuvent
-- plus etre contournees.
--
-- Constats traites (docs/audits/2026-10-09-rls.md) : I1 a I6, M1 a M4.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- I1. Credits et invitations : plus aucune insertion ni modification par un client
-- -----------------------------------------------------------------------------
-- Un gestionnaire pouvait crediter n'importe quel membre sans son accord, ou passer
-- lui-meme une invitation a « acceptee ». Les routes ecrivent en service role
-- (api/credits/[id], api/invitations, api/invitations/project, publish_project).
-- La suppression d'un credit par un gestionnaire reste possible (aucun risque de
-- consentement). La personne creditee retire son propre credit par la route
-- DELETE /api/dashboard/credits.
drop policy if exists "Managers can add credits" on public.project_credits;
drop policy if exists "Managers can update credits" on public.project_credits;
revoke insert, update on public.project_credits from anon, authenticated;

drop policy if exists managers_can_invite on public.project_invitations;
drop policy if exists managers_can_update_invitations on public.project_invitations;
drop policy if exists inviter_can_delete on public.project_invitations;
revoke insert, update, delete on public.project_invitations from anon, authenticated;

-- Invitations par email (meme famille, memes routes en service role).
drop policy if exists managers_can_insert_invitation on public.invitations;
drop policy if exists managers_can_delete_invitation on public.invitations;
revoke insert, update, delete on public.invitations from anon, authenticated;

-- -----------------------------------------------------------------------------
-- I2 + M4. Bucket avatars : images seulement, plus d'ecriture ni de listage direct
-- -----------------------------------------------------------------------------
-- La route api/avatar controle le fichier et ecrit en service role. Les policies
-- laissaient en plus deposer n'importe quel fichier, et lister tout le bucket.
-- Un bucket public sert ses fichiers par URL sans aucune policy.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
where id = 'avatars';

drop policy if exists avatars_upload_own on storage.objects;
drop policy if exists avatars_update_own on storage.objects;
drop policy if exists avatars_delete_own on storage.objects;
drop policy if exists avatars_public_read on storage.objects;

-- -----------------------------------------------------------------------------
-- I3. contact_requests : table inutilisee, fermee
-- -----------------------------------------------------------------------------
drop policy if exists "Anyone can send contact request" on public.contact_requests;
drop policy if exists "Recipients can view their requests" on public.contact_requests;
drop policy if exists "Recipients can update request status" on public.contact_requests;
revoke all on public.contact_requests from anon, authenticated;

-- -----------------------------------------------------------------------------
-- I4. Un compte suspendu disparait de la lecture publique, dans les policies
-- -----------------------------------------------------------------------------
-- Le compte suspendu lit toujours sa propre ligne ("Users can view own profile") et
-- ses propres films ("Managers see their projects").
drop policy if exists "Approved profiles are public" on public.profiles;
create policy "Approved profiles are public" on public.profiles
  for select to public
  using (status = 'approved' and is_suspended is not true);

drop policy if exists "Public profile roles" on public.profile_roles;
create policy "Public profile roles" on public.profile_roles
  for select to public
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = profile_roles.profile_id
        and (
          (profiles.status = 'approved' and profiles.is_suspended is not true)
          or profiles.id = auth.uid()
        )
    )
  );

drop policy if exists "Public approved projects" on public.projects;
create policy "Public approved projects" on public.projects
  for select to public
  using (
    status = 'approved'
    and (visibility = 'public' or (visibility = 'members' and public.is_member()))
    and exists (
      select 1 from public.profiles
      where profiles.id = projects.profile_id
        and profiles.status = 'approved'
        and profiles.is_suspended is not true
    )
  );

-- Ces deux fonctions contournent la RLS (SECURITY DEFINER) : meme condition, ecrite
-- dedans. Elles alimentent les credits publics et les films lies.
create or replace function public.can_view_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.profiles pr on pr.id = p.profile_id
    where p.id = p_project_id
      and p.status = 'approved'
      and pr.status = 'approved'
      and pr.is_suspended is not true
      and (p.visibility = 'public' or (p.visibility = 'members' and public.is_member()))
  );
$$;

create or replace function public.is_project_public(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.profiles pr on pr.id = p.profile_id
    where p.id = p_project_id
      and p.status = 'approved'
      and p.visibility = 'public'
      and pr.status = 'approved'
      and pr.is_suspended is not true
  );
$$;

-- -----------------------------------------------------------------------------
-- I5. Signal « Disponible » : le destinataire et le poste ne changent plus apres coup
-- -----------------------------------------------------------------------------
-- L'insertion verifie que le destinataire recrute, qu'il est Pro et qu'il cherche ce
-- poste ; la modification ne verifiait rien. La prolongation (expires_at) et la
-- re-activation par upsert restent possibles : elles ne touchent pas ces colonnes.
create or replace function public.lock_availability_signal_target()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.talent_id is distinct from old.talent_id
     or new.recruiter_id is distinct from old.recruiter_id
     or new.role is distinct from old.role then
    raise exception 'Le destinataire et le poste d''un signal ne peuvent pas etre modifies'
      using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function public.lock_availability_signal_target() from public, anon, authenticated;

drop trigger if exists lock_availability_signal_target on public.availability_signals;
create trigger lock_availability_signal_target
  before update on public.availability_signals
  for each row execute function public.lock_availability_signal_target();

-- -----------------------------------------------------------------------------
-- I6. Metiers d'un profil : plus d'ecriture directe
-- -----------------------------------------------------------------------------
-- La liste fermee des metiers et le maximum de 5 sont controles par les routes
-- (api/dashboard/profile, api/signup), qui ecrivent en service role.
drop policy if exists "Users can manage own roles" on public.profile_roles;
drop policy if exists "Users can delete own roles" on public.profile_roles;
revoke insert, update, delete on public.profile_roles from anon, authenticated;

-- -----------------------------------------------------------------------------
-- M1. Demande de credit : toujours « en attente », et sur un film visible
-- -----------------------------------------------------------------------------
drop policy if exists requester_can_insert on public.credit_requests;
create policy requester_can_insert on public.credit_requests
  for insert to public
  with check (
    auth.uid() = requester_id
    and status = 'pending'
    and public.can_view_project(project_id)
  );

-- -----------------------------------------------------------------------------
-- M2. Droits de table inutiles
-- -----------------------------------------------------------------------------
-- Tables reservees au service role : plus aucun droit pour les clients (la RLS sans
-- policy les fermait deja ; ceci retire le second verrou manquant).
revoke all on public.admin_logs, public.project_moderation, public.rate_limits,
              public.reports, public.stripe_events, public.waitlist
  from anon, authenticated;

-- TRUNCATE n'est pas soumis a la RLS : aucun client ne doit l'avoir.
revoke truncate on all tables in schema public from anon, authenticated;

-- Aucune policy de suppression sur profiles : le droit ne sert a rien.
revoke delete on public.profiles from authenticated;

-- -----------------------------------------------------------------------------
-- M3. Fonctions de declencheur
-- -----------------------------------------------------------------------------
-- update_updated_at n'a aucune raison d'etre SECURITY DEFINER et n'avait pas de
-- search_path. Une fonction de declencheur ne s'appelle pas directement : le droit
-- d'execution public ne sert a rien (les declencheurs continuent de fonctionner).
alter function public.update_updated_at() security invoker;
alter function public.update_updated_at() set search_path = '';
revoke all on function public.update_updated_at() from public, anon, authenticated;
revoke all on function public.guard_profiles_system_columns() from public, anon, authenticated;
revoke all on function public.guard_projects_columns() from public, anon, authenticated;

commit;


-- =============================================================================
-- CONTROLES (lecture seule, une requete a la fois)
-- =============================================================================

-- C1. Policies d'ecriture restantes sur les tables traitees. Attendu :
--     project_credits : "Managers can delete credits" seulement ;
--     credit_requests : requester_can_insert, managers_can_decide, requester_can_cancel_pending ;
--     aucune ligne pour project_invitations, invitations, profile_roles, contact_requests.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and cmd <> 'SELECT'
  and tablename in ('project_credits', 'project_invitations', 'invitations', 'profile_roles',
                    'contact_requests', 'credit_requests')
order by tablename, cmd;

-- C2. Droits d'ecriture restants pour les clients sur ces tables. Attendu :
--     project_credits : DELETE (authenticated) seulement ; rien pour les autres,
--     sauf credit_requests (INSERT, DELETE, et UPDATE sur la colonne status).
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as droits
from information_schema.table_privileges
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  and table_name in ('project_credits', 'project_invitations', 'invitations', 'profile_roles',
                     'contact_requests', 'credit_requests', 'admin_logs', 'project_moderation',
                     'rate_limits', 'reports', 'stripe_events', 'waitlist', 'profiles')
group by table_name, grantee
order by table_name, grantee;

-- C3. Plus aucun TRUNCATE pour un client. Attendu : 0 ligne.
select table_name, grantee
from information_schema.table_privileges
where table_schema = 'public' and privilege_type = 'TRUNCATE' and grantee in ('anon', 'authenticated');

-- C4. Bucket avatars. Attendu : public = true, 5242880, trois types d'image ;
--     puis aucune policy sur storage.objects.
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars';
select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects';

-- C5. is_suspended reste lisible par les clients (la policy de profiles s'en sert).
--     Attendu : deux lignes, anon et authenticated.
select grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_suspended'
  and privilege_type = 'SELECT' and grantee in ('anon', 'authenticated');

-- C6. Fonctions. Attendu : update_updated_at en invoker avec search_path vide ;
--     les deux fonctions de visibilite toujours en definer.
select proname, prosecdef as definer, proconfig
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('update_updated_at', 'can_view_project', 'is_project_public', 'lock_availability_signal_target');
