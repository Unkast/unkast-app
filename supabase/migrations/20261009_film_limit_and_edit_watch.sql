-- =============================================================================
-- Corrections beta : plafond de films, suivi des modifications a surveiller
-- =============================================================================
--
-- POURQUOI CE FICHIER (decisions de Maxime, 08/10/2026)
-- S'applique APRES 20261008_film_management.sql, deja executee en production.
--
-- CE QU'IL FAIT
--   A. Plafond de films. Ne comptent plus que les films dont on est Responsable
--      et qui sont en ligne (approuves, publics ou membres seulement) ou en
--      attente de validation. Les films refuses et depublies ne comptent pas.
--      Nouvelle fonction project_slots_used ; publish_project et
--      transfer_project l'utilisent, et acceptent p_limit NULL (Pro = illimite).
--   B. Remise en ligne d'un film depublie : refusee si le compte gratuit est au
--      plafond (trigger guard_projects_columns, erreur limit_reached). Depublier
--      un film pour en publier un autre reste possible : le nouveau film passe
--      par la validation.
--   C. Suivi des modifications : colonne project_moderation.approved_title, le
--      titre valide par l'admin. La liste « modifies recemment » de l'admin ne
--      garde que les films dont le titre s'en ecarte nettement, ou qui sont
--      signales. Le calcul se fait dans la route (src/app/api/admin/route.ts) ;
--      cette migration ne fait que memoriser le titre.
--
-- CE QU'IL NE FAIT PAS
--   - Le lien video reste non modifiable : c'est deja le cas (colonne hors du
--     GRANT UPDATE, restauree par guard_projects_columns). Rien a changer.
--   - Les noms reels restent lisibles en base (colonnes full_name, first_name,
--     last_name de profiles) : fermeture prevue dans un lot separe.
--
-- ORDRE DE MISE EN SERVICE
-- A executer JUSTE AVANT de deployer le code correspondant. L'ancien code reste
-- compatible avec cette migration (il passe un p_limit non NULL).
--
-- Rollback : 20261009_film_limit_and_edit_watch_rollback.sql
-- =============================================================================

begin;

-- ---- A. Places occupees dans le plafond --------------------------------------
-- SECURITY INVOKER : appelee par publish_project / transfer_project (qui voient
-- tout) et par le trigger de garde, ou le Responsable lit ses propres films.
create or replace function public.project_slots_used(p_profile_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.projects p
  where p.profile_id = p_profile_id
    and (p.status = 'pending'
         or (p.status = 'approved' and p.visibility in ('public', 'members')));
$$;

revoke all on function public.project_slots_used(uuid) from public, anon;
grant execute on function public.project_slots_used(uuid) to authenticated, service_role;

-- Memes signatures : les privileges existants (service role uniquement) sont conserves.
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

  -- Plafond : films dont on est Responsable, en ligne ou en attente de
  -- validation (project_slots_used). p_limit NULL = illimite (Pro).
  if p_limit is not null and public.project_slots_used(p_profile_id) >= p_limit then
    return jsonb_build_object('ok', false, 'code', 'limit_reached');
  end if;

  v_key := public.extract_video_key(p_video_url);
  if v_key is not null then
    select p.id, p.slug, p.title,
           (p.status = 'approved' and p.visibility in ('public', 'members')) as is_visible
    into v_dup
    from public.projects p
    where p.video_key = v_key and p.status is distinct from 'refused'
    limit 1;
    if found then
      -- Titre et slug seulement si le film existant est visible par un membre
      -- (public ou membres seulement) : celui qui publie est connecte.
      return jsonb_build_object(
        'ok', false, 'code', 'duplicate',
        'project_id', v_dup.id,
        'is_visible', v_dup.is_visible,
        'slug',  case when v_dup.is_visible then v_dup.slug end,
        'title', case when v_dup.is_visible then v_dup.title end
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
  -- Le film transfere ne prend une place chez le destinataire que s'il en occupe
  -- une (en ligne ou en attente). p_limit NULL = illimite (Pro).
  if p_limit is not null
     and exists (
       select 1 from public.projects p
       where p.id = p_project
         and (p.status = 'pending'
              or (p.status = 'approved' and p.visibility in ('public', 'members')))
     )
     and public.project_slots_used(p_new_owner) >= p_limit then
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

-- ---- B. Garde des colonnes de projects : remise en ligne ----------------------
-- Fonction reprise a l'identique de 20261008_film_management.sql, plus le bloc
-- « Remise en ligne d'un film depublie ». Le trigger existant continue de l'appeler.
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

  -- Visibilite (public / membres / depublie) : Responsable seul.
  if new.visibility is distinct from old.visibility
     and old.profile_id is distinct from auth.uid() then
    raise exception 'owner_only' using errcode = '42501';
  end if;

  -- Remise en ligne d'un film depublie : il reprend une place dans le plafond.
  -- Sans ce controle, on depublierait un film pour en publier un autre, puis on
  -- remettrait le premier en ligne sans passer par la validation. Compte gratuit
  -- uniquement (Pro = illimite). Le 3 est MAX_PROJECTS_FREE de src/lib/constants.ts.
  if old.status = 'approved'
     and old.visibility = 'unpublished'
     and new.visibility in ('public', 'members')
     and coalesce((select pr.plan from public.profiles pr where pr.id = old.profile_id), 'free') <> 'pro'
     and public.project_slots_used(old.profile_id) >= 3 then
    raise exception 'limit_reached' using errcode = 'P0001';
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

  -- Passage en publicite ou en clip apres la publication : l'accord du client ou
  -- du label doit avoir ete declare par le Responsable (case cochee dans une
  -- declaration). Sans cela, il suffirait de publier dans une autre categorie
  -- puis d'en changer. Un co-gestionnaire ne peut pas declarer a sa place.
  if new.category in ('publicite', 'clip')
     and old.category not in ('publicite', 'clip')
     and not exists (
       select 1 from public.project_rights_declarations d
       where d.project_id = old.id
         and d.profile_id = old.profile_id
         and d.client_authorized
     ) then
    raise exception 'client_authorization_required' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- ---- C. Titre valide par l'admin ----------------------------------------------
alter table public.project_moderation add column if not exists approved_title text;

-- Films deja approuves : le titre actuel est tenu pour le titre valide.
insert into public.project_moderation (project_id, approved_title)
select p.id, p.title from public.projects p where p.status = 'approved'
on conflict (project_id) do update
  set approved_title = excluded.approved_title
  where public.project_moderation.approved_title is null;

commit;

-- =============================================================================
-- VERIFICATION APRES EXECUTION (lecture seule)
-- =============================================================================
--   -- 1. Places occupees par compte (doit correspondre a la jauge de /moi)
--   select pr.full_name, pr.plan, public.project_slots_used(pr.id) as places,
--          (select count(*) from public.projects p where p.profile_id = pr.id) as films
--   from public.profiles pr
--   where exists (select 1 from public.projects p where p.profile_id = pr.id)
--   order by 3 desc;
--
--   -- 2. Tout film approuve a un titre valide (doit renvoyer 0)
--   select count(*) from public.projects p
--   left join public.project_moderation m on m.project_id = p.id
--   where p.status = 'approved' and m.approved_title is null;
-- =============================================================================
