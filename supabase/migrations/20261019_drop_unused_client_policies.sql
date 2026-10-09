-- =============================================================================
-- 20261019_drop_unused_client_policies.sql — reports et waitlist fermees aux clients
-- =============================================================================
-- A EXECUTER A LA MAIN dans le SQL Editor.
--
-- POURQUOI
-- Trois policies ouvrent un acces direct (PostgREST, cle anon) que le code n'utilise pas :
--   reports  "Users can create reports"  INSERT, with check (auth.uid() = reporter_id)
--   reports  "Users see own reports"     SELECT, using (auth.uid() = reporter_id)
--   waitlist "Anyone can join waitlist"  INSERT, with check (true)
-- Toutes les lectures et ecritures de ces tables passent par le service role
-- (api/reports, api/waitlist, api/admin, lib/contact-flag.ts). Un INSERT direct
-- contourne les controles de ces routes (compte actif, validation, limites) :
-- "with check (true)" laisse n'importe qui remplir la liste d'attente sans limite.
-- Apres cette migration, reports, waitlist et admin_logs n'ont plus aucune policy :
-- RLS active, donc fermees a anon et authenticated.
-- =============================================================================

begin;

drop policy if exists "Users can create reports" on public.reports;
drop policy if exists "Users see own reports" on public.reports;
drop policy if exists "Anyone can join waitlist" on public.waitlist;

commit;

-- Controle (lecture seule). Attendu : 0 ligne, et rls = true sur les trois tables.
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename in ('reports', 'waitlist', 'admin_logs');

select relname as table_name, relrowsecurity as rls from pg_class
where relnamespace = 'public'::regnamespace and relname in ('reports', 'waitlist', 'admin_logs');
