-- =============================================================================
-- Admin rapide : motifs de refus d'un film, duree de la video
-- =============================================================================
--
-- POURQUOI CE FICHIER (decisions de Maxime, 08/10/2026)
-- S'applique APRES 20261008_film_management.sql (table project_moderation).
-- Independant de 20261009 et 20261010.
--
-- CE QU'IL FAIT
--   Trois colonnes dans project_moderation (table lisible et inscriptible par
--   le service role uniquement, aucun client n'y accede) :
--   A. refusal_reasons : motifs du refus coches par l'admin, parmi
--      son, image, amateur, hors_sujet, droits, autre. Plusieurs possibles.
--   B. refusal_note : texte libre de l'admin (motif « Autre », ou precision).
--      Les deux sont montres au Responsable sur la carte du film refuse, dans
--      « Mes films » (lus par la route /api/dashboard/projects), et repris dans
--      l'email de refus. Effaces si le film est approuve ensuite.
--   C. source_duration : duree de la video en secondes, lue via oEmbed a la
--      publication. Vimeo la donne, YouTube non (NULL).
--
-- CE QU'IL NE FAIT PAS
--   - Aucun motif n'est invente pour les films deja refuses : ils restent sans
--     motif affiche.
--   - Aucun changement de privileges : project_moderation reste fermee aux clients.
--
-- ORDRE DE MISE EN SERVICE
-- A executer JUSTE AVANT de deployer le code correspondant. L'ancien code
-- ignore ces colonnes : aucune interruption.
--
-- Rollback : 20261011_film_refusal_reasons_rollback.sql
-- =============================================================================

begin;

alter table public.project_moderation
  add column if not exists refusal_reasons text[],
  add column if not exists refusal_note    text,
  add column if not exists source_duration integer;

-- Memes valeurs que REFUSAL_REASONS (src/lib/constants.ts).
alter table public.project_moderation
  drop constraint if exists project_moderation_refusal_reasons_check;
alter table public.project_moderation
  add constraint project_moderation_refusal_reasons_check
  check (
    refusal_reasons is null
    or refusal_reasons <@ array['son', 'image', 'amateur', 'hors_sujet', 'droits', 'autre']::text[]
  );

commit;

-- =============================================================================
-- VERIFICATION APRES EXECUTION (lecture seule)
-- =============================================================================
--   -- 1. Les trois colonnes existent
--   select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'project_moderation'
--     and column_name in ('refusal_reasons', 'refusal_note', 'source_duration');
--
--   -- 2. Toujours aucun privilege client sur la table (doit renvoyer 0)
--   select count(*) from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'project_moderation'
--     and grantee in ('anon', 'authenticated');
-- =============================================================================
