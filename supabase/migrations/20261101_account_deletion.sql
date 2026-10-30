-- =============================================================================
-- Suppression de compte par le membre (bouton « Supprimer mon compte »)
-- =============================================================================
--
-- DECISIONS PRODUIT (Maxime, 30/10/2026)
--   1. Les films dont le membre est Responsable et le seul credite sont
--      supprimes avec le compte. Les autres restent : ils passent au
--      co-gestionnaire le plus ancien, sinon ils restent depublies sans
--      Responsable (comportement existant).
--   3. Les signalements deposes par le membre sont gardes, sans auteur.
--   Credits du membre sur les films des autres : gardes sous son nom affiche.
--
-- CE QU'IL FAIT
--   A. keep_credit_name_on_profile_delete : le nom fige dans ghost_name est le
--      nom affiche (display_name, colonne generee de 20261014), puis full_name,
--      puis « Compte supprime ». Avant : stage_name des qu'il etait rempli, meme
--      si la personne affichait son vrai nom.
--   B. Fonction solo_projects_of(profil) : films dont le profil est Responsable,
--      sans aucun autre credit (un credit sans compte, ghost_name, compte comme
--      une autre personne) et sans autre co-gestionnaire. Une seule definition,
--      lue par le trigger ET par la route serveur. La route en a besoin AVANT la
--      suppression pour savoir quels dossiers vider dans le Storage
--      (posters/<film>/ et claims/<film>/) : la base ne peut pas effacer ces
--      fichiers elle-meme.
--   C. transfer_projects_on_profile_delete : supprime d'abord ces films (les
--      credits, invitations, demandes, revendications, declarations de droits
--      et donnees de moderation partent en cascade), puis applique la regle
--      existante aux films restants. Tout se passe dans la meme transaction que
--      la suppression du compte : si elle echoue, aucun film n'est supprime.
--   D. reports.reporter_id : ON DELETE CASCADE devient ON DELETE SET NULL.
--      La colonne est deja nullable (20261008, NULL = signalement automatique).
--      La table reports n'est pas versionnee : la cle est retrouvee par sa
--      colonne, quel que soit son nom en prod (releve du 10/10/2026 :
--      reports_reporter_id_fkey), puis recreee sous ce nom.
--
-- CE QU'IL NE FAIT PAS
--   - Aucune table, colonne ou donnee existante modifiee.
--   - Aucun fichier du Storage touche (fait par la route, apres la suppression).
--   - Les triggers BEFORE DELETE sur profiles s'executent par ordre alphabetique
--     (keep_credit_name..., puis transfer_projects...). Le resultat ne depend pas
--     de cet ordre : solo_projects_of lit profile_id, pas ghost_name.
--
-- Idempotent (create or replace, recherche de la cle avant suppression).
-- Rollback : 20261101_account_deletion_rollback.sql
--
-- =============================================================================
-- VERIFICATION AVANT EXECUTION (lecture seule)
-- =============================================================================
--   -- 1. Cle(s) etrangere(s) de reports.reporter_id et leur action ON DELETE
--   --    (c = CASCADE attendu avant, n = SET NULL attendu apres)
--   select con.conname, con.confrelid::regclass as cible, con.confdeltype
--   from pg_constraint con
--   join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
--   where con.contype = 'f'
--     and con.conrelid = 'public.reports'::regclass
--     and a.attname = 'reporter_id';
--   --    Attendu : une ligne, cible public.profiles. Si la cible est auth.users,
--   --    ne pas executer : me le signaler.
--
--   -- 2. Les deux triggers BEFORE DELETE de profiles sont bien en place
--   select tgname from pg_trigger
--   where tgrelid = 'public.profiles'::regclass and not tgisinternal
--   order by tgname;
--
--   -- 3. Aucune cle vers profiles ou projects en NO ACTION / RESTRICT
--   --    (sinon une suppression de compte ou de film peut echouer)
--   select conrelid::regclass as table_source, conname, confrelid::regclass as cible, confdeltype
--   from pg_constraint
--   where contype = 'f'
--     and confrelid in ('public.profiles'::regclass, 'public.projects'::regclass)
--     and confdeltype in ('a', 'r')
--   order by 1, 2;
--   --    Attendu : aucune ligne.
-- =============================================================================

begin;

-- ---- A. Nom fige dans le generique ------------------------------------------
create or replace function public.keep_credit_name_on_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.project_credits
  set ghost_name = coalesce(
    nullif(btrim(old.display_name), ''),
    nullif(btrim(old.full_name), ''),
    'Compte supprimé'
  )
  where profile_id = old.id
    and ghost_name is null;
  return old;
end;
$$;

revoke all on function public.keep_credit_name_on_profile_delete() from public, anon, authenticated;

-- ---- B. Films dont le membre est le seul credite ----------------------------
create or replace function public.solo_projects_of(p_profile_id uuid)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select p.id
  from public.projects p
  where p.profile_id = p_profile_id
    and not exists (
      select 1 from public.project_credits c
      where c.project_id = p.id
        and c.profile_id is distinct from p_profile_id
    )
    and not exists (
      select 1 from public.project_managers m
      where m.project_id = p.id
        and m.profile_id <> p_profile_id
    );
$$;

revoke all on function public.solo_projects_of(uuid) from public, anon, authenticated;
grant execute on function public.solo_projects_of(uuid) to service_role;

-- ---- C. Films du compte supprime --------------------------------------------
-- BEFORE DELETE : s'execute avant le SET NULL de projects.profile_id.
-- 1. Films dont il est le seul credite : supprimes.
-- 2. Les autres : transfert au co-gestionnaire le plus ancien ; sinon le film
--    est depublie et reste sans Responsable (liste dans l'admin).
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
  delete from public.projects
  where id in (select public.solo_projects_of(old.id));

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
-- Le trigger existant (20261008) appelle deja cette fonction : rien a recreer.

-- ---- D. Signalements gardes sans auteur -------------------------------------
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
    where con.contype = 'f'
      and con.conrelid = 'public.reports'::regclass
      and con.confrelid = 'public.profiles'::regclass
      and a.attname = 'reporter_id'
  loop
    execute format('alter table public.reports drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.reports
  add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles(id) on delete set null;

commit;

-- =============================================================================
-- VERIFICATION APRES EXECUTION
-- =============================================================================
--   -- Cle de reports.reporter_id : une ligne, confdeltype = 'n'
--   select conname, confdeltype from pg_constraint
--   where conrelid = 'public.reports'::regclass and conname = 'reports_reporter_id_fkey';
--
--   -- Fonction presente et reservee au service role
--   select has_function_privilege('authenticated', 'public.solo_projects_of(uuid)', 'execute') as authenticated_ok,
--          has_function_privilege('service_role',  'public.solo_projects_of(uuid)', 'execute') as service_role_ok;
--   --   Attendu : false, true.
--
-- =============================================================================
-- TEST SANS EFFET SUR UN COMPTE DE TEST (transaction annulee)
-- =============================================================================
-- Remplacer <uuid> par l'id du compte de test (jamais un vrai membre, jamais
-- l'admin). Lancer le bloc en entier, d'un coup : le ROLLBACK final annule tout.
--
--   -- 0. Etat avant (hors transaction)
--   select id, slug, display_name from public.profiles where id = '<uuid>';
--   select p.id, p.title, p.visibility,
--          p.id in (select public.solo_projects_of('<uuid>')) as sera_supprime
--   from public.projects p where p.profile_id = '<uuid>';
--
--   begin;
--
--   create temp table t_films on commit drop as
--     select p.id, p.title,
--            p.id in (select public.solo_projects_of('<uuid>')) as solo
--     from public.projects p where p.profile_id = '<uuid>';
--   create temp table t_credits on commit drop as
--     select id from public.project_credits where profile_id = '<uuid>';
--   create temp table t_reports on commit drop as
--     select id from public.reports where reporter_id = '<uuid>';
--
--   delete from auth.users where id = '<uuid>';          -- ne doit pas echouer
--
--   -- a. Films : solo = true -> absents ; solo = false -> Responsable change
--   --    (co-gestionnaire) ou profile_id NULL et visibility = 'unpublished'
--   select f.title, f.solo, p.id is not null as existe_encore, p.profile_id, p.visibility
--   from t_films f left join public.projects p on p.id = f.id;
--
--   -- b. Ses credits sur les films des autres : profile_id NULL, ghost_name =
--   --    son nom affiche. Ceux sur ses films supprimes : absents.
--   select c.id, c.profile_id, c.ghost_name, c.role_on_project
--   from public.project_credits c where c.id in (select id from t_credits);
--
--   -- c. Signalements deposes : toujours la, reporter_id NULL
--   select r.id, r.reporter_id, r.status
--   from public.reports r where r.id in (select id from t_reports);
--
--   -- d. Profil absent
--   select count(*) as profil_restant from public.profiles where id = '<uuid>';  -- 0
--
--   rollback;                                             -- OBLIGATOIRE
-- =============================================================================
