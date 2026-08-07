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
-- Les deux listes doivent couvrir exactement les 45 colonnes de la table.
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

-- Les 14 colonnes NON accordees, pour memoire (ne rien ajouter ici, c'est un
-- commentaire) : is_admin, contact_email, contact_phone, recruiter_status,
-- recruiter_document_url, recruiter_review_status, bio_pending, suspended_at,
-- suspended_reason, pro_source, stripe_customer_id, stripe_subscription_id,
-- subscription_status, current_period_end.

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
-- Pour connaitre l'etat reel des UPDATE :
--   select grantee, privilege_type, string_agg(column_name, ', ' order by column_name)
--   from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'profiles'
--     and privilege_type = 'UPDATE' and grantee in ('anon', 'authenticated')
--   group by grantee, privilege_type;
--
-- Durcir l'UPDATE de la meme facon serait coherent (un client ne devrait pas
-- pouvoir ecrire is_admin, plan, pro_source ni les colonnes stripe_*), mais c'est
-- un changement a part entiere : a valider et tester avant.
