-- ============================================================================
-- Nettoyage du type de grant 'recruiter' — commit 4 du chantier Pro grants
-- A EXECUTER MANUELLEMENT dans le SQL Editor Supabase. Ne pas executer en auto.
--
-- Contexte : le nouveau modele economique (2026-08-10, posterieur a
-- 20260810_pro_grants.sql / _recensement.sql / _backfill.sql) retire la regle
-- "recruiter ⇒ pro" : `approve_recruiter` ne pose plus jamais de grant
-- `pro_grant_type='recruiter'` (voir api/admin/route.ts). Le type devient
-- orphelin — plus aucun code ne le cree.
--
-- Stock verifie et purge manuellement AVANT cette migration (hors fichier,
-- fait a la main sur le seul profil concerne, backfille par
-- 20260810_pro_grants_backfill.sql : id 4c4dcd81-e9af-4fda-a4b4-648a9f456d8e).
-- Cette migration ne fait AUCUN UPDATE de donnees — uniquement le resserrage
-- des CHECK, une fois le stock a zero.
--
-- IDEMPOTENCE : "drop constraint if exists" est nativement idempotent ; chaque
-- execution redepose la meme contrainte resserree. Pas besoin de bloc DO ici
-- (contrairement a 20260810_pro_grants.sql, qui n'avait que ADD CONSTRAINT
-- sans IF NOT EXISTS et devait donc verifier pg_constraint a la main).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. VERIFICATION PREALABLE — a executer et LIRE avant le BEGIN ci-dessous.
--    Doit renvoyer 0 lignes. Si une seule ligne apparait, NE PAS CONTINUER :
--    le CHECK resserre la rejetterait, l'UPDATE en cours echouerait avec une
--    erreur Postgres brute (violates check constraint) au lieu d'un message
--    applicatif clair.
-- ----------------------------------------------------------------------------
-- select id, full_name, pro_grant_type, pro_grant_expires_at
--   from public.profiles
--   where pro_grant_type = 'recruiter';

begin;

-- ----------------------------------------------------------------------------
-- 1. Enumeration resserree : 'launch' | 'vip' uniquement.
-- ----------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_pro_grant_type_check;
alter table public.profiles
  add constraint profiles_pro_grant_type_check
  check (pro_grant_type is null or pro_grant_type in ('launch', 'vip'));

-- ----------------------------------------------------------------------------
-- 2. Regle d'echeance — le cas 'recruiter' (echeance interdite, NULL strict)
--    n'a plus de raison d'etre puisque le type n'existe plus. Ne restent que
--    launch (obligatoire) et vip (libre).
-- ----------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_pro_grant_expiry_check;
alter table public.profiles
  add constraint profiles_pro_grant_expiry_check
  check (
    pro_grant_type is null
    or (pro_grant_type = 'launch' and pro_grant_expires_at is not null)
    or (pro_grant_type = 'vip')  -- expires_at libre, null ou date
  );

-- ----------------------------------------------------------------------------
-- 3. Commentaire de colonne — retire la mention du type disparu.
-- ----------------------------------------------------------------------------
comment on column public.profiles.pro_grant_type is
  'Nature du Pro offert par admin. launch = cadeau de lancement, echeance obligatoire (defaut 1 an). vip = choix explicite, echeance libre (null = a vie). NULL = aucun grant. Le type ''recruiter'' (Pro lie a l''approbation recruteur) a existe du 2026-08-10 au commit 4 du meme jour puis a ete retire du modele — plus aucun code ne le pose depuis, voir 20260810_pro_grants_type_cleanup.sql.';

commit;

-- ============================================================================
-- Verifications suggerees APRES execution :
--
-- -- Les deux CHECK portent bien la nouvelle definition (doit renvoyer 2 lignes,
-- -- sans 'recruiter' dans la definition) :
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.profiles'::regclass
--     and conname in ('profiles_pro_grant_type_check', 'profiles_pro_grant_expiry_check');
--
-- -- Aucune ligne ne viole les nouveaux CHECK (doit renvoyer 0 — si la
-- -- verification prealable en 0. a ete respectee, ceci est redondant mais
-- -- utile en revue) :
-- select id, pro_grant_type, pro_grant_expires_at
--   from public.profiles
--   where pro_grant_type is not null
--     and pro_grant_type not in ('launch', 'vip');
-- ============================================================================
