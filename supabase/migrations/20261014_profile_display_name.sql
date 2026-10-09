-- =============================================================================
-- Vrais noms fermes, etape A : nom d'affichage calcule en base
-- =============================================================================
--
-- POURQUOI CE FICHIER (decisions de Maxime, 09/10/2026)
-- Le vrai nom d'une personne (full_name, first_name, last_name) ne doit plus
-- etre lisible par un client, sauf par elle-meme et par l'admin. Aujourd'hui ces
-- colonnes se lisent avec la cle publique pour tout profil approuve, meme quand
-- la personne affiche un nom de scene : l'app ne les montre pas, mais la base
-- les donne.
--
-- La fermeture se fait en DEUX etapes, pour ne jamais couper le site :
--   A. (ce fichier) ajouter display_name, seule colonne de nom que le nouveau
--      code lit avec la cle publique. Rien n'est retire : l'ancien code continue
--      de fonctionner.
--   B. (fichier suivant, PAS ENCORE) retirer la lecture de full_name,
--      first_name, last_name, stage_name et display_name_preference pour anon et
--      authenticated. A lancer seulement quand le nouveau code est en production.
--
-- CE QU'IL FAIT
--   1. Colonne profiles.display_name, CALCULEE PAR LA BASE (colonne generee,
--      stockee) : toujours a jour, impossible a ecrire, ni par un client ni par
--      le serveur. Meme regle que getDisplayName (src/lib/profile.ts) et que
--      public_project_credits, a garder alignees :
--        1. nom de scene, si display_name_preference = 'stage_name' et qu'il
--           est rempli ;
--        2. sinon prenom + nom ;
--        3. sinon full_name ;
--        4. sinon « Utilisateur ».
--   2. Lecture de display_name accordee a anon et authenticated (les droits de
--      profiles sont donnes colonne par colonne depuis 20260731 : une colonne
--      ajoutee n'en herite aucun).
--   3. Index de recherche sur display_name (la recherche de talents filtre et
--      trie desormais sur le nom d'affichage).
--
-- CE QU'IL NE FAIT PAS
--   - Aucun droit n'est retire (c'est l'etape B).
--   - Aucune adresse de profil (slug) n'est modifiee : le rattrapage des
--     adresses qui contiennent un vrai nom se fait depuis l'admin, sur une liste
--     a confirmer.
--   - Aucune policy, aucun trigger, aucune fonction n'est modifie.
--
-- A SAVOIR
-- Ajouter une colonne generee stockee reecrit la table profiles : un verrou de
-- quelques instants pendant l'execution (table de petite taille).
--
-- ORDRE DE MISE EN SERVICE
--   1. Ce fichier (l'ancien code n'est pas gene).
--   2. Deploiement du nouveau code.
--   3. Requete de controle, puis etape B.
-- Le nouveau code NE FONCTIONNE PAS sans ce fichier (il lit display_name).
--
-- Rollback : 20261014_profile_display_name_rollback.sql
-- =============================================================================

begin;

-- ---- 1. Nom d'affichage calcule par la base ----------------------------------
alter table public.profiles
  add column if not exists display_name text
  generated always as (
    case
      when display_name_preference = 'stage_name' and stage_name <> '' then stage_name
      else coalesce(
        nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''),
        nullif(full_name, ''),
        'Utilisateur'
      )
    end
  ) stored;

-- ---- 2. Seule colonne de nom destinee aux clients ----------------------------
grant select (display_name) on table public.profiles to anon, authenticated;

-- ---- 3. Recherche sur le nom d'affichage -------------------------------------
create index if not exists idx_profiles_display_name_trgm
  on public.profiles using gin (display_name gin_trgm_ops);

commit;

-- =============================================================================
-- VERIFICATIONS (a lancer apres, en lecture seule)
-- =============================================================================
-- 1. La colonne existe et elle est generee (attendu : is_generated = ALWAYS) :
--   select column_name, is_generated
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name';
--
-- 2. Elle est lisible par anon et authenticated (attendu : 2 lignes) :
--   select grantee, privilege_type
--   from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'profiles'
--     and column_name = 'display_name' and grantee in ('anon', 'authenticated');
--
-- 3. Aucun nom d'affichage vide (attendu : 0) :
--   select count(*) from public.profiles where display_name is null or btrim(display_name) = '';
--
-- 4. Les personnes qui affichent un nom de scene (controle a l'oeil : la colonne
--    display_name doit etre le nom de scene, jamais le vrai nom) :
--   select display_name, stage_name, full_name, slug
--   from public.profiles
--   where display_name_preference = 'stage_name' and stage_name <> '';
