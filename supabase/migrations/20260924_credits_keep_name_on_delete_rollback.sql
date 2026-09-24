-- =============================================================================
-- ROLLBACK de 20260924_credits_keep_name_on_delete.sql
-- =============================================================================
--
-- Retire le trigger et sa fonction. La suppression d'un utilisateur credite
-- echouera de nouveau (CHECK credit_has_person).
--
-- Les ghost_name deja remplis par le trigger (utilisateurs supprimes entre-temps)
-- ne sont pas effaces : les credits concernes n'ont plus de profile_id, les
-- vider violerait credit_has_person.
--
-- Idempotent : if exists.
-- =============================================================================

begin;

drop trigger if exists keep_credit_name_on_profile_delete on public.profiles;
drop function if exists public.keep_credit_name_on_profile_delete();

commit;
