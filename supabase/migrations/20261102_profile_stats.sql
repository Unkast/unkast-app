-- =============================================================================
-- Statistiques de profil (plan Pro, etape 2, 2 novembre 2026)
-- =============================================================================
-- Collecte pour TOUS les profils. Seuls les Pro voient leurs chiffres dans /moi
-- (GET /api/me/stats renvoie { locked: true } sans aucun chiffre aux autres).
-- Jamais l'identite d'un visiteur : uniquement des compteurs.
--
--   A. profile_stat_events : evenements bruts, servent UNIQUEMENT a dedoublonner
--      (une fois par visiteur, par profil, par type et par jour). Purges apres
--      7 jours par /api/cron/retention.
--   B. profile_stats_daily : compteurs agreges par profil et par jour (visites,
--      ajouts a une liste, clics « Envoyer un message »). Gardes.
--   C. profile_stat_salts : un sel aleatoire par jour (heure de Paris). L'ancien
--      est efface des qu'un evenement du nouveau jour arrive (et par le cron) :
--      un hash ne peut plus etre recalcule ni relie d'un jour a l'autre.
--      Seule table SANS cle etrangere vers profiles : elle ne contient aucune
--      donnee de profil (une ligne par jour, commune a tous).
--   D. RPC record_profile_event : calcule le hash DANS la base (le sel ne sort
--      jamais), insere l'evenement s'il est nouveau, incremente le compteur du jour.
--
-- Hash du visiteur = sha256(sel du jour : cle visiteur : id du profil).
--   cle visiteur = « u:<id du membre> » (connecte) ou « a:<ip>|<user agent> »
--   (visiteur anonyme). L'IP n'est JAMAIS stockee, seulement ce hash. L'id du
--   profil dans le hash empeche de relier un visiteur d'un profil a l'autre.
--
-- RLS activee, AUCUNE policy, droits retires a anon et authenticated : seul le
-- service role (routes serveur) lit et ecrit. La RPC n'est executable que par
-- service_role.
-- Suppression d'un profil (et donc d'un compte) : ses evenements et ses
-- compteurs partent avec lui (on delete cascade).
--
-- Idempotent. A executer a la main dans le SQL Editor.
-- Retour arriere : 20261102_profile_stats_rollback.sql
-- =============================================================================

begin;

-- ---- A ----------------------------------------------------------------------
create table if not exists public.profile_stat_events (
  id           bigint generated always as identity primary key,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  day          date not null,
  kind         text not null,
  visitor_hash text not null,
  created_at   timestamptz not null default now()
);

alter table public.profile_stat_events
  drop constraint if exists profile_stat_events_kind_check;
alter table public.profile_stat_events
  add constraint profile_stat_events_kind_check
  check (kind in ('view', 'list_add', 'message_click'));

alter table public.profile_stat_events
  drop constraint if exists profile_stat_events_unique;
alter table public.profile_stat_events
  add constraint profile_stat_events_unique
  unique (profile_id, day, kind, visitor_hash);

-- Purge par date (cron retention).
create index if not exists profile_stat_events_day_idx
  on public.profile_stat_events (day);

alter table public.profile_stat_events enable row level security;
revoke all on table public.profile_stat_events from public, anon, authenticated;

-- ---- B ----------------------------------------------------------------------
create table if not exists public.profile_stats_daily (
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  day            date not null,
  views          integer not null default 0 check (views >= 0),
  list_adds      integer not null default 0 check (list_adds >= 0),
  message_clicks integer not null default 0 check (message_clicks >= 0),
  primary key (profile_id, day)
);

alter table public.profile_stats_daily enable row level security;
revoke all on table public.profile_stats_daily from public, anon, authenticated;

-- ---- C ----------------------------------------------------------------------
create table if not exists public.profile_stat_salts (
  day  date primary key,
  salt text not null
);

alter table public.profile_stat_salts enable row level security;
revoke all on table public.profile_stat_salts from public, anon, authenticated;

-- ---- D ----------------------------------------------------------------------
-- Renvoie true si l'evenement a ete compte, false si c'etait un doublon du jour.
create or replace function public.record_profile_event(
  p_profile_id  uuid,
  p_kind        text,
  p_visitor_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day  date := (now() at time zone 'Europe/Paris')::date;
  v_salt text;
  v_hash text;
  v_rows integer;
begin
  if p_profile_id is null or p_visitor_key is null or p_visitor_key = ''
     or p_kind not in ('view', 'list_add', 'message_click') then
    return false;
  end if;

  select s.salt into v_salt from public.profile_stat_salts s where s.day = v_day;
  if v_salt is null then
    -- Rotation : les sels des jours passes sont detruits.
    delete from public.profile_stat_salts where day < v_day;
    -- Deux uuid v4 = 244 bits aleatoires (gen_random_uuid : generateur sur).
    insert into public.profile_stat_salts (day, salt)
      values (v_day, gen_random_uuid()::text || gen_random_uuid()::text)
      on conflict (day) do nothing;
    select s.salt into v_salt from public.profile_stat_salts s where s.day = v_day;
  end if;

  v_hash := encode(
    sha256(convert_to(v_salt || ':' || p_visitor_key || ':' || p_profile_id::text, 'UTF8')),
    'hex'
  );

  insert into public.profile_stat_events (profile_id, day, kind, visitor_hash)
    values (p_profile_id, v_day, p_kind, v_hash)
    on conflict on constraint profile_stat_events_unique do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return false;
  end if;

  insert into public.profile_stats_daily as d (profile_id, day, views, list_adds, message_clicks)
    values (
      p_profile_id, v_day,
      (p_kind = 'view')::int, (p_kind = 'list_add')::int, (p_kind = 'message_click')::int
    )
    on conflict (profile_id, day) do update set
      views          = d.views          + excluded.views,
      list_adds      = d.list_adds      + excluded.list_adds,
      message_clicks = d.message_clicks + excluded.message_clicks;

  return true;
end;
$$;

revoke all on function public.record_profile_event(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_profile_event(uuid, text, text) to service_role;

commit;

-- Verification :
--   1. RLS active, aucune policy :
--      select tablename, rowsecurity from pg_tables
--      where schemaname = 'public' and tablename like 'profile_stat%';
--      -> 3 lignes, rowsecurity = true
--      select count(*) from pg_policies where tablename like 'profile_stat%';
--      -> 0
--   2. Droits : aucun pour anon / authenticated
--      select grantee, table_name, privilege_type from information_schema.role_table_grants
--      where table_name like 'profile_stat%' and grantee in ('anon', 'authenticated');
--      -> 0 ligne
--   3. RPC reservee au service role :
--      select has_function_privilege('authenticated', 'public.record_profile_event(uuid, text, text)', 'execute'),
--             has_function_privilege('anon', 'public.record_profile_event(uuid, text, text)', 'execute'),
--             has_function_privilege('service_role', 'public.record_profile_event(uuid, text, text)', 'execute');
--      -> false | false | true
--   4. Essai (remplacer <id> par l'id d'un profil existant), puis nettoyage :
--      select public.record_profile_event('<id>', 'view', 'test');  -> true
--      select public.record_profile_event('<id>', 'view', 'test');  -> false (doublon du jour)
--      select * from public.profile_stats_daily where profile_id = '<id>';  -> views = 1
--      delete from public.profile_stat_events where profile_id = '<id>';
--      delete from public.profile_stats_daily where profile_id = '<id>';
