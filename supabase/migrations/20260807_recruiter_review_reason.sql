-- ============================================================================
-- Migration : motif de refus d'une description pro recruteur
-- À EXÉCUTER MANUELLEMENT dans le SQL Editor Supabase. Ne pas exécuter en auto.
--
-- Probleme : le motif saisi par l'admin au refus (reject_recruiter_edit)
-- n'existait que dans admin_logs.details.reason — un journal d'audit que le
-- recruteur ne peut pas lire. Apres un refus, il voyait sa bio inchangee sans
-- explication (MoiClient ne gerait que l'etat 'pending').
--
-- Solution : colonne produit dediee, meme modele que suspended_reason.
--   - ecrite par reject_recruiter_edit (api/admin) avec le motif ;
--   - nettoyee par approve_recruiter_edit ET par toute nouvelle soumission
--     (PATCH api/dashboard/profile quand bio_pending repart en 'pending') ;
--   - lue par le recruteur via GET api/dashboard/profile (PRIVILEGED_COLUMNS,
--     service role scope sur soi).
--
-- GRANTS : rien a faire, et c'est VOULU. Depuis 20260731_profiles_column_grants,
-- anon/authenticated n'ont plus de SELECT table-level sur profiles, seulement
-- des grants colonne par colonne : une colonne nouvellement creee n'est donc
-- lisible QUE par le service role tant qu'on ne l'accorde pas explicitement.
-- Cette colonne rejoint ainsi les colonnes revoquees (leur compte passe de 14
-- a 15 ; le total de colonnes de profiles passe de 45 a 46 — les commentaires
-- de 20260731 et de api/dashboard/profile refletent l'etat A LEUR DATE).
-- ============================================================================

alter table public.profiles
  add column if not exists recruiter_review_reason text;

-- ============================================================================
-- Verif post-execution suggeree :
--   select column_name from information_schema.columns
--     where table_name = 'profiles' and column_name = 'recruiter_review_reason';
--
--   -- Confirmer qu'aucun grant colonne n'existe pour anon/authenticated :
--   select grantee, privilege_type from information_schema.column_privileges
--     where table_schema = 'public' and table_name = 'profiles'
--       and column_name = 'recruiter_review_reason'
--       and grantee in ('anon', 'authenticated');
--   -- attendu : 0 ligne.
-- ============================================================================
