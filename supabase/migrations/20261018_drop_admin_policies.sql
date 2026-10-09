-- =============================================================================
-- 20261018_drop_admin_policies.sql — Lot 9 : retrait des policies basees sur is_admin
-- =============================================================================
-- A EXECUTER A LA MAIN dans le SQL Editor, bloc par bloc, dans l'ordre.
--
-- POURQUOI
-- Trois policies donnent un acces direct (PostgREST, cle anon + session) a tout
-- compte is_admin, sans mot de passe ni double authentification :
--   public.reports     "Admins manage reports"
--   public.waitlist    "Admins manage waitlist"
--   public.admin_logs  "Admins only"
-- Le code ne s'en sert pas : reports, waitlist et admin_logs ne sont lus et ecrits
-- que par le service role (api/admin, api/reports, api/waitlist, lib/contact-flag.ts),
-- que la RLS ne concerne pas. Aucune lecture directe par le navigateur. Verifie le
-- 09/10/2026 par recherche de from("reports" | "waitlist" | "admin_logs") dans src/.
-- Elles sont donc supprimees plutot que durcies (aal2) : la seule porte admin reste
-- /api/admin, gardee par getAdminId() (is_admin + mot de passe + MFA).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- BLOC 0 — AVANT : generer le rollback exact (lecture seule)
-- -----------------------------------------------------------------------------
-- Les definitions de ces policies ne sont pas versionnees dans le depot. Cette
-- requete les reconstruit telles qu'elles sont en base. Copie la colonne
-- `rollback_sql` dans 20261018_drop_admin_policies_rollback.sql AVANT le bloc 1.
select format(
  'create policy %I on %I.%I as %s for %s to %s%s%s;',
  policyname, schemaname, tablename, permissive, cmd,
  array_to_string(roles, ', '),
  case when qual is not null then ' using (' || qual || ')' else '' end,
  case when with_check is not null then ' with check (' || with_check || ')' else '' end
) as rollback_sql
from pg_policies
where schemaname = 'public'
  and (tablename, policyname) in (
    ('reports', 'Admins manage reports'),
    ('waitlist', 'Admins manage waitlist'),
    ('admin_logs', 'Admins only')
  );


-- -----------------------------------------------------------------------------
-- BLOC 1 — Suppression
-- -----------------------------------------------------------------------------
begin;

drop policy if exists "Admins manage reports" on public.reports;
drop policy if exists "Admins manage waitlist" on public.waitlist;
drop policy if exists "Admins only" on public.admin_logs;

-- La RLS doit rester active : sans policy, une table RLS est fermee aux clients ;
-- sans RLS, elle serait ouverte a hauteur de ses GRANT.
alter table public.reports enable row level security;
alter table public.waitlist enable row level security;
alter table public.admin_logs enable row level security;

commit;


-- -----------------------------------------------------------------------------
-- BLOC 2 — Controles (lecture seule)
-- -----------------------------------------------------------------------------

-- 2a. RLS active sur les trois tables. Attendu : rls = true partout.
select relname as table_name, relrowsecurity as rls
from pg_class
where relnamespace = 'public'::regnamespace and relname in ('reports', 'waitlist', 'admin_logs');

-- 2b. Policies restantes sur ces tables. Attendu : aucune qui cite is_admin. S'il en
--     reste d'autres (ex. un INSERT ouvert), envoie-les : le code n'en a pas besoin
--     non plus, mais elles sont a examiner une par une.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('reports', 'waitlist', 'admin_logs')
order by tablename, policyname;

-- 2c. Plus aucune policy ne s'appuie sur is_admin dans toute la base. Attendu : 0 ligne.
select schemaname, tablename, policyname
from pg_policies
where coalesce(qual, '') ilike '%is_admin%' or coalesce(with_check, '') ilike '%is_admin%';
