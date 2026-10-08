-- =============================================================================
-- ROLLBACK de 20261009_film_limit_and_edit_watch.sql
-- =============================================================================
--
-- Remet publish_project, transfer_project et guard_projects_columns tels que
-- dans 20261008_film_management.sql, supprime project_slots_used et la colonne
-- approved_title.
--
-- A lancer APRES avoir remis en ligne le code d'avant ce lot : le code de ce lot
-- passe p_limit NULL pour un compte Pro, ce que l'ancienne publish_project
-- traite comme « aucun plafond » de fait (comparaison a NULL), sans erreur.
-- CE QUI EST PERDU : les titres valides (approved_title).
-- =============================================================================

begin;

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

drop function if exists public.project_slots_used(uuid);

alter table public.project_moderation drop column if exists approved_title;

commit;
