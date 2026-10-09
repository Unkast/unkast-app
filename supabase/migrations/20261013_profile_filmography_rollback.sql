-- =============================================================================
-- ROLLBACK de 20261013_profile_filmography.sql
-- =============================================================================
--
-- Remet les deux fonctions dans leur etat d'avant :
--   - public_profile_film_roles : seulement les films publics dont la personne
--     est Responsable (etat de 20261008_film_management.sql) ;
--   - member_only_film_teasers : cinq colonnes, films dont la personne est
--     Responsable (etat de 20261010_film_poster_and_member_teasers.sql).
-- Aucune donnee n'est touchee.
--
-- A lancer APRES avoir remis en ligne le code d'avant ce lot.
-- =============================================================================

begin;

create or replace function public.public_profile_film_roles(p_profile_id uuid)
returns table (
  credit_id       uuid,
  project_id      uuid,
  role_on_project text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.project_id, c.role_on_project
  from public.project_credits c
  join public.projects p on p.id = c.project_id
  where c.profile_id = p_profile_id
    and p.profile_id = p_profile_id
    and public.is_project_public(c.project_id);
$$;

revoke all on function public.public_profile_film_roles(uuid) from public;
grant execute on function public.public_profile_film_roles(uuid) to anon, authenticated, service_role;

drop function if exists public.member_only_film_teasers(text, uuid);

create function public.member_only_film_teasers(
  p_slug       text default null,
  p_profile_id uuid default null
)
returns table (
  id         uuid,
  slug       text,
  title      text,
  poster_url text,
  year       integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.slug, p.title, p.poster_url, p.year
  from public.projects p
  join public.profiles pr on pr.id = p.profile_id
  where p.status = 'approved'
    and p.visibility = 'members'
    and pr.status = 'approved'
    and pr.is_suspended is not true
    and (p_slug is not null or p_profile_id is not null)
    and (p_slug is null or p.slug = p_slug)
    and (p_profile_id is null or p.profile_id = p_profile_id);
$$;

revoke all on function public.member_only_film_teasers(text, uuid) from public;
grant execute on function public.member_only_film_teasers(text, uuid) to anon, authenticated, service_role;

commit;
