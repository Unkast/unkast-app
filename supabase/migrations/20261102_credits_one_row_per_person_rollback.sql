-- =============================================================================
-- ROLLBACK de 20261102_credits_one_row_per_person.sql
-- =============================================================================
-- Remet l'index project_credits_one_role_per_person et publish_project de
-- 20261009_film_limit_and_edit_watch.sql.
--
-- NE REDEFAIT PAS les donnees : les lignes fusionnees ne sont pas recreees et
-- « Acteur » reste « Comedien ». Elles restent valides pour l'ancien index (une
-- ligne par personne a un seul role compte pour lui). A executer seulement si le
-- code correspondant (lib/credits.ts, routes de credits) est aussi retire : l'ancien
-- code accepterait de nouveau plusieurs lignes par personne.
-- =============================================================================

begin;

drop index if exists public.project_credits_one_row_per_person;

create unique index if not exists project_credits_one_role_per_person
  on public.project_credits (project_id, profile_id, lower(btrim(role_on_project)))
  where profile_id is not null;

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

commit;

-- Verification :
--   select indexname from pg_indexes where schemaname = 'public'
--   and tablename = 'project_credits' and indexname like 'project_credits_one_%';
--   -> project_credits_one_role_per_person seulement
