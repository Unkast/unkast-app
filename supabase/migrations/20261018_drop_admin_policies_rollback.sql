-- Rollback de 20261018_drop_admin_policies.sql. A executer a la main.
--
-- Les definitions d'origine ne sont pas versionnees dans le depot : elles sont
-- reconstruites par le BLOC 0 de la migration, a executer AVANT la suppression.
-- Colle ci-dessous les trois lignes `rollback_sql` qu'il renvoie, entre begin et commit.
--
-- Si le bloc 0 n'a pas ete execute a temps, la forme ci-dessous est la forme
-- habituelle de ces policies. Elle est donnee a titre indicatif, PAS relue en base :
--
--   create policy "Admins manage reports" on public.reports as permissive for all to public
--     using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
--   create policy "Admins manage waitlist" on public.waitlist as permissive for all to public
--     using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
--   create policy "Admins only" on public.admin_logs as permissive for all to public
--     using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
--
-- A noter : depuis la migration 20260731, is_admin n'est plus lisible par
-- anon/authenticated. Une policy de cette forme echoue donc probablement a
-- l'evaluation (permission denied sur la colonne) au lieu d'ouvrir l'acces. Les
-- remettre n'apporte rien au code, qui passe par le service role.

begin;

-- << coller ici le resultat du BLOC 0 >>

commit;
