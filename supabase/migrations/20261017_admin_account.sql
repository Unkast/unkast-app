-- =============================================================================
-- 20261017_admin_account.sql — Lot 9 : compte admin dedie
-- =============================================================================
-- A EXECUTER A LA MAIN dans le SQL Editor, bloc par bloc, dans l'ordre.
--
-- AVANT : creer l'utilisateur dans le dashboard Supabase
--   Authentication > Users > Add user > Create new user
--   email admin@unkast.com, mot de passe fort, "Auto Confirm User" coche.
--
-- CE QUE FAIT CETTE MIGRATION
--   1. account_type accepte la valeur 'admin', et la ligne profiles du compte est
--      creee (is_admin = true, account_type = 'admin'). La ligne est necessaire :
--      admin_logs.admin_id, reports.reviewed_by et profiles.pro_grant_granted_by
--      pointent vers profiles(id).
--   2. Le compte n'a aucune existence publique : policy RESTRICTIVE de lecture
--      (personne d'autre que lui ne lit sa ligne), et deux triggers qui refusent de
--      le mettre dans une conversation ou dans un generique.
--   3. Requetes de controle.
--
-- Les droits admin eux-memes ne changent pas de source : profiles.is_admin. Le code
-- exige en plus une session par mot de passe et la double authentification
-- (lib/adminGuard.ts). account_type = 'admin' ne donne AUCUN droit : il retire le
-- profil public et les ecritures.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- BLOC 1 — Creation du profil admin
-- -----------------------------------------------------------------------------
begin;

alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles add constraint profiles_account_type_check
  check (account_type in ('talent', 'creator', 'recruiter', 'admin'));

-- Echoue volontairement (0 ligne inseree => exception) si l'utilisateur n'existe pas.
do $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where email = 'admin@unkast.com';
  if v_id is null then
    raise exception 'Utilisateur admin@unkast.com introuvable : cree-le d''abord dans Authentication > Users.';
  end if;

  insert into public.profiles (id, full_name, slug, status, account_type, is_admin)
  values (v_id, 'Admin Unkast', 'admin-' || left(v_id::text, 8), 'approved', 'admin', true)
  on conflict (id) do update set account_type = 'admin', is_admin = true;
end $$;

commit;


-- -----------------------------------------------------------------------------
-- BLOC 2 — Aucun profil public, aucune presence dans les messages ni les generiques
-- -----------------------------------------------------------------------------
begin;

-- RESTRICTIVE : s'ajoute (ET logique) aux policies de lecture existantes, sans les
-- remplacer. Un compte admin n'est lisible que par lui-meme. Le service role
-- (routes serveur de confiance) n'est pas concerne par la RLS.
drop policy if exists "Admin accounts are private" on public.profiles;
create policy "Admin accounts are private" on public.profiles
  as restrictive
  for select
  to anon, authenticated
  using (account_type is distinct from 'admin' or id = (select auth.uid()));

-- Filet cote base : meme en connaissant son identifiant, personne ne peut ouvrir une
-- conversation avec un compte admin ni le crediter sur un film. Ces ecritures passent
-- par le service role, que la RLS n'arrete pas : d'ou des triggers.
create or replace function public.reject_admin_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  if tg_table_name = 'conversations' then
    v_ids := array[new.participant_1, new.participant_2];
  else
    v_ids := array[new.profile_id];
  end if;

  if exists (select 1 from public.profiles p where p.id = any (v_ids) and p.account_type = 'admin') then
    raise exception 'Un compte admin ne peut pas figurer dans %', tg_table_name using errcode = '23514';
  end if;
  return new;
end $$;

revoke all on function public.reject_admin_account() from public, anon, authenticated;

drop trigger if exists reject_admin_account on public.conversations;
create trigger reject_admin_account
  before insert or update of participant_1, participant_2 on public.conversations
  for each row execute function public.reject_admin_account();

drop trigger if exists reject_admin_account on public.project_credits;
create trigger reject_admin_account
  before insert or update of profile_id on public.project_credits
  for each row execute function public.reject_admin_account();

commit;


-- -----------------------------------------------------------------------------
-- BLOC 3 — Controles (lecture seule)
-- -----------------------------------------------------------------------------

-- 3a. Qui a les droits admin. Attendu a ce stade : ton compte actuel ET Admin Unkast.
--     Toute autre ligne est un compte admin que tu ne connais pas.
select p.id, u.email, p.full_name, p.account_type, p.created_at
from public.profiles p
join auth.users u on u.id = p.id
where p.is_admin = true;

-- 3b. Policies de lecture de profiles. Attendu : "Admin accounts are private" presente,
--     permissive = RESTRICTIVE, roles {anon,authenticated}.
select policyname, permissive, cmd, roles, qual
from pg_policies
where schemaname = 'public' and tablename = 'profiles'
order by cmd, policyname;

-- 3c. Rien d'autre en base ne donne de droit a partir de is_admin. Attendu : aucune
--     policy, et pour seule fonction guard_profiles_system_columns (elle PROTEGE la
--     colonne en restaurant sa valeur). Toute autre ligne est a examiner.
select 'policy' as type, schemaname || '.' || tablename as objet, policyname as nom
from pg_policies
where coalesce(qual, '') ilike '%is_admin%' or coalesce(with_check, '') ilike '%is_admin%'
union all
select 'fonction', n.nspname, p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'auth') and p.prosrc ilike '%is_admin%';

-- 3d. Un client ne peut ni lire ni ecrire is_admin et account_type. Attendu :
--     account_type en SELECT uniquement, aucune ligne pour is_admin.
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('is_admin', 'account_type')
  and grantee in ('anon', 'authenticated')
order by column_name, grantee, privilege_type;
