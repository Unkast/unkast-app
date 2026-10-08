-- =============================================================================
-- Gestion des films : Responsable, co-gestionnaires, droits, doublons, policies
-- =============================================================================
--
-- POURQUOI CE FICHIER (decisions de Maxime, 08/10/2026)
-- Aujourd'hui un film a un seul proprietaire (projects.profile_id), ne peut pas
-- etre modifie, et plusieurs regles ne tiennent que par les routes API. Releve
-- prod du 08/10/2026 (pg_policies, grants, triggers, FK) : voir docs/database.md.
--
-- CE QU'IL FAIT
--   A. projects : profile_id nullable (film sans Responsable), FK en SET NULL,
--      colonne is_published, index unique video_key qui exclut les films refuses,
--      backfill de video_key sur les films approuves qui n'en ont pas.
--   B. Nouvelles tables : project_managers (co-gestionnaires),
--      project_rights_declarations (declaration de droits, ajout seul),
--      project_manager_requests (invitation / demande de co-gestion),
--      project_claims (signalement / revendication, traite par l'admin),
--      project_moderation (titre et chaine oEmbed, suivi des modifications ;
--      service role uniquement). Bucket Storage prive `claims`.
--   C. Fonctions d'appui pour les policies : is_project_owner,
--      is_project_manager, is_project_public, extract_video_key.
--   D. Policies : projects (lecture gestionnaires, UPDATE par colonne, plus
--      d'INSERT client), project_credits, credit_requests, project_invitations,
--      invitations. Failles fermees : invitation sur le film d'un autre,
--      deplacement d'une invitation, equipe d'un film non public lisible par tous.
--   E. Triggers : garde des colonnes de projects (modele
--      guard_profiles_system_columns : SECURITY INVOKER, test de rolbypassrls),
--      suivi des modifications d'un film approuve, transfert a la suppression
--      du compte du Responsable.
--   F. Fonctions metier, service role uniquement (appelees par les routes API
--      avec l'identite de l'utilisateur en parametre) : publish_project,
--      request_project_manager, decide_project_manager, transfer_project.
--   G. Privileges : anon perd INSERT / UPDATE / DELETE / TRUNCATE, authenticated
--      perd TRUNCATE, sur les tables concernees.
--   H. profiles : retrait de 'recruiter' des CHECK pro_grant_* (annule tout si
--      une ligne le porte encore).
--
-- CE QU'IL NE FAIT PAS
--   - Aucun backfill de credit « Realisation » (decision : les films sans credit
--     de realisation n'affichent aucun nom de realisateur).
--   - Aucune declaration de droits creee pour l'existant : elle est exigee du
--     Responsable a sa prochaine modification du film (trigger, partie E).
--   - Masquage des noms d'equipe pour les visiteurs non connectes : propose a
--     part, pas applique ici.
--   - DELETE sur credit_requests (annuler sa demande) : aucune policy n'existe,
--     la route ne supprime donc rien aujourd'hui. Non corrige ici, a trancher.
--   - Phase 2 (demande de transfert, historique, notifications) : rien.
--
-- ORDRE DE MISE EN SERVICE
-- A executer JUSTE AVANT de deployer le code des lots 2 et 3. Entre les deux,
-- l'ancien code ne peut plus publier de film (INSERT client retire sur projects).
--
-- Rollback : 20261008_film_management_rollback.sql
--
-- =============================================================================
-- VERIFICATION AVANT EXECUTION (lecture seule)
-- =============================================================================
--   -- 1. Doit renvoyer 0 (sinon la partie H annule toute la migration)
--   select count(*) from public.profiles where pro_grant_type = 'recruiter';
--
--   -- 2. Films publics sans credit de realisation (role decoupe sur & , /)
--   select p.title, pr.full_name as proprietaire
--   from public.projects p
--   join public.profiles pr on pr.id = p.profile_id
--   where p.status = 'approved'
--     and not exists (
--       select 1
--       from public.project_credits pc,
--            regexp_split_to_table(pc.role_on_project, '[&,/]') as part
--       where pc.project_id = p.id
--         and replace(replace(translate(lower(btrim(part)), 'éèêë', 'eeee'), '-', ''), ' ', '')
--             in ('realisateur', 'realisatrice', 'realisation', 'corealisateur', 'corealisatrice')
--     )
--   order by p.created_at;
--
--   -- 3. Backfill video_key : ce que la partie A va ecrire, et ce qu'elle laisse
--   --    (cette requete ne marche qu'APRES creation de extract_video_key ; la
--   --    meme liste est redonnee dans la verification apres execution)
-- =============================================================================

begin;

-- =============================================================================
-- H. profiles : 'recruiter' n'est plus un type de grant
-- =============================================================================
do $$
begin
  if exists (select 1 from public.profiles where pro_grant_type = 'recruiter') then
    raise exception 'Des profils portent encore pro_grant_type = recruiter : migration annulee.';
  end if;
end $$;

alter table public.profiles drop constraint if exists profiles_pro_grant_type_check;
alter table public.profiles
  add constraint profiles_pro_grant_type_check
  check (pro_grant_type is null or pro_grant_type in ('launch', 'vip'));

alter table public.profiles drop constraint if exists profiles_pro_grant_expiry_check;
alter table public.profiles
  add constraint profiles_pro_grant_expiry_check
  check (
    pro_grant_type is null
    or (pro_grant_type = 'launch' and pro_grant_expires_at is not null)
    or (pro_grant_type = 'vip')
  );

-- =============================================================================
-- C1. extract_video_key : meme logique que extractVideoKey (src/lib/utils.ts)
-- =============================================================================
-- Renvoie 'youtube:<id>' ou 'vimeo:<id>', sinon NULL (aucune unicite appliquee).
-- Les deux implementations doivent rester alignees.
create or replace function public.extract_video_key(p_url text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  m text[];
  v_host text;
  v_path text;
  v_query text;
  v_id text;
begin
  m := regexp_match(btrim(coalesce(p_url, '')), '^[a-z][a-z0-9+.-]*://([^/?#]+)([^?#]*)(\?[^#]*)?', 'i');
  if m is null then
    return null;
  end if;

  -- Hote sans identifiants ni port, sans www. / m. / player.
  v_host := lower(m[1]);
  v_host := regexp_replace(v_host, '^.*@', '');
  v_host := regexp_replace(v_host, ':\d+$', '');
  v_host := regexp_replace(v_host, '^(www\.|m\.|player\.)', '');
  v_path := coalesce(m[2], '');
  v_query := coalesce(m[3], '');

  if v_host = 'youtu.be' then
    v_id := (regexp_match(v_path, '^/+([^/]+)'))[1];
  elsif v_host in ('youtube.com', 'youtube-nocookie.com') then
    v_id := (regexp_match(v_query, '[?&]v=([^&]*)'))[1];
    if v_id is null or v_id = '' then
      v_id := (regexp_match(v_path, '^/+(?:embed|shorts|v|live)/+([^/]+)'))[1];
    end if;
  elsif v_host = 'vimeo.com' then
    -- Dernier segment compose uniquement de chiffres
    select s.seg into v_id
    from regexp_split_to_table(v_path, '/') with ordinality as s(seg, ord)
    where s.seg ~ '^\d+$'
    order by s.ord desc
    limit 1;
    if v_id is not null then
      return 'vimeo:' || v_id;
    end if;
    return null;
  else
    return null;
  end if;

  if v_id ~ '^[A-Za-z0-9_-]{11}$' then
    return 'youtube:' || v_id;
  end if;
  return null;
end;
$$;

revoke all on function public.extract_video_key(text) from public, anon, authenticated;

-- =============================================================================
-- A. projects
-- =============================================================================

-- Film sans Responsable possible (compte supprime sans co-gestionnaire).
alter table public.projects alter column profile_id drop not null;
alter table public.projects drop constraint projects_profile_id_fkey;
alter table public.projects
  add constraint projects_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete set null;

-- Un seul interrupteur : publie / depublie (reserve au Responsable).
alter table public.projects add column if not exists is_published boolean not null default true;

comment on column public.projects.profile_id is
  'Responsable du film (un seul). NULL = film sans Responsable (compte supprime sans co-gestionnaire) : depublie, a traiter par l''admin.';
comment on column public.projects.is_published is
  'Interrupteur du Responsable. Public = status approved ET is_published ET Responsable au profil approuve.';

-- Backfill de video_key sur les films approuves qui n'en ont pas. Rien n'est
-- ecrase : une cle deja prise par un autre film, ou partagee par deux candidats,
-- est laissee a NULL (liste dans la verification apres execution).
with cand as (
  select id, public.extract_video_key(video_url) as k
  from public.projects
  where video_key is null and status = 'approved'
),
safe as (
  select c.id, c.k
  from cand c
  where c.k is not null
    and not exists (select 1 from public.projects p where p.video_key = c.k)
    and (select count(*) from cand c2 where c2.k = c.k) = 1
)
update public.projects p
set video_key = s.k
from safe s
where p.id = s.id;

-- Un film refuse libere sa cle video : l'ayant droit peut la publier.
drop index if exists public.projects_video_key_unique;
create unique index projects_video_key_unique
  on public.projects (video_key)
  where video_key is not null and status is distinct from 'refused';

-- =============================================================================
-- B. Nouvelles tables
-- =============================================================================

-- Co-gestionnaires (le Responsable n'y figure pas : il est dans projects.profile_id).
create table public.project_managers (
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  added_by   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);
create index project_managers_profile_idx on public.project_managers (profile_id);

-- Declarations de droits : ajout seul, jamais modifiees ni supprimees par un client.
create table public.project_rights_declarations (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  profile_id        uuid references public.profiles(id) on delete set null,
  declared_role     text not null
    check (declared_role in ('realisateur', 'producteur', 'ayant_droit', 'autre')),
  text_version      text not null,
  -- Publicite et clip : « Le client ou le label a autorise la diffusion publique »
  client_authorized boolean not null default false,
  declared_at       timestamptz not null default now()
);
create index project_rights_declarations_project_idx
  on public.project_rights_declarations (project_id, profile_id);

-- Invitation (par le Responsable) ou demande (par une personne creditee).
create table public.project_manager_requests (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('invite', 'request')),
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'refused')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (project_id, profile_id)
);
create index project_manager_requests_profile_idx on public.project_manager_requests (profile_id);

-- Signalement / revendication d'un film, traite par l'admin.
create table public.project_claims (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  claimant_id   uuid not null references public.profiles(id) on delete cascade,
  kind          text not null check (kind in ('report', 'claim')),
  message       text not null,
  document_path text,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create unique index project_claims_one_pending
  on public.project_claims (project_id, claimant_id) where status = 'pending';
create index project_claims_status_idx on public.project_claims (status, created_at);

-- Donnees de moderation : jamais lisibles par un client.
create table public.project_moderation (
  project_id    uuid primary key references public.projects(id) on delete cascade,
  source_title  text,          -- titre renvoye par oEmbed a la soumission
  source_author text,          -- nom de la chaine YouTube / Vimeo
  edited_at     timestamptz,   -- derniere modification d'un film approuve
  edited_by     uuid references public.profiles(id) on delete set null
);
create index project_moderation_edited_idx
  on public.project_moderation (edited_at) where edited_at is not null;

alter table public.project_managers            enable row level security;
alter table public.project_rights_declarations enable row level security;
alter table public.project_manager_requests    enable row level security;
alter table public.project_claims              enable row level security;
alter table public.project_moderation          enable row level security;

-- Justificatifs des revendications : bucket prive, aucune policy sur
-- storage.objects (lecture et ecriture par le service role uniquement).
insert into storage.buckets (id, name, public)
values ('claims', 'claims', false)
on conflict (id) do nothing;

-- =============================================================================
-- C2. Fonctions d'appui des policies
-- =============================================================================
-- SECURITY DEFINER : elles lisent projects / project_managers sans repasser par
-- leurs policies (sinon recursion). Elles ne parlent que de l'appelant
-- (auth.uid()), jamais d'un autre utilisateur.

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.profile_id = auth.uid()
  );
$$;

-- Gestionnaire = Responsable ou co-gestionnaire.
create or replace function public.is_project_manager(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.profile_id = auth.uid()
  ) or exists (
    select 1 from public.project_managers m
    where m.project_id = p_project_id and m.profile_id = auth.uid()
  );
$$;

-- Meme regle que la policy de lecture publique de projects.
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
      and p.is_published
      and pr.status = 'approved'
  );
$$;

revoke all on function public.is_project_owner(uuid)   from public;
revoke all on function public.is_project_manager(uuid) from public;
revoke all on function public.is_project_public(uuid)  from public;
grant execute on function public.is_project_owner(uuid)   to anon, authenticated, service_role;
grant execute on function public.is_project_manager(uuid) to anon, authenticated, service_role;
grant execute on function public.is_project_public(uuid)  to anon, authenticated, service_role;

-- =============================================================================
-- D. Policies
-- =============================================================================

-- ---- projects ---------------------------------------------------------------
drop policy if exists "Public approved projects" on public.projects;
create policy "Public approved projects"
  on public.projects for select
  using (
    status = 'approved'
    and is_published
    and exists (
      select 1 from public.profiles
      where profiles.id = projects.profile_id
        and profiles.status = 'approved'::public.profile_status
    )
  );

drop policy if exists "Owner sees own projects" on public.projects;
create policy "Managers see their projects"
  on public.projects for select
  using (public.is_project_manager(id));

-- Plus d'INSERT client : la publication passe par publish_project (partie F).
drop policy if exists "Users can insert own projects" on public.projects;

-- Modification par les gestionnaires, colonnes limitees par GRANT (partie G).
create policy "Managers can update their projects"
  on public.projects for update
  using (public.is_project_manager(id))
  with check (public.is_project_manager(id));

-- Suppression : policy existante conservee (Responsable seul, auth.uid() = profile_id).

-- ---- project_managers -------------------------------------------------------
create policy "Managers see the managers of their projects"
  on public.project_managers for select
  using (public.is_project_manager(project_id));

-- Retirer un co-gestionnaire (Responsable), ou se retirer soi-meme.
create policy "Owner removes managers, managers can leave"
  on public.project_managers for delete
  using (public.is_project_owner(project_id) or profile_id = auth.uid());

-- ---- project_rights_declarations --------------------------------------------
create policy "Users see own declarations"
  on public.project_rights_declarations for select
  using (profile_id = auth.uid());

-- Declaration du Responsable sur un film existant (la publication passe par
-- publish_project). Publicite et clip : l'accord du client ou du label est exige.
create policy "Owner declares rights"
  on public.project_rights_declarations for insert
  with check (
    profile_id = auth.uid()
    and public.is_project_owner(project_id)
    and (
      client_authorized
      or not exists (
        select 1 from public.projects p
        where p.id = project_rights_declarations.project_id
          and p.category in ('publicite', 'clip')
      )
    )
  );

-- ---- project_manager_requests -----------------------------------------------
create policy "Parties see manager requests"
  on public.project_manager_requests for select
  using (profile_id = auth.uid() or public.is_project_owner(project_id));

-- ---- project_claims ---------------------------------------------------------
create policy "Claimants see own claims"
  on public.project_claims for select
  using (claimant_id = auth.uid());

-- ---- project_credits --------------------------------------------------------
-- Avant : lisible des que le profil du proprietaire etait approuve, meme pour un
-- film en attente ou refuse.
drop policy if exists "Public project credits" on public.project_credits;
create policy "Credits of public or managed projects"
  on public.project_credits for select
  using (
    public.is_project_public(project_id)
    or public.is_project_manager(project_id)
    or profile_id = auth.uid()
  );

drop policy if exists "Project owners can manage credits" on public.project_credits;
create policy "Managers can add credits"
  on public.project_credits for insert
  with check (public.is_project_manager(project_id));

drop policy if exists "Project owners can update credits" on public.project_credits;
create policy "Managers can update credits"
  on public.project_credits for update
  using (public.is_project_manager(project_id))
  with check (public.is_project_manager(project_id));

drop policy if exists "Project owners can delete credits" on public.project_credits;
create policy "Managers can delete credits"
  on public.project_credits for delete
  using (public.is_project_manager(project_id));

-- ---- credit_requests --------------------------------------------------------
drop policy if exists owner_sees_requests on public.credit_requests;
create policy managers_see_requests
  on public.credit_requests for select
  using (public.is_project_manager(project_id));

-- Avant : toute la ligne etait modifiable, sans WITH CHECK. Seul status l'est
-- desormais (GRANT par colonne, partie G).
drop policy if exists owner_can_update on public.credit_requests;
create policy managers_can_decide
  on public.credit_requests for update
  using (public.is_project_manager(project_id))
  with check (public.is_project_manager(project_id));

-- ---- project_invitations ----------------------------------------------------
-- Avant : n'importe qui pouvait inviter sur n'importe quel film, et l'invite
-- pouvait changer project_id. L'acceptation passe par la route (service role).
drop policy if exists creator_can_invite on public.project_invitations;
create policy managers_can_invite
  on public.project_invitations for insert
  with check (auth.uid() = inviter_id and public.is_project_manager(project_id));

drop policy if exists parties_can_update on public.project_invitations;
create policy managers_can_update_invitations
  on public.project_invitations for update
  using (public.is_project_manager(project_id))
  with check (public.is_project_manager(project_id));

-- ---- invitations (par email) ------------------------------------------------
drop policy if exists owner_can_insert_invitation on public.invitations;
create policy managers_can_insert_invitation
  on public.invitations for insert
  with check (public.is_project_manager(project_id));

drop policy if exists owner_sees_invitations on public.invitations;
create policy managers_see_invitations
  on public.invitations for select
  using (public.is_project_manager(project_id));

drop policy if exists owner_can_delete_invitation on public.invitations;
create policy managers_can_delete_invitation
  on public.invitations for delete
  using (public.is_project_manager(project_id));

-- =============================================================================
-- G. Privileges
-- =============================================================================

-- anon n'ecrit nulle part ; authenticated ne vide aucune table.
revoke insert, update, delete, truncate
  on public.projects, public.project_credits, public.credit_requests,
     public.project_invitations, public.invitations, public.reports, public.admin_logs
  from anon;
revoke truncate
  on public.projects, public.project_credits, public.credit_requests,
     public.project_invitations, public.invitations, public.reports, public.admin_logs
  from authenticated;

-- projects : plus d'INSERT client ; UPDATE sur les seules colonnes modifiables.
revoke insert on public.projects from authenticated;
grant update (title, description, category, year, is_published)
  on public.projects to authenticated;

-- credit_requests : seul le statut se modifie.
revoke update on public.credit_requests from authenticated;
grant update (status) on public.credit_requests to authenticated;

-- Nouvelles tables : rien par defaut, puis le strict necessaire.
revoke all
  on public.project_managers, public.project_rights_declarations,
     public.project_manager_requests, public.project_claims, public.project_moderation
  from anon, authenticated;
grant select, delete on public.project_managers            to authenticated;
grant select, insert on public.project_rights_declarations to authenticated;
grant select         on public.project_manager_requests    to authenticated;
grant select         on public.project_claims              to authenticated;

-- =============================================================================
-- E. Triggers
-- =============================================================================

-- ---- E1. Garde des colonnes de projects -------------------------------------
-- Meme modele que guard_profiles_system_columns : SECURITY INVOKER, le role
-- courant decide (BYPASSRLS = postgres, service_role, et donc les fonctions
-- SECURITY DEFINER de ce fichier). Complement du GRANT par colonne, pas son
-- remplacant.
create or replace function public.guard_projects_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_bypassrls boolean;
  v_content_changed boolean;
begin
  select rolbypassrls into v_bypassrls
  from pg_catalog.pg_roles
  where rolname = current_user;

  if coalesce(v_bypassrls, false) then
    return new;
  end if;

  -- Colonnes systeme : restaurees silencieusement.
  new.id          := old.id;
  new.profile_id  := old.profile_id;
  new.slug        := old.slug;
  new.status      := old.status;
  new.video_url   := old.video_url;
  new.video_key   := old.video_key;
  new.poster_url  := old.poster_url;
  new.preview_url := old.preview_url;
  new.created_at  := old.created_at;

  -- Depublier / republier : Responsable seul.
  if new.is_published is distinct from old.is_published
     and old.profile_id is distinct from auth.uid() then
    raise exception 'owner_only' using errcode = '42501';
  end if;

  -- Le Responsable doit avoir declare ses droits avant de modifier le contenu
  -- (films anterieurs a ce chantier, ou film recu par transfert).
  v_content_changed :=
    (new.title, new.description, new.category, new.year)
    is distinct from (old.title, old.description, old.category, old.year);

  if v_content_changed
     and old.profile_id = auth.uid()
     and not exists (
       select 1 from public.project_rights_declarations d
       where d.project_id = old.id and d.profile_id = auth.uid()
     ) then
    raise exception 'rights_declaration_required' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists zz_guard_projects_columns on public.projects;
create trigger zz_guard_projects_columns
  before update on public.projects
  for each row execute function public.guard_projects_columns();

-- ---- E2. Suivi des modifications d'un film approuve -------------------------
-- Liste « modifies recemment » de l'admin. Ne suit que les actions d'un
-- utilisateur connecte (auth.uid() non NULL), pas celles de l'admin.
create or replace function public.track_project_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  if tg_table_name = 'projects' then
    if old.status is distinct from 'approved'
       or (new.title, new.description, new.category, new.year)
          is not distinct from (old.title, old.description, old.category, old.year) then
      return null;
    end if;
    v_project_id := new.id;
  else
    if tg_op = 'DELETE' then
      v_project_id := old.project_id;
    else
      v_project_id := new.project_id;
    end if;
    if not exists (
      select 1 from public.projects p
      where p.id = v_project_id and p.status = 'approved'
    ) then
      return null;
    end if;
  end if;

  insert into public.project_moderation (project_id, edited_at, edited_by)
  values (v_project_id, now(), auth.uid())
  on conflict (project_id) do update
    set edited_at = excluded.edited_at, edited_by = excluded.edited_by;
  return null;
end;
$$;

revoke all on function public.track_project_edit() from public, anon, authenticated;

drop trigger if exists track_project_edit on public.projects;
create trigger track_project_edit
  after update on public.projects
  for each row execute function public.track_project_edit();

drop trigger if exists track_project_credit_edit on public.project_credits;
create trigger track_project_credit_edit
  after insert or update or delete on public.project_credits
  for each row execute function public.track_project_edit();

-- ---- E3. Suppression du compte du Responsable -------------------------------
-- BEFORE DELETE : s'execute avant le SET NULL de la FK. Transfert au
-- co-gestionnaire le plus ancien ; sinon le film est depublie et reste sans
-- Responsable (liste dans l'admin : projects.profile_id is null).
create or replace function public.transfer_projects_on_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_next uuid;
begin
  for r in select id from public.projects where profile_id = old.id loop
    v_next := null;
    select m.profile_id into v_next
    from public.project_managers m
    where m.project_id = r.id and m.profile_id <> old.id
    order by m.created_at, m.profile_id
    limit 1;

    if v_next is not null then
      update public.projects set profile_id = v_next where id = r.id;
      delete from public.project_managers
      where project_id = r.id and profile_id = v_next;
    else
      update public.projects set is_published = false where id = r.id;
    end if;
  end loop;
  return old;
end;
$$;

revoke all on function public.transfer_projects_on_profile_delete() from public, anon, authenticated;

drop trigger if exists transfer_projects_on_profile_delete on public.profiles;
create trigger transfer_projects_on_profile_delete
  before delete on public.profiles
  for each row execute function public.transfer_projects_on_profile_delete();

-- =============================================================================
-- F. Fonctions metier (service role uniquement)
-- =============================================================================
-- Les routes API les appellent avec le client service role, apres avoir
-- authentifie l'utilisateur (getActiveUser) : son id est passe en parametre.
-- Aucun client ne peut les appeler directement. Elles renvoient
-- { ok: boolean, code: text, ... } au lieu de lever une erreur.

-- ---- F1. Publier un film ----------------------------------------------------
-- Atomique : plafond, declaration de droits, doublon, film, credits.
-- p_limit : plafond du plan (lib/constants.ts), lu par la route.
-- p_credits : [{ "profile_id": uuid|null, "ghost_name": text|null, "role": text }]
create or replace function public.publish_project(
  p_profile_id        uuid,
  p_title             text,
  p_slug              text,
  p_description       text,
  p_category          public.project_category,
  p_year              integer,
  p_video_url         text,
  p_declared_role     text,
  p_text_version      text,
  p_client_authorized boolean,
  p_limit             integer,
  p_source_title      text,
  p_source_author     text,
  p_credits           jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_dup record;
  v_project_id uuid;
begin
  if p_declared_role is null
     or p_declared_role not in ('realisateur', 'producteur', 'ayant_droit', 'autre')
     or coalesce(btrim(p_text_version), '') = '' then
    return jsonb_build_object('ok', false, 'code', 'rights_declaration_required');
  end if;

  if p_category in ('publicite', 'clip') and not coalesce(p_client_authorized, false) then
    return jsonb_build_object('ok', false, 'code', 'client_authorization_required');
  end if;

  -- Serialise les publications d'un meme compte (le plafond ne se depasse pas
  -- par deux requetes simultanees).
  perform pg_advisory_xact_lock(hashtext('publish_project:' || p_profile_id::text));

  -- Le plafond ne compte que les films dont on est Responsable.
  if (select count(*) from public.projects where profile_id = p_profile_id) >= p_limit then
    return jsonb_build_object('ok', false, 'code', 'limit_reached');
  end if;

  v_key := public.extract_video_key(p_video_url);
  if v_key is not null then
    select p.id, p.slug, p.title,
           (p.status = 'approved' and p.is_published) as is_public
    into v_dup
    from public.projects p
    where p.video_key = v_key and p.status is distinct from 'refused'
    limit 1;
    if found then
      -- Titre et slug seulement si le film existant est public.
      return jsonb_build_object(
        'ok', false, 'code', 'duplicate',
        'project_id', v_dup.id,
        'is_public', v_dup.is_public,
        'slug',  case when v_dup.is_public then v_dup.slug end,
        'title', case when v_dup.is_public then v_dup.title end
      );
    end if;
  end if;

  begin
    insert into public.projects
      (profile_id, title, slug, description, category, year, video_url, video_key, status)
    values
      (p_profile_id, p_title, p_slug, nullif(btrim(p_description), ''), p_category, p_year,
       p_video_url, v_key, 'pending')
    returning id into v_project_id;
  exception when unique_violation then
    -- Course sur la cle video (ou slug) : l'index unique tranche.
    return jsonb_build_object('ok', false, 'code', 'duplicate');
  end;

  insert into public.project_rights_declarations
    (project_id, profile_id, declared_role, text_version, client_authorized)
  values
    (v_project_id, p_profile_id, p_declared_role, p_text_version, coalesce(p_client_authorized, false));

  insert into public.project_moderation (project_id, source_title, source_author)
  values (v_project_id, p_source_title, p_source_author);

  insert into public.project_credits (project_id, profile_id, ghost_name, role_on_project)
  select v_project_id,
         nullif(c->>'profile_id', '')::uuid,
         nullif(btrim(c->>'ghost_name'), ''),
         btrim(c->>'role')
  from jsonb_array_elements(coalesce(p_credits, '[]'::jsonb)) as c
  where coalesce(btrim(c->>'role'), '') <> ''
    and (nullif(c->>'profile_id', '') is not null or nullif(btrim(c->>'ghost_name'), '') is not null);

  return jsonb_build_object('ok', true, 'code', 'created', 'project_id', v_project_id);
end;
$$;

-- ---- F2. Inviter a co-gerer, ou demander a co-gerer --------------------------
-- p_target = p_actor : demande d'une personne creditee.
-- p_target <> p_actor : invitation du Responsable a une personne creditee.
create or replace function public.request_project_manager(
  p_actor   uuid,
  p_project uuid,
  p_target  uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_found boolean;
  v_kind text;
  v_id uuid;
begin
  select p.profile_id, true into v_owner, v_found
  from public.projects p where p.id = p_project;
  if not coalesce(v_found, false) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if p_target = p_actor then
    v_kind := 'request';
    if v_owner is null or v_owner = p_actor then
      return jsonb_build_object('ok', false, 'code', 'forbidden');
    end if;
  else
    v_kind := 'invite';
    if v_owner is distinct from p_actor then
      return jsonb_build_object('ok', false, 'code', 'forbidden');
    end if;
  end if;

  if not exists (
    select 1 from public.project_credits c
    where c.project_id = p_project and c.profile_id = p_target
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_credited');
  end if;

  if exists (
    select 1 from public.project_managers m
    where m.project_id = p_project and m.profile_id = p_target
  ) then
    return jsonb_build_object('ok', false, 'code', 'already_manager');
  end if;

  insert into public.project_manager_requests as req (project_id, profile_id, kind, created_by)
  values (p_project, p_target, v_kind, p_actor)
  on conflict (project_id, profile_id) do update
    set kind = excluded.kind, status = 'pending', created_by = excluded.created_by,
        created_at = now(), decided_at = null
    where req.status <> 'pending'
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', false, 'code', 'already_pending');
  end if;
  return jsonb_build_object('ok', true, 'code', 'created', 'request_id', v_id, 'kind', v_kind, 'owner_id', v_owner);
end;
$$;

-- ---- F3. Accepter ou refuser -------------------------------------------------
-- Une invitation est tranchee par la personne invitee, une demande par le Responsable.
create or replace function public.decide_project_manager(
  p_actor   uuid,
  p_request uuid,
  p_accept  boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.project_manager_requests%rowtype;
  v_owner uuid;
begin
  select * into r from public.project_manager_requests where id = p_request for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if r.status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'already_decided');
  end if;

  select p.profile_id into v_owner from public.projects p where p.id = r.project_id;

  if not (
    (r.kind = 'invite' and r.profile_id = p_actor)
    or (r.kind = 'request' and v_owner = p_actor)
  ) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if p_accept then
    -- La personne doit toujours etre creditee au moment de l'acceptation.
    if not exists (
      select 1 from public.project_credits c
      where c.project_id = r.project_id and c.profile_id = r.profile_id
    ) then
      return jsonb_build_object('ok', false, 'code', 'not_credited');
    end if;
    insert into public.project_managers (project_id, profile_id, added_by)
    values (r.project_id, r.profile_id, v_owner)
    on conflict do nothing;
  end if;

  update public.project_manager_requests
  set status = case when p_accept then 'accepted' else 'refused' end,
      decided_at = now()
  where id = p_request;

  return jsonb_build_object(
    'ok', true, 'code', case when p_accept then 'accepted' else 'refused' end,
    'project_id', r.project_id, 'profile_id', r.profile_id, 'owner_id', v_owner, 'kind', r.kind
  );
end;
$$;

-- ---- F4. Transferer un film ---------------------------------------------------
-- Responsable seul, vers un co-gestionnaire. L'ancien Responsable devient
-- co-gestionnaire. p_limit : plafond du plan du destinataire, lu par la route.
create or replace function public.transfer_project(
  p_actor     uuid,
  p_project   uuid,
  p_new_owner uuid,
  p_limit     integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select p.profile_id into v_owner from public.projects p where p.id = p_project for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_owner is distinct from p_actor or p_new_owner = p_actor then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if not exists (
    select 1 from public.project_managers m
    where m.project_id = p_project and m.profile_id = p_new_owner
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_manager');
  end if;

  perform pg_advisory_xact_lock(hashtext('publish_project:' || p_new_owner::text));
  if (select count(*) from public.projects where profile_id = p_new_owner) >= p_limit then
    return jsonb_build_object('ok', false, 'code', 'limit_reached');
  end if;

  update public.projects set profile_id = p_new_owner where id = p_project;
  delete from public.project_managers where project_id = p_project and profile_id = p_new_owner;
  insert into public.project_managers (project_id, profile_id, added_by)
  values (p_project, p_actor, p_new_owner)
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'code', 'transferred');
end;
$$;

revoke all on function public.publish_project(uuid, text, text, text, public.project_category, integer, text, text, text, boolean, integer, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.request_project_manager(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.decide_project_manager(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.transfer_project(uuid, uuid, uuid, integer) from public, anon, authenticated;

grant execute on function public.extract_video_key(text) to service_role;
grant execute on function public.publish_project(uuid, text, text, text, public.project_category, integer, text, text, text, boolean, integer, text, text, jsonb)
  to service_role;
grant execute on function public.request_project_manager(uuid, uuid, uuid) to service_role;
grant execute on function public.decide_project_manager(uuid, uuid, boolean) to service_role;
grant execute on function public.transfer_project(uuid, uuid, uuid, integer) to service_role;

commit;

-- =============================================================================
-- VERIFICATION APRES EXECUTION
-- =============================================================================
--   -- 1. Backfill video_key : films approuves restes sans cle, et pourquoi
--   select p.title, p.video_url,
--          public.extract_video_key(p.video_url) as cle_calculee,
--          (select string_agg(o.title, ' | ') from public.projects o
--           where o.id <> p.id
--             and (o.video_key = public.extract_video_key(p.video_url)
--                  or (o.video_key is null
--                      and public.extract_video_key(o.video_url) = public.extract_video_key(p.video_url)))
--          ) as en_conflit_avec
--   from public.projects p
--   where p.video_key is null and p.status = 'approved'
--   order by p.created_at;
--   -- cle_calculee NULL = URL non reconnue (ni YouTube ni Vimeo), normal.
--   -- en_conflit_avec non NULL = meme video que ce(s) film(s) : rien n'a ete ecrit.
--
--   -- 2. Policies attendues
--   select tablename, cmd, policyname from pg_policies
--   where schemaname = 'public'
--     and tablename in ('projects', 'project_credits', 'credit_requests', 'project_invitations',
--                       'invitations', 'project_managers', 'project_rights_declarations',
--                       'project_manager_requests', 'project_claims', 'project_moderation')
--   order by 1, 2, 3;
--     projects                    : 2 SELECT, 1 UPDATE, 1 DELETE (plus d'INSERT)
--     project_credits             : 1 SELECT, 1 INSERT, 1 UPDATE, 1 DELETE
--     credit_requests             : 2 SELECT, 1 INSERT, 1 UPDATE
--     project_invitations         : 1 SELECT, 1 INSERT, 1 UPDATE, 1 DELETE
--     invitations                 : 1 SELECT, 1 INSERT, 1 DELETE
--     project_managers            : 1 SELECT, 1 DELETE
--     project_rights_declarations : 1 SELECT, 1 INSERT
--     project_manager_requests    : 1 SELECT
--     project_claims              : 1 SELECT
--     project_moderation          : aucune
--
--   -- 3. Privileges : anon ne doit plus avoir que SELECT (+ REFERENCES, TRIGGER)
--   select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type)
--   from information_schema.role_table_grants
--   where table_schema = 'public' and grantee in ('anon', 'authenticated')
--     and table_name in ('projects', 'project_credits', 'credit_requests', 'project_invitations',
--                        'invitations', 'reports', 'admin_logs', 'project_managers',
--                        'project_rights_declarations', 'project_manager_requests',
--                        'project_claims', 'project_moderation')
--   group by 1, 2 order by 1, 2;
--
--   -- 4. TEST DU TRIGGER EN ROLE authenticated (rien n'est conserve : rollback)
--   --    Remplacer <FILM> par l'id d'un film approuve et <RESP> par l'id de son
--   --    Responsable.
--   begin;
--     set local role authenticated;
--     select set_config('request.jwt.claims',
--       json_build_object('sub', '<RESP>', 'role', 'authenticated')::text, true);
--
--     -- a. Colonne non accordee : doit echouer (permission denied for table projects)
--     --    update public.projects set status = 'refused' where id = '<FILM>';
--
--     -- b. Contenu sans declaration de droits : doit lever rights_declaration_required
--     --    update public.projects set title = title || ' (test)' where id = '<FILM>';
--
--     -- c. Depublication par le Responsable : doit passer
--     update public.projects set is_published = false where id = '<FILM>';
--     select id, is_published, status from public.projects where id = '<FILM>';
--   rollback;
--   --    Lancer a, b et c un par un (une erreur interrompt la transaction).
--   --    Refaire c avec l'id d'un autre membre dans 'sub' : 0 ligne modifiee
--   --    (il n'est pas gestionnaire). Avec un co-gestionnaire : owner_only.
--
--   -- 5. Parcours a tester dans l'app apres deploiement des lots 2 et 3 :
--   --    publier un film (declaration obligatoire), doublon, modifier un film,
--   --    inviter un co-gestionnaire, depublier, admin : approuver / refuser.
-- =============================================================================
