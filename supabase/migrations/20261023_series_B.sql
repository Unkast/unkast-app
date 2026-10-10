-- =============================================================================
-- 20261023_series_B.sql — lot 10 « Séries », étape 1 : épisodes et clé de playlist
-- =============================================================================
-- A EXECUTER A LA MAIN dans le SQL Editor, en une fois, APRES 20261022_series_A.sql
-- et AVANT de deployer le code du lot 10 (le feed, la recherche et les pages
-- categorie lisent projects.episode_count : sans la colonne, ces requetes echouent).
--
-- Contenu :
--   1. projects.episode_count et projects.episodes : episodes d'une serie, figes a
--      la publication puis relus a la demande d'un gestionnaire. Ecrits par le
--      service role uniquement (api/dashboard/projects, api/projects/[id]/episodes) :
--      l'UPDATE client de projects est accorde colonne par colonne, ces deux-la
--      n'en font pas partie.
--   2. extract_video_key : reconnait l'adresse d'une playlist YouTube et renvoie
--      'youtube-playlist:<id>'. publish_project et l'index unique
--      projects_video_key_unique s'en servent deja : une playlist ne peut etre
--      publiee qu'une fois, sans autre changement. Meme regle que extractVideoKey
--      (src/lib/utils.ts) : les deux doivent rester alignees.
--
-- Sans effet sur les films existants : leurs cles ne changent pas (aucune adresse
-- /playlist n'etait reconnue avant, video_key valait NULL pour elles).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Episodes d'une serie
-- -----------------------------------------------------------------------------
alter table public.projects
  add column if not exists episode_count integer,
  add column if not exists episodes jsonb;

alter table public.projects drop constraint if exists projects_episode_count_check;
alter table public.projects
  add constraint projects_episode_count_check check (episode_count is null or episode_count > 0);

alter table public.projects drop constraint if exists projects_episodes_check;
alter table public.projects
  add constraint projects_episodes_check check (episodes is null or jsonb_typeof(episodes) = 'array');

comment on column public.projects.episode_count is
  'Serie : nombre d''episodes de la playlist. NULL pour un film.';
comment on column public.projects.episodes is
  'Serie : episodes [{id, title}] (id = video YouTube), figes a la publication ou a la derniere actualisation. NULL pour un film.';

-- Lecture : memes lecteurs que le reste du film (la RLS de projects decide des
-- lignes). Sans effet si la lecture est deja accordee sur toute la table.
grant select (episode_count, episodes) on public.projects to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. extract_video_key : playlists YouTube
-- -----------------------------------------------------------------------------
-- Signature inchangee : les privileges existants (service role) sont conserves.
create or replace function public.extract_video_key(p_url text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  m text[];
  v_host text;
  v_path text;
  v_query text;
  v_id text;
begin
  m := regexp_match(btrim(coalesce(p_url, '')), '^[a-z][a-z0-9+.-]*://([^/?#]+)([^?#]*)(\?[^#]*)?', 'i');
  if m is null then
    return null;
  end if;

  -- Hote sans identifiants ni port, sans www. / m. / player.
  v_host := lower(m[1]);
  v_host := regexp_replace(v_host, '^.*@', '');
  v_host := regexp_replace(v_host, ':\d+$', '');
  v_host := regexp_replace(v_host, '^(www\.|m\.|player\.)', '');
  v_path := coalesce(m[2], '');
  v_query := coalesce(m[3], '');

  if v_host = 'youtu.be' then
    v_id := (regexp_match(v_path, '^/+([^/]+)'))[1];
  elsif v_host in ('youtube.com', 'youtube-nocookie.com') then
    -- Serie : /playlist?list=<id>
    if v_path ~ '^/+playlist/?$' then
      v_id := (regexp_match(v_query, '[?&]list=([^&]*)'))[1];
      if v_id ~ '^[A-Za-z0-9_-]{13,64}$' then
        return 'youtube-playlist:' || v_id;
      end if;
      return null;
    end if;
    v_id := (regexp_match(v_query, '[?&]v=([^&]*)'))[1];
    if v_id is null or v_id = '' then
      v_id := (regexp_match(v_path, '^/+(?:embed|shorts|v|live)/+([^/]+)'))[1];
    end if;
  elsif v_host = 'vimeo.com' then
    -- Dernier segment compose uniquement de chiffres
    select s.seg into v_id
    from regexp_split_to_table(v_path, '/') with ordinality as s(seg, ord)
    where s.seg ~ '^\d+$'
    order by s.ord desc
    limit 1;
    if v_id is not null then
      return 'vimeo:' || v_id;
    end if;
    return null;
  else
    return null;
  end if;

  if v_id ~ '^[A-Za-z0-9_-]{11}$' then
    return 'youtube:' || v_id;
  end if;
  return null;
end;
$$;

commit;

-- =============================================================================
-- Controles (a lancer apres le commit)
-- =============================================================================
--   -- 1. Les deux colonnes existent
--   select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'projects'
--     and column_name in ('episode_count', 'episodes');
--
--   -- 2. Un client ne peut pas les ecrire (attendu : aucune ligne)
--   select grantee, privilege_type, column_name from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'projects'
--     and column_name in ('episode_count', 'episodes')
--     and privilege_type = 'UPDATE' and grantee in ('anon', 'authenticated');
--
--   -- 3. Cles (attendu : youtube-playlist:PLxxxxxxxxxxxxxxxx, youtube:dQw4w9WgXcQ, vimeo:123456)
--   select public.extract_video_key('https://www.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxx'),
--          public.extract_video_key('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxxxxxxxxxxxxxxxx'),
--          public.extract_video_key('https://vimeo.com/123456');
--
--   -- 4. Aucune cle existante ne change (attendu : 0)
--   select count(*) from public.projects
--   where video_key is distinct from public.extract_video_key(video_url)
--     and video_key is not null;
