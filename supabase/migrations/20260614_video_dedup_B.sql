-- =============================================================================
-- Chantier 9 — Anti-vol d'œuvre : détection des doublons de vidéo
-- ÉTAPE B : contrainte d'unicité (dernier rempart en base)
-- =============================================================================
-- À EXÉCUTER MANUELLEMENT dans le SQL Editor Supabase, APRÈS :
--   1. 20260614_video_dedup_A.sql        (colonne + backfill)
--   2. 20260614_video_dedup_resolve.sql  (résolution des doublons existants)
--
-- Index unique PARTIEL : ne s'applique qu'aux video_key non NULL. Les films dont
-- l'URL n'a pas pu être normalisée (video_key NULL) ne sont jamais bloqués.
-- Une même vidéo (youtube:<id> / vimeo:<id>) ne peut donc exister que sur UN seul
-- projet. Ce rempart tranche même si deux requêtes simultanées passent la
-- vérification applicative (la route renvoie alors un 409 propre via le code 23505).
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS projects_video_key_unique
  ON projects (video_key)
  WHERE video_key IS NOT NULL;
