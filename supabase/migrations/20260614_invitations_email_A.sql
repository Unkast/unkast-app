-- =============================================================================
-- Chantier 10 — Invitation des collaborateurs crédités (cas b : email)
-- ÉTAPE A : enrichir la table `invitations` + durcir le token + DÉTECTER les
--           doublons (email, projet) AVANT de basculer l'unicité (étape B).
-- =============================================================================
-- À EXÉCUTER MANUELLEMENT dans le SQL Editor Supabase.
-- Cette étape NE touche PAS encore l'unicité (c'est l'étape B). Elle ajoute les
-- colonnes, sécurise `token`, puis liste d'éventuels doublons legacy.
--
-- Rappel structure existante (database.md) :
--   invitations : id, project_id, email, role, token, created_at
-- On ajoute : credit_id, inviter_id, status, expires_at + on durcit token.
-- =============================================================================

-- 0) INSPECTION — à lire AVANT de lancer l'étape B : liste les contraintes et
--    index actuels sur `invitations` (notamment l'unicité email globale à retirer).
SELECT conname AS contrainte, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.invitations'::regclass
ORDER BY conname;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'invitations'
ORDER BY indexname;

-- 1) Nouvelles colonnes (idempotent).
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS credit_id  UUID REFERENCES project_credits(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS inviter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status     TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days');

-- 2) Durcir `token` : backfill des éventuels NULL, défaut aléatoire, NOT NULL, unique.
--    NB : la colonne `token` est de type UUID -> gen_random_uuid() SANS cast.
UPDATE invitations SET token = gen_random_uuid() WHERE token IS NULL;

ALTER TABLE invitations ALTER COLUMN token SET DEFAULT gen_random_uuid();
ALTER TABLE invitations ALTER COLUMN token SET NOT NULL;

-- Index unique sur token (usage unique du lien). Idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_key ON invitations (token);

-- 3) DÉTECTION DES DOUBLONS (email, projet) — résultat à me renvoyer.
--    Si 0 ligne => on peut poser directement l'unique (email, projet) en étape B.
--    Si >= 1 ligne => on arbitre (les invitations email sont en pratique inutilisées,
--    donc on pourra purger les doublons les plus récents, à valider ensemble).
SELECT
  lower(email)              AS email_norm,
  project_id,
  count(*)                  AS nb,
  array_agg(id ORDER BY created_at) AS invitation_ids
FROM invitations
GROUP BY lower(email), project_id
HAVING count(*) > 1
ORDER BY count(*) DESC;

-- 4) (Indicatif) volume total — souvent 0 (table jamais réellement alimentée).
SELECT count(*) AS total_invitations FROM invitations;
