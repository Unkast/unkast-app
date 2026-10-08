-- =============================================================================
-- Acceptation des CGU et de la politique de confidentialite
-- =============================================================================
--
-- POURQUOI CE FICHIER (decisions de Maxime, 08/10/2026)
-- Les pages legales de la beta (/cgu, /confidentialite, /mentions-legales)
-- demandent une trace de l'acceptation : quelle version, a quelle date.
-- Independant des migrations 20261008 a 20261011.
--
-- CE QU'IL FAIT
--   Deux colonnes dans profiles :
--   A. terms_version     : version des CGU et de la politique acceptee
--                          (TERMS_VERSION dans src/lib/legal.ts).
--   B. terms_accepted_at : date et heure de l'acceptation.
--   Ecrites par le serveur uniquement (service role) : a l'inscription
--   (/api/signup) et par l'ecran « Les CGU ont ete mises a jour »
--   (/api/terms/accept).
--
-- POURQUOI AUCUN GRANT
--   profiles n'a pas de GRANT au niveau table pour anon et authenticated, mais
--   une liste de colonnes (migration 20260731_profiles_column_grants.sql). Une
--   colonne ajoutee n'herite d'aucun droit : ces deux colonnes ne sont donc ni
--   lisibles ni modifiables par un client. C'est voulu : personne ne peut
--   s'attribuer une acceptation, ni lire celle des autres. La verification 2
--   ci-dessous le controle.
--
-- CE QU'IL NE FAIT PAS
--   - Aucune acceptation n'est inventee pour les membres deja inscrits : leurs
--     colonnes restent NULL, et l'app leur presente l'ecran d'acceptation a
--     leur prochaine connexion.
--
-- ORDRE DE MISE EN SERVICE
-- A executer JUSTE AVANT de deployer le code correspondant : le nouveau code
-- lit et ecrit ces colonnes (sans elles, l'inscription echoue). L'ancien code
-- les ignore.
--
-- Rollback : 20261012_terms_acceptance_rollback.sql
-- =============================================================================

begin;

alter table public.profiles
  add column if not exists terms_version     text,
  add column if not exists terms_accepted_at timestamptz;

-- Les deux vont ensemble : une version sans date (ou l'inverse) n'a pas de sens.
alter table public.profiles
  drop constraint if exists profiles_terms_acceptance_check;
alter table public.profiles
  add constraint profiles_terms_acceptance_check
  check ((terms_version is null) = (terms_accepted_at is null));

commit;

-- =============================================================================
-- VERIFICATION APRES EXECUTION (lecture seule)
-- =============================================================================
--   -- 1. Les deux colonnes existent
--   select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'profiles'
--     and column_name in ('terms_version', 'terms_accepted_at');
--
--   -- 2. Aucun droit client sur ces colonnes (doit renvoyer 0)
--   select count(*) from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'profiles'
--     and column_name in ('terms_version', 'terms_accepted_at')
--     and grantee in ('anon', 'authenticated');
--
--   -- 3. Suivi : qui a accepte quelle version
--   select terms_version, count(*) from public.profiles group by 1 order by 1;
-- =============================================================================
