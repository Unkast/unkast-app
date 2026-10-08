-- =============================================================================
-- ROLLBACK de 20261011_film_refusal_reasons.sql
-- =============================================================================
--
-- Supprime les colonnes refusal_reasons, refusal_note et source_duration de
-- project_moderation.
--
-- CE QUI EST PERDU : les motifs de refus enregistres et les durees lues. Les
-- emails de refus deja envoyes ne sont pas concernes.
--
-- A lancer APRES avoir remis en ligne le code d'avant ce lot (le code de ce
-- lot lit et ecrit ces colonnes).
-- =============================================================================

begin;

alter table public.project_moderation
  drop constraint if exists project_moderation_refusal_reasons_check;

alter table public.project_moderation
  drop column if exists refusal_reasons,
  drop column if exists refusal_note,
  drop column if exists source_duration;

commit;
