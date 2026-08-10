-- =============================================================================
-- profiles : privileges SELECT au niveau COLONNE pour anon / authenticated
-- =============================================================================
--
-- POURQUOI CE FICHIER
-- Cette regle a ete posee A LA MAIN dans le SQL Editor (juillet 2026) et n'avait
-- jamais ete versionnee : le repo et la base avaient diverge. Le commit 0aa0ced
-- ("lire les 14 colonnes revoquees de profiles via le client de confiance") est la
-- consequence cote code de cette migration. On la fige ici pour qu'un environnement
-- reconstruit depuis supabase/migrations se comporte comme la production.
--
-- Le fichier est DECLARATIF : il pose l'etat cible, il ne rejoue pas l'historique.
-- Il est idempotent, on peut le passer plusieurs fois sans effet de bord.
--
-- CE QU'IL FAIT
-- La RLS de `profiles` autorise la lecture publique d'une ligne approuvee. Elle
-- filtre les LIGNES, jamais les COLONNES : sans ce grant colonne, n'importe quel
-- visiteur pouvait lire contact_email, stripe_customer_id ou is_admin en
-- interrogeant PostgREST directement avec la cle anon. On retire donc le SELECT
-- table entiere et on ne re-accorde que les 31 colonnes non sensibles.
--
-- Les 14 colonnes restantes ne sont lisibles que par le service role, cote serveur :
--   - GET  /api/dashboard/profile  (PRIVILEGED_COLUMNS, scope user.id)
--   - GET  /api/me                 (is_admin, suspended_reason)
--   - lib/supabase/middleware.ts   (is_admin, garde /admin)
--   - api/billing/*, api/admin/*   (colonnes stripe_*, moderation)
--
-- ATTENTION AVANT DE MODIFIER
-- Toute colonne retiree de la liste GRANT ci-dessous doit MIGRER de OWN_COLUMNS
-- vers PRIVILEGED_COLUMNS dans src/app/api/dashboard/profile/route.ts, sinon
-- PostgREST renvoie "permission denied for table profiles" et la page /moi casse.
-- Les deux listes doivent couvrir exactement les 50 colonnes de la table.
--
-- 2026-08-10 (supabase/migrations/20260810_pro_grants.sql) : les 5 colonnes
-- pro_grant_* (Pro offert par l'admin, decouple de Stripe) rejoignent les
-- colonnes NON accordees ci-dessous — meme sensibilite que pro_source/stripe_*.
-- Elles naissent hors du GRANT table-level pose par ce fichier (revoke select
-- on table + re-grant colonne par colonne) donc AUCUN GRANT supplementaire
-- n'est necessaire pour les proteger : l'absence d'ajout ici suffit. `plan`,
-- lui, reste accorde (inchange) — c'est la valeur derivee, toujours lisible.
--
-- Note : `plan` reste volontairement LISIBLE (hooks/useUserStatus.ts le lit depuis
-- le navigateur pour le gating Pro). Ce n'est pas un secret, seulement un statut.
--
-- =============================================================================
-- VERIFICATION AVANT EXECUTION (a passer d'abord, pour comparer a l'etat reel)
-- =============================================================================
--   select grantee, string_agg(column_name, ', ' order by column_name)
--   from information_schema.column_privileges
--   where table_schema = 'public'
--     and table_name  = 'profiles'
--     and privilege_type = 'SELECT'
--     and grantee in ('anon', 'authenticated')
--   group by grantee;
--
-- Si le resultat liste deja exactement les 31 colonnes ci-dessous pour les deux
-- roles, la base est conforme : ce fichier ne sert alors que de documentation.
-- =============================================================================

begin;

-- 1. Retrait du SELECT au niveau TABLE. Obligatoire : en Postgres un privilege
--    table-level prime sur toute restriction colonne, on ne peut pas "revoquer
--    quelques colonnes" tant que le grant table existe.
revoke select on table public.profiles from anon, authenticated;

-- 2. Re-attribution des 31 colonnes publiques / non sensibles uniquement.
grant select (
  id,
  full_name,
  slug,
  bio,
  avatar_url,
  location,
  is_available,
  status,
  created_at,
  updated_at,
  account_type,
  plan,
  pro_since,
  recruiter_company,
  recruiter_role,
  recruiter_website,
  recruiter_verified,
  recruiter_verified_at,
  is_suspended,
  first_name,
  last_name,
  stage_name,
  display_name_preference,
  instagram_url,
  website_url,
  show_contact_email_to,
  show_phone_to,
  show_real_name_to,
  is_recruiting,
  recruiting_roles,
  is_looking_for
) on table public.profiles to anon, authenticated;

-- Les 19 colonnes NON accordees, pour memoire (ne rien ajouter ici, c'est un
-- commentaire) : is_admin, contact_email, contact_phone, recruiter_status,
-- recruiter_document_url, recruiter_review_status,
-- bio_pending, suspended_at, suspended_reason, pro_source, stripe_customer_id,
-- stripe_subscription_id, subscription_status, current_period_end,
-- pro_grant_type, pro_grant_expires_at, pro_grant_granted_by,
-- pro_grant_granted_at, pro_grant_reminder_sent_at.
--
-- pro_source (2026-08-10) : GELEE, plus jamais ecrite ni lue par le code
-- applicatif a partir du commit qui suit 20260810_pro_grants.sql. Conservee en
-- base (pas de DROP) — suppression prevue dans un commit dedie, apres le
-- lancement. Reste dans cette liste sans changement de statut GRANT.

commit;

-- =============================================================================
-- LES PRIVILEGES UPDATE NE SONT PAS TOUCHES ICI
-- =============================================================================
-- Ce fichier ne traite QUE le SELECT. La distinction compte : contact_email et
-- contact_phone sont revoquees en SELECT mais ACCORDEES en UPDATE a authenticated.
-- Elles restent donc ecrites par le client utilisateur dans le PATCH de
-- api/dashboard/profile, comme les autres champs editables.
--
-- Ce n'est possible que parce que l'update ne chaine pas .select() : postgrest-js
-- n'ajoute `Prefer: return=representation` que dans select(), donc PostgREST repond
-- 204 sans clause RETURNING et n'exerce aucun privilege de lecture sur les colonnes
-- ecrites. Chainer un .select() sur cet update ferait apparaitre un 403 portant sur
-- les colonnes RETOURNEES : la correction serait alors de les retirer du retour, PAS
-- de basculer l'ecriture sur le service role.
--
-- VERIFIE EN PRODUCTION LE 07/08/2026 (requete ci-dessous, role UPDATE) :
--   select grantee, privilege_type, string_agg(column_name, ', ' order by column_name)
--   from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'profiles'
--     and privilege_type = 'UPDATE' and grantee in ('anon', 'authenticated')
--   group by grantee, privilege_type;
--
-- Resultat : `authenticated` dispose de 17 GRANT UPDATE colonne (avatar_url, bio,
-- contact_email, contact_phone, display_name_preference, first_name, full_name,
-- instagram_url, is_available, last_name, location, show_contact_email_to,
-- show_phone_to, show_real_name_to, stage_name, updated_at, website_url).
-- `anon` n'a aucun GRANT UPDATE colonne. Aucun GRANT UPDATE ni SELECT au niveau
-- TABLE pour ces deux roles (le retrait table-level de la section SELECT
-- ci-dessus s'applique donc egalement en pratique).
--
-- CONCLUSION : is_admin, plan, pro_source et les colonnes stripe_* ne sont PAS
-- ecrivables par un client (anon ou authenticated). Le durcissement UPDATE
-- evoque dans une version anterieure de ce commentaire comme "reste a faire"
-- etait deja en place en production ; l'ecart etait dans la documentation, pas
-- dans la base.
--
-- 2026-08-10 : les colonnes pro_grant_* (posees par 20260810_pro_grants.sql,
-- posterieures a cette verification du 07/08/2026) n'ont RECU aucun GRANT
-- UPDATE ni SELECT lors de leur creation — elles heritent donc de la meme
-- protection par construction, mais ce fait n'a pas ete reverifie par une
-- requete en production comme le bloc ci-dessus. A confirmer par la meme
-- requete si un doute survient.
