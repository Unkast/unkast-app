-- =============================================================================
-- Lot 8 : champs facultatifs du profil (age de jeu, type de roles, langues)
-- =============================================================================
--
-- POURQUOI CE FICHIER (decisions de Maxime, 09/10/2026)
-- L'assistant de recherche filtre les comediens par age de jeu, type de roles et
-- langue, et les techniciens par langue. Ces informations sont FACULTATIVES,
-- declarees par la personne, et publiques des qu'elles sont remplies. Aucune
-- date de naissance n'est stockee : seulement des tranches d'age de jeu.
--
-- CE QU'IL FAIT
--   A. Ajoute trois colonnes a profiles, toutes NULL par defaut :
--        playing_ages  text[]  tranches d'age de jeu, 1 ou 2 parmi
--                              18-25, 25-35, 35-50, 50+
--        role_type     text    femme, homme ou sans_precision
--        languages     text[]  langues parlees, liste fermee (18 codes)
--      Chaque colonne est contrainte par un CHECK sur sa liste fermee. Une liste
--      vide est refusee : « non renseigne » se dit NULL.
--   B. Droits par colonne, comme le reste de profiles (20260731) :
--        LECTURE  (SELECT) pour anon et authenticated : information publique.
--        ECRITURE (UPDATE) pour authenticated : la personne modifie sa propre
--        ligne, la policy UPDATE existante de profiles s'applique sans changement.
--   C. Deux index GIN pour les filtres de /api/search (contient / recoupe).
--
-- CE QU'IL NE FAIT PAS
--   - Aucune policy, fonction ni trigger n'est modifie.
--   - Aucune donnee existante n'est touchee : les trois colonnes restent NULL
--     tant que la personne ne les remplit pas.
--   - Les listes fermees vivent aussi dans src/lib/constants.ts (PLAYING_AGES,
--     ROLE_TYPES, LANGUAGES) : les deux doivent rester alignees.
--
-- ORDRE DE MISE EN SERVICE
-- A executer AVANT de deployer le code du lot 8. Le code tolere l'absence des
-- colonnes pour le profil (/moi, fiche publique : les champs sont simplement
-- ignores), mais les filtres age de jeu, type de roles et langue de la recherche
-- renvoient une erreur tant que la migration n'est pas passee.
--
-- Idempotent : peut etre rejoue.
-- Rollback : 20261016_profile_casting_fields_rollback.sql
-- =============================================================================

begin;

-- ---- A. Colonnes et contraintes ---------------------------------------------

alter table public.profiles
  add column if not exists playing_ages text[],
  add column if not exists role_type text,
  add column if not exists languages text[];

alter table public.profiles drop constraint if exists profiles_playing_ages_check;
alter table public.profiles add constraint profiles_playing_ages_check check (
  playing_ages is null
  or (
    cardinality(playing_ages) between 1 and 2
    and playing_ages <@ array['18-25', '25-35', '35-50', '50+']::text[]
  )
);

alter table public.profiles drop constraint if exists profiles_role_type_check;
alter table public.profiles add constraint profiles_role_type_check check (
  role_type is null or role_type in ('femme', 'homme', 'sans_precision')
);

alter table public.profiles drop constraint if exists profiles_languages_check;
alter table public.profiles add constraint profiles_languages_check check (
  languages is null
  or (
    cardinality(languages) between 1 and 18
    and languages <@ array[
      'fr', 'en', 'es', 'it', 'de', 'pt', 'nl', 'pl', 'ro', 'ru', 'tr',
      'ar', 'he', 'zh', 'ja', 'ko', 'lsf', 'lsfb'
    ]::text[]
  )
);

comment on column public.profiles.playing_ages is
  'Tranches d''age de jeu (comediens), 1 ou 2 parmi 18-25, 25-35, 35-50, 50+. Facultatif, public si rempli. Jamais de date de naissance.';
comment on column public.profiles.role_type is
  'Type de roles joues (comediens) : femme, homme, sans_precision. Facultatif, public si rempli.';
comment on column public.profiles.languages is
  'Langues parlees, codes de la liste fermee de src/lib/constants.ts (LANGUAGES). Facultatif, public si rempli.';

-- ---- B. Droits par colonne ---------------------------------------------------

grant select (playing_ages, role_type, languages)
  on table public.profiles to anon, authenticated;

grant update (playing_ages, role_type, languages)
  on table public.profiles to authenticated;

-- ---- C. Index des filtres de recherche ---------------------------------------

create index if not exists idx_profiles_languages
  on public.profiles using gin (languages);

create index if not exists idx_profiles_playing_ages
  on public.profiles using gin (playing_ages);

commit;

-- =============================================================================
-- VERIFICATION APRES EXECUTION
-- =============================================================================
-- 1. Les trois colonnes existent (attendu : 3 lignes) :
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'profiles'
--     and column_name in ('playing_ages', 'role_type', 'languages');
--
-- 2. Droits par colonne (attendu : SELECT pour anon et authenticated, UPDATE
--    pour authenticated seulement, soit 9 lignes) :
--   select grantee, column_name, privilege_type
--   from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'profiles'
--     and column_name in ('playing_ages', 'role_type', 'languages')
--     and grantee in ('anon', 'authenticated')
--   order by column_name, grantee, privilege_type;
--
-- 3. Les contraintes refusent une valeur hors liste (attendu : erreur 23514,
--    rien n'est ecrit) :
--   update public.profiles set role_type = 'autre' where false;
--   -- puis, sur une ligne de test :
--   -- update public.profiles set languages = array['xx'] where id = '<id de test>';
