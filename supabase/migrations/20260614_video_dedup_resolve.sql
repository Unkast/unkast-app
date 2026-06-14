-- =============================================================================
-- Chantier 9 — Anti-vol d'œuvre : RÉSOLUTION des doublons existants
-- (données de test uniquement — aucun vrai conflit d'usurpation)
-- =============================================================================
-- À EXÉCUTER MANUELLEMENT dans le SQL Editor Supabase, APRÈS l'étape A et AVANT
-- l'étape B (index unique).
--
-- Stratégie : pour chaque video_key partagé par plusieurs projets, on GARDE le
-- plus ancien (created_at le plus petit, id en départage) et on met video_key =
-- NULL sur les autres. Les projets « perdants » conservent leur video_url et
-- restent visibles — ils sortent juste du périmètre de l'unicité.
-- Aucun film n'est supprimé.
-- =============================================================================

-- (Optionnel) Vérifier ce qui sera modifié AVANT — doit lister les "perdants".
-- SELECT id, title, video_key FROM (
--   SELECT id, title, video_key,
--          row_number() OVER (PARTITION BY video_key ORDER BY created_at, id) AS rn
--   FROM projects WHERE video_key IS NOT NULL
-- ) s WHERE rn > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY video_key ORDER BY created_at, id) AS rn
  FROM projects
  WHERE video_key IS NOT NULL
)
UPDATE projects p
SET video_key = NULL
FROM ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- Contrôle : ne doit renvoyer AUCUNE ligne (plus aucun doublon).
SELECT video_key, count(*) AS nb
FROM projects
WHERE video_key IS NOT NULL
GROUP BY video_key
HAVING count(*) > 1;
