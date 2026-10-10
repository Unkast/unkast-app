-- Rollback de 20261021_uniqueness.sql
-- Attention : la contrainte d'origine sur credit_requests ne peut etre reposee que si
-- aucune personne n'a deux demandes (tous statuts confondus) sur le meme film.

begin;

alter table public.push_tokens drop constraint if exists push_tokens_token_key;

drop index if exists public.project_credits_one_role_per_person;

drop index if exists public.credit_requests_one_pending;
alter table public.credit_requests
  add constraint credit_requests_project_id_requester_id_key unique (project_id, requester_id);

commit;
