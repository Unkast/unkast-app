-- =============================================================================
-- Vrais noms fermes, etape B : retrait de la lecture des colonnes de nom
-- =============================================================================
--
-- POURQUOI CE FICHIER (decisions de Maxime, 09/10/2026)
-- Suite de 20261014_profile_display_name.sql (etape A). Le vrai nom d'une
-- personne n'est plus lisible par un client : seule display_name (calculee par
-- la base) reste lisible avec la cle publique. La personne lit son propre vrai
-- nom par le serveur (GET /api/dashboard/profile), l'admin par le service role.
--
-- PREALABLES (verifies le 09/10/2026)
--   - Etape A executee, code qui lit display_name en production (branche main).
--   - Controle de la base : seules deux fonctions nomment ces colonnes,
--     keep_credit_name_on_profile_delete et public_project_credits, toutes deux
--     SECURITY DEFINER (elles ne dependent pas des droits de l'appelant).
--     Aucune vue, aucune policy.
--
-- CE QU'IL FAIT
-- Retire le droit de LECTURE (SELECT) de anon et authenticated sur cinq colonnes
-- de profiles : full_name, first_name, last_name, stage_name,
-- display_name_preference.
--
-- CE QU'IL NE FAIT PAS
--   - Les droits d'ECRITURE (UPDATE) de authenticated sur ces cinq colonnes sont
--     CONSERVES : la personne modifie toujours son nom depuis /moi. La route
--     ecrit sans relire la ligne (pas de retour demande a la base), donc aucun
--     droit de lecture n'est exerce. C'est deja le fonctionnement de
--     contact_email et contact_phone depuis 20260731.
--   - display_name reste lisible (accordee a l'etape A).
--   - Le droit REFERENCES sur ces colonnes n'est pas touche : il ne permet pas
--     de lire une valeur.
--   - Aucune donnee, policy, fonction ni trigger n'est modifie.
--
-- EFFET
-- Toute requete faite avec la cle publique (anon ou membre connecte) qui nomme
-- une de ces cinq colonnes, en lecture, en filtre ou en tri, est refusee en
-- entier (permission denied). Le service role n'est pas concerne.
--
-- NE PAS EXECUTER si le code en production est anterieur au lot « vrais noms
-- fermes » : toutes les pages qui lisent un profil seraient en erreur.
--
-- Rollback : 20261015_profile_real_names_closed_rollback.sql (retablit la
-- lecture, sans perte : a lancer immediatement si une page repond en erreur).
-- =============================================================================

begin;

revoke select (full_name, first_name, last_name, stage_name, display_name_preference)
  on table public.profiles
  from anon, authenticated;

commit;

-- =============================================================================
-- VERIFICATIONS (a lancer apres, en lecture seule)
-- =============================================================================
-- 1. Droits restants sur les colonnes de nom. Attendu :
--      display_name             : anon SELECT ; authenticated SELECT
--      les cinq autres, anon    : plus aucun SELECT (REFERENCES seul)
--      les cinq autres, authenticated : UPDATE (et REFERENCES), plus de SELECT
--   select column_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as droits
--   from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'profiles'
--     and column_name in ('full_name', 'first_name', 'last_name', 'stage_name',
--                         'display_name_preference', 'display_name')
--     and grantee in ('anon', 'authenticated')
--   group by column_name, grantee
--   order by column_name, grantee;
--
-- 2. Aucun droit de lecture au niveau de la table (attendu : 0 ligne). S'il en
--    restait un, il primerait sur le retrait par colonne :
--   select grantee, privilege_type
--   from information_schema.table_privileges
--   where table_schema = 'public' and table_name = 'profiles'
--     and privilege_type = 'SELECT' and grantee in ('anon', 'authenticated', 'PUBLIC');
--
-- 3. Lecture refusee pour un visiteur (attendu : ERREUR permission denied), puis
--    lecture du nom d'affichage acceptee (attendu : un nombre) :
--   begin; set local role anon; select full_name from public.profiles limit 1; rollback;
--   begin; set local role anon; select count(display_name) from public.profiles; rollback;
