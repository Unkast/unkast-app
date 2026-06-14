-- =============================================================================
-- Chantier 9 — Anti-vol d'œuvre : détection des doublons de vidéo
-- ÉTAPE A : colonne canonique + backfill + détection des collisions existantes
-- =============================================================================
-- À EXÉCUTER MANUELLEMENT dans le SQL Editor Supabase.
--
-- Cette étape NE pose PAS encore la contrainte d'unicité (c'est l'étape B).
-- Objectif : ajouter la colonne, la remplir sur les films existants, puis
-- LISTER les doublons déjà en base. On arbitre les conflits ensemble AVANT
-- de poser l'index unique (sinon l'étape B échouerait).
--
-- L'extraction "officielle" de l'identifiant vit dans le code TS
-- (src/lib/utils.ts -> extractVideoKey). Le backfill ci-dessous reproduit la
-- MÊME logique en SQL, uniquement pour traiter l'existant.
-- =============================================================================

-- 1) Colonne canonique (nullable, sans contrainte pour l'instant).
--    Format : "youtube:<id>" / "vimeo:<id>" / NULL si non reconnu.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_key TEXT;

-- 2) Backfill des films existants.
--    On normalise l'host puis on extrait l'ID selon la plateforme.
--    Tout ce qui n'est pas reconnu de façon sûre reste NULL (pas d'unicité dessus).
WITH parsed AS (
  SELECT
    p.id,
    p.video_url AS raw,
    -- host sans protocole, sans préfixe www./m./player., en minuscule, jusqu'au 1er / ? #
    lower(
      regexp_replace(
        regexp_replace(p.video_url, '^[a-zA-Z]+://', ''),   -- retire le protocole
        '^(www\.|m\.|player\.)', ''                          -- retire www./m./player.
      )
    ) AS no_proto
  FROM projects p
  WHERE p.video_url IS NOT NULL
),
hostpath AS (
  SELECT
    id,
    raw,
    split_part(no_proto, '/', 1)                              AS host,  -- héberge encore d'éventuels :port, mais nos hosts n'en ont pas
    no_proto
  FROM parsed
)
UPDATE projects p
SET video_key = sub.vkey
FROM (
  SELECT
    h.id,
    CASE
      -- youtu.be/<id>
      WHEN h.host = 'youtu.be'
        THEN (
          SELECT 'youtube:' || m[1]
          FROM regexp_match(h.raw, 'youtu\.be/([A-Za-z0-9_-]{11})') AS m
          WHERE m[1] IS NOT NULL
        )
      -- youtube.com (et youtube-nocookie.com) : ?v=, /embed/, /shorts/, /v/, /live/
      WHEN h.host IN ('youtube.com', 'youtube-nocookie.com')
        THEN COALESCE(
          (SELECT 'youtube:' || m[1] FROM regexp_match(h.raw, '[?&]v=([A-Za-z0-9_-]{11})') AS m WHERE m[1] IS NOT NULL),
          (SELECT 'youtube:' || m[1] FROM regexp_match(h.raw, '/(?:embed|shorts|v|live)/([A-Za-z0-9_-]{11})') AS m WHERE m[1] IS NOT NULL)
        )
      -- vimeo.com/<digits> (dernier groupe de chiffres du chemin)
      WHEN h.host = 'vimeo.com'
        THEN (
          SELECT 'vimeo:' || m[1]
          FROM regexp_match(h.raw, 'vimeo\.com/(?:[^/]+/)*(\d+)') AS m
          WHERE m[1] IS NOT NULL
        )
      ELSE NULL
    END AS vkey
  FROM hostpath h
) AS sub
WHERE p.id = sub.id
  AND sub.vkey IS NOT NULL;

-- 3) DÉTECTION DES COLLISIONS — c'est le résultat à me renvoyer.
--    Toute clé apparaissant 2+ fois = même vidéo revendiquée par plusieurs projets.
--    On les arbitre AVANT l'étape B (qui posera l'index unique).
SELECT
  p.video_key,
  count(*)                         AS nb_projets,
  array_agg(p.id   ORDER BY p.created_at)    AS project_ids,
  array_agg(p.title ORDER BY p.created_at)   AS titres,
  array_agg(p.profile_id ORDER BY p.created_at) AS owner_ids
FROM projects p
WHERE p.video_key IS NOT NULL
GROUP BY p.video_key
HAVING count(*) > 1
ORDER BY count(*) DESC, p.video_key;

-- 4) (Indicatif) Films dont l'URL n'a PAS pu être normalisée — resteront sans unicité.
--    Utile pour repérer d'éventuelles plateformes non gérées.
-- SELECT id, title, video_url FROM projects WHERE video_key IS NULL;
