-- Rollback de 20261019_drop_unused_client_policies.sql. A executer a la main.
-- Definitions relevees en production le 09/10/2026 avant suppression. Le role n'a pas
-- ete releve : `to public` est la valeur par defaut d'une policy creee sans clause TO.
begin;

create policy "Users can create reports" on public.reports
  as permissive for insert to public
  with check (auth.uid() = reporter_id);

create policy "Users see own reports" on public.reports
  as permissive for select to public
  using (auth.uid() = reporter_id);

create policy "Anyone can join waitlist" on public.waitlist
  as permissive for insert to public
  with check (true);

commit;
