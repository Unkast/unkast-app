-- =============================================================================
-- ROLLBACK de 20261101_folder_candidates_note.sql
-- =============================================================================
-- Remet folder_candidates tel qu'en 20260614_recruitment.sql.
--
-- ATTENTION, perte de donnees :
--   - toutes les remarques (colonne note) sont supprimees ;
--   - les talents ajoutes SANS POSTE (role NULL) sont retires de leurs listes,
--     sinon role ne peut pas redevenir NOT NULL.
-- A executer seulement si le code des remarques est retire ou pas en production :
-- il lit et ecrit la colonne note.
-- =============================================================================

begin;

delete from public.folder_candidates where role is null;

alter table public.folder_candidates
  drop constraint if exists folder_candidates_unique;
alter table public.folder_candidates
  add constraint folder_candidates_unique unique (folder_id, talent_id, role);

alter table public.folder_candidates
  alter column role set not null;

alter table public.folder_candidates
  drop constraint if exists folder_candidates_note_length;
alter table public.folder_candidates
  drop column if exists note;

commit;

-- Verification : note absente, role NOT NULL
--   select column_name, is_nullable from information_schema.columns
--   where table_schema = 'public' and table_name = 'folder_candidates';
