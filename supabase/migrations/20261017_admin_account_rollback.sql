-- Rollback de 20261017_admin_account.sql. A executer a la main.
-- Ne supprime pas la ligne profiles du compte admin : le journal admin y est rattache.
-- Tant qu'elle existe avec account_type = 'admin', la contrainte d'origine ne peut pas
-- etre remise ; repasser d'abord le compte en 'talent' si c'est voulu.
begin;

drop trigger if exists reject_admin_account on public.project_credits;
drop trigger if exists reject_admin_account on public.conversations;
drop function if exists public.reject_admin_account();
drop policy if exists "Admin accounts are private" on public.profiles;

commit;
