-- 20261021_uniqueness.sql
-- Contraintes d'unicite relevees par l'audit de la base du 10/10/2026 (I1, I2, I5).
--
-- A executer APRES la mise en ligne du code et APRES 20261020_close_direct_writes.sql.
-- Verifie en production le 10/10/2026 : aucun doublon existant sur les trois regles
-- (0 credit en double, 0 demande en attente en double, 0 jeton en double).
--
--   A. credit_requests : une seule demande EN ATTENTE par (film, demandeur). L'ancienne
--      contrainte portait sur tous les statuts : une personne refusee, ou creditee puis
--      retiree, ne pouvait plus jamais redemander un credit sur ce film.
--   B. project_credits : une personne n'a qu'une fois le meme role sur un film (casse et
--      espaces ignores). Plusieurs roles differents restent permis. Les credits fantomes
--      (profile_id NULL) ne sont pas concernes.
--   C. push_tokens : un jeton (un appareil) n'est lie qu'a un seul compte. L'unicite
--      (profile_id, token) reste en place : la route d'enregistrement s'appuie dessus.

begin;

-- A. Demandes de credit ------------------------------------------------------
alter table public.credit_requests
  drop constraint if exists credit_requests_project_id_requester_id_key;

create unique index if not exists credit_requests_one_pending
  on public.credit_requests (project_id, requester_id)
  where status = 'pending';

-- B. Credits -----------------------------------------------------------------
create unique index if not exists project_credits_one_role_per_person
  on public.project_credits (project_id, profile_id, lower(btrim(role_on_project)))
  where profile_id is not null;

-- C. Jetons de notification --------------------------------------------------
alter table public.push_tokens
  add constraint push_tokens_token_key unique (token);

commit;

-- Controle (lecture seule) : doit renvoyer les trois lignes.
-- select indexname from pg_indexes
--  where schemaname = 'public'
--    and indexname in ('credit_requests_one_pending',
--                      'project_credits_one_role_per_person',
--                      'push_tokens_token_key');
