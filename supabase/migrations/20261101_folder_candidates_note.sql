-- =============================================================================
-- Listes de talents avec remarque (plan Pro, etape 1, 1er novembre 2026)
-- =============================================================================
-- Table touchee : public.folder_candidates (espace pre-casting, 20260614_recruitment.sql)
--
--   A. Colonne `note` : remarque PRIVEE du recruteur sur un talent range dans une
--      liste. Texte court, 280 caracteres au plus. La limite est posee en base
--      (CHECK) parce que la policy folder_candidates_all permet au recruteur
--      d'ecrire directement dans la table, sans passer par l'API.
--   B. `role` devient facultatif : un talent peut etre ajoute a une liste depuis
--      son profil, sans poste et sans signal « Disponible ». NULL = « sans poste ».
--   C. Anti-doublon : `unique (folder_id, talent_id, role)` laisse passer deux
--      lignes identiques quand role est NULL (NULL est distinct de NULL). La
--      contrainte est recreee en NULLS NOT DISTINCT (Postgres 15+).
--
-- RLS : inchangee. Aucune policy cote talent, la remarque reste invisible pour
-- la personne concernee (elle peut en demander l'acces : droit d'acces RGPD,
-- voir la politique de confidentialite).
--
-- Idempotent. A executer a la main dans le SQL Editor.
-- Retour arriere : 20261101_folder_candidates_note_rollback.sql
-- =============================================================================

begin;

-- ---- A ----------------------------------------------------------------------
alter table public.folder_candidates
  add column if not exists note text;

alter table public.folder_candidates
  drop constraint if exists folder_candidates_note_length;
alter table public.folder_candidates
  add constraint folder_candidates_note_length
  check (note is null or char_length(note) between 1 and 280);

-- ---- B ----------------------------------------------------------------------
alter table public.folder_candidates
  alter column role drop not null;

-- ---- C ----------------------------------------------------------------------
alter table public.folder_candidates
  drop constraint if exists folder_candidates_unique;
alter table public.folder_candidates
  add constraint folder_candidates_unique
  unique nulls not distinct (folder_id, talent_id, role);

commit;

-- Verification :
--   1. note presente, role nullable :
--      select column_name, is_nullable, data_type from information_schema.columns
--      where table_schema = 'public' and table_name = 'folder_candidates'
--        and column_name in ('note', 'role');
--      -> note | YES | text ; role | YES | text
--   2. contraintes :
--      select conname, pg_get_constraintdef(oid) from pg_constraint
--      where conrelid = 'public.folder_candidates'::regclass
--        and conname in ('folder_candidates_unique', 'folder_candidates_note_length');
--      -> UNIQUE NULLS NOT DISTINCT (folder_id, talent_id, role)
--      -> CHECK (note IS NULL OR char_length(note) >= 1 AND char_length(note) <= 280)
