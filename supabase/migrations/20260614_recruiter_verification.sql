-- ============================================================================
-- Migration : Credibilite recruteur — chantier 2 (bloc Credibilite & confiance)
-- À EXÉCUTER MANUELLEMENT dans le SQL Editor Supabase. Ne pas exécuter en auto.
--
-- Ajoute le workflow de re-verification de la DESCRIPTION PRO d'un recruteur,
-- sur le meme esprit que la moderation pending -> approved des films :
--   - bio_pending            : version EN ATTENTE de la description pro (la
--                              version PUBLIQUE validee reste le champ `bio`) ;
--   - recruiter_verified     : badge « recruteur verifie » (accorde par l'admin) ;
--   - recruiter_verified_at  : date d'octroi (audit) ;
--   - recruiter_review_status: statut de la modif sensible ('none'|'pending'|'rejected').
--
-- Decisions actees :
--   - les « films/credits revendiques » sont decrits en TEXTE LIBRE dans la bio
--     (option A) ; un champ structure dedie reste une evolution future ;
--   - une modif en attente NE met PAS le badge en pause (le public ne voit que la
--     version validee) ; seul un refus+revocation explicite ou une suspension le retire.
--
-- Champs anodins (avatar, localisation, liens, coordonnees) : publication directe,
-- hors de ce workflow.
-- ============================================================================

alter table public.profiles
  add column if not exists bio_pending text,
  add column if not exists recruiter_verified boolean not null default false,
  add column if not exists recruiter_verified_at timestamptz,
  add column if not exists recruiter_review_status text not null default 'none';

-- Statut de re-verification borne (TEXT libre sinon, comme la dette des autres
-- pseudo-enums — ici on pose un CHECK strict des le depart).
alter table public.profiles
  add constraint profiles_recruiter_review_status_check
  check (recruiter_review_status in ('none', 'pending', 'rejected'));

-- Retrouver vite les modifs sensibles a valider (back-office admin).
create index if not exists profiles_recruiter_review_pending_idx
  on public.profiles (recruiter_review_status)
  where recruiter_review_status = 'pending';

-- ============================================================================
-- Verifs post-execution suggérées :
--   select column_name from information_schema.columns
--     where table_name = 'profiles'
--       and column_name in ('bio_pending','recruiter_verified',
--                           'recruiter_verified_at','recruiter_review_status');
-- ============================================================================
