-- =============================================================================
-- ROLLBACK de 20261008_film_management.sql
-- =============================================================================
--
-- Remet les policies, privileges, contraintes et index dans l'etat releve en
-- prod le 08/10/2026, et supprime les tables, fonctions et triggers ajoutes.
--
-- ATTENTION, CE QUI EST PERDU
--   - Toutes les donnees des nouvelles tables : co-gestionnaires, declarations
--     de droits, demandes de co-gestion, revendications, donnees de moderation.
--   - L'etat publie / depublie des films (colonne is_published).
-- CE QUI N'EST PAS DEFAIT
--   - Le backfill de video_key (les cles ecrites sont justes, on les garde).
--   - Le bucket Storage `claims` et ses fichiers (a supprimer a la main depuis
--     le tableau de bord si besoin).
-- CE QUI PEUT BLOQUER
--   - Un film sans Responsable (profile_id NULL) empeche de remettre NOT NULL :
--     lui donner un Responsable ou le supprimer avant de lancer ce fichier.
--       select id, title from public.projects where profile_id is null;
--   - Un film refuse et un autre film qui portent la meme video_key empechent
--     de recreer l'ancien index unique (qui ne distinguait pas les refuses) :
--       select video_key, count(*) from public.projects
--       where video_key is not null group by 1 having count(*) > 1;
--
-- A lancer APRES avoir remis en ligne le code d'avant les lots 2 et 3.
-- =============================================================================

begin;

-- ---- Triggers et fonctions metier -------------------------------------------
drop trigger if exists transfer_projects_on_profile_delete on public.profiles;
drop trigger if exists track_project_credit_edit on public.project_credits;
drop trigger if exists track_project_edit on public.projects;
drop trigger if exists zz_guard_projects_columns on public.projects;

drop function if exists public.transfer_projects_on_profile_delete();
drop function if exists public.track_project_edit();
drop function if exists public.guard_projects_columns();

drop function if exists public.publish_project(uuid, text, text, text, public.project_category, integer, text, text, text, boolean, integer, text, text, jsonb);
drop function if exists public.request_project_manager(uuid, uuid, uuid);
drop function if exists public.decide_project_manager(uuid, uuid, boolean);
drop function if exists public.transfer_project(uuid, uuid, uuid, integer);

-- ---- Policies : retour a l'etat du 08/10/2026 ---------------------------------

-- projects
drop policy if exists "Managers can update their projects" on public.projects;
drop policy if exists "Managers see their projects" on public.projects;
create policy "Owner sees own projects"
  on public.projects for select
  using (auth.uid() = profile_id);

drop policy if exists "Public approved projects" on public.projects;
create policy "Public approved projects"
  on public.projects for select
  using (
    status = 'approved'
    and exists (
      select 1 from public.profiles
      where profiles.id = projects.profile_id
        and profiles.status = 'approved'::public.profile_status
    )
  );

create policy "Users can insert own projects"
  on public.projects for insert
  with check (auth.uid() = profile_id and status = 'pending');

-- project_credits
drop policy if exists "Credits of public or managed projects" on public.project_credits;
create policy "Public project credits"
  on public.project_credits for select
  using (
    exists (
      select 1
      from public.projects
      join public.profiles on profiles.id = projects.profile_id
      where projects.id = project_credits.project_id
        and (profiles.status = 'approved'::public.profile_status or profiles.id = auth.uid())
    )
  );

drop policy if exists "Managers can add credits" on public.project_credits;
create policy "Project owners can manage credits"
  on public.project_credits for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = project_credits.project_id and projects.profile_id = auth.uid()
    )
  );

drop policy if exists "Managers can update credits" on public.project_credits;
create policy "Project owners can update credits"
  on public.project_credits for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_credits.project_id and projects.profile_id = auth.uid()
    )
  );

drop policy if exists "Managers can delete credits" on public.project_credits;
create policy "Project owners can delete credits"
  on public.project_credits for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_credits.project_id and projects.profile_id = auth.uid()
    )
  );

-- credit_requests
drop policy if exists managers_see_requests on public.credit_requests;
create policy owner_sees_requests
  on public.credit_requests for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = credit_requests.project_id and projects.profile_id = auth.uid()
    )
  );

drop policy if exists managers_can_decide on public.credit_requests;
create policy owner_can_update
  on public.credit_requests for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = credit_requests.project_id and projects.profile_id = auth.uid()
    )
  );

-- project_invitations
drop policy if exists managers_can_invite on public.project_invitations;
create policy creator_can_invite
  on public.project_invitations for insert
  with check (auth.uid() = inviter_id);

drop policy if exists managers_can_update_invitations on public.project_invitations;
create policy parties_can_update
  on public.project_invitations for update
  using (auth.uid() = invited_profile_id or auth.uid() = inviter_id);

-- invitations
drop policy if exists managers_can_insert_invitation on public.invitations;
create policy owner_can_insert_invitation
  on public.invitations for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = invitations.project_id and projects.profile_id = auth.uid()
    )
  );

drop policy if exists managers_see_invitations on public.invitations;
create policy owner_sees_invitations
  on public.invitations for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = invitations.project_id and projects.profile_id = auth.uid()
    )
  );

drop policy if exists managers_can_delete_invitation on public.invitations;
create policy owner_can_delete_invitation
  on public.invitations for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = invitations.project_id and projects.profile_id = auth.uid()
    )
  );

-- ---- Nouvelles tables (leurs policies partent avec elles) ---------------------
drop table if exists public.project_moderation;
drop table if exists public.project_claims;
drop table if exists public.project_manager_requests;
drop table if exists public.project_rights_declarations;
drop table if exists public.project_managers;

-- ---- Fonctions d'appui (plus aucune policy ne les utilise) --------------------
drop function if exists public.is_project_public(uuid);
drop function if exists public.is_project_manager(uuid);
drop function if exists public.is_project_owner(uuid);
drop function if exists public.extract_video_key(text);

-- ---- Privileges : retour a l'etat du 08/10/2026 --------------------------------
revoke update (title, description, category, year, is_published) on public.projects from authenticated;
grant insert on public.projects to authenticated;
grant insert, delete on public.projects to anon;

grant update on public.credit_requests to authenticated;

grant insert, update, delete, truncate
  on public.project_credits, public.credit_requests, public.project_invitations,
     public.invitations, public.reports, public.admin_logs
  to anon;
grant truncate
  on public.project_credits, public.credit_requests, public.project_invitations,
     public.invitations, public.reports, public.admin_logs
  to authenticated;

-- ---- projects : colonnes, FK, index -------------------------------------------
alter table public.projects drop column if exists is_published;

alter table public.projects drop constraint projects_profile_id_fkey;
alter table public.projects
  add constraint projects_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete cascade;
alter table public.projects alter column profile_id set not null;

drop index if exists public.projects_video_key_unique;
create unique index projects_video_key_unique
  on public.projects (video_key)
  where video_key is not null;

-- ---- profiles : CHECK pro_grant_* d'origine ------------------------------------
alter table public.profiles drop constraint if exists profiles_pro_grant_type_check;
alter table public.profiles
  add constraint profiles_pro_grant_type_check
  check (pro_grant_type is null or pro_grant_type in ('launch', 'vip', 'recruiter'));

alter table public.profiles drop constraint if exists profiles_pro_grant_expiry_check;
alter table public.profiles
  add constraint profiles_pro_grant_expiry_check
  check (
    pro_grant_type is null
    or (pro_grant_type = 'launch' and pro_grant_expires_at is not null)
    or (pro_grant_type = 'vip')
    or (pro_grant_type = 'recruiter' and pro_grant_expires_at is null)
  );

commit;

-- =============================================================================
-- VERIFICATION APRES ROLLBACK
-- =============================================================================
--   select tablename, cmd, policyname from pg_policies
--   where schemaname = 'public'
--     and tablename in ('projects', 'project_credits', 'credit_requests',
--                       'project_invitations', 'invitations')
--   order by 1, 2, 3;
--     projects            : 2 SELECT, 1 INSERT, 1 DELETE
--     project_credits     : 1 SELECT, 1 INSERT, 1 UPDATE, 1 DELETE
--     credit_requests     : 2 SELECT, 1 INSERT, 1 UPDATE
--     project_invitations : 1 SELECT, 1 INSERT, 1 UPDATE, 1 DELETE
--     invitations         : 1 SELECT, 1 INSERT, 1 DELETE
-- =============================================================================
