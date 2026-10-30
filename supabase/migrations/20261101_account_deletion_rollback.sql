-- =============================================================================
-- ROLLBACK de 20261101_account_deletion.sql
-- =============================================================================
-- Remet :
--   A. keep_credit_name_on_profile_delete tel qu'en 20260924 (stage_name, puis full_name)
--   C. transfer_projects_on_profile_delete tel qu'en 20261008 (aucun film supprime)
--   B. supprime solo_projects_of (apres C, qui ne l'appelle plus)
--   D. reports.reporter_id en ON DELETE CASCADE
-- Les signalements dont reporter_id est deja NULL restent valides (colonne nullable).
-- A executer seulement si la route de suppression de compte n'est pas en production
-- ou est retiree : elle appelle solo_projects_of.
-- =============================================================================

begin;

-- ---- A ----------------------------------------------------------------------
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

-- ---- C ----------------------------------------------------------------------
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
      update public.projects set visibility = 'unpublished' where id = r.id;
    end if;
  end loop;
  return old;
end;
$$;

revoke all on function public.transfer_projects_on_profile_delete() from public, anon, authenticated;

-- ---- B ----------------------------------------------------------------------
drop function if exists public.solo_projects_of(uuid);

-- ---- D ----------------------------------------------------------------------
alter table public.reports drop constraint if exists reports_reporter_id_fkey;
alter table public.reports
  add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles(id) on delete cascade;

commit;

-- Verification : confdeltype = 'c'
--   select conname, confdeltype from pg_constraint
--   where conrelid = 'public.reports'::regclass and conname = 'reports_reporter_id_fkey';
