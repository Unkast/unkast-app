-- =============================================================================
-- Chantier 10 — Invitation des collaborateurs crédités
-- ÉTAPE B : basculer l'unicité « email global » → « (email, projet) »
-- =============================================================================
-- À EXÉCUTER MANUELLEMENT, APRÈS l'étape A et APRÈS avoir vérifié que la requête
-- de détection (A §3) renvoie 0 ligne. S'il restait des doublons (email, projet),
-- on les purge ensemble AVANT cette étape (sinon la création de l'index échoue).
--
-- Objectif : une personne peut être créditée/invitée sur PLUSIEURS films, mais
-- une seule invitation par (email, projet). Anti-spam ciblé + cohérence produit.
-- =============================================================================

-- 1) Retirer l'ancienne unicité « email global » si elle existe.
--    On ne connaît pas son nom exact selon l'historique de la base : ce bloc
--    détecte et supprime toute contrainte UNIQUE portant uniquement sur (email),
--    ainsi que tout index unique autonome sur (email) seul.
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Contraintes UNIQUE mono-colonne sur `email`
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE con.conrelid = 'public.invitations'::regclass
      AND con.contype = 'u'
      AND array_length(con.conkey, 1) = 1
      AND att.attname = 'email'
  LOOP
    EXECUTE format('ALTER TABLE invitations DROP CONSTRAINT %I', r.conname);
  END LOOP;

  -- Index uniques autonomes sur (email) seul (hors celui de token)
  FOR r IN
    SELECT indexrelid::regclass::text AS idxname
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE i.indrelid = 'public.invitations'::regclass
      AND i.indisunique
      AND i.indnkeyatts = 1
      AND (i.indkey::int2[])[0] = (
        SELECT attnum FROM pg_attribute
        WHERE attrelid = 'public.invitations'::regclass AND attname = 'email'
      )
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %s', r.idxname);
  END LOOP;
END $$;

-- 2) Poser la nouvelle unicité (email insensible à la casse, par projet).
CREATE UNIQUE INDEX IF NOT EXISTS invitations_email_project_key
  ON invitations (lower(email), project_id);

-- 3) Contrôle : ne doit renvoyer AUCUNE ligne.
SELECT lower(email) AS email_norm, project_id, count(*) AS nb
FROM invitations
GROUP BY lower(email), project_id
HAVING count(*) > 1;
