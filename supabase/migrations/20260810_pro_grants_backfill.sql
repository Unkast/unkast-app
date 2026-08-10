-- ============================================================================
-- Backfill (2 profils) — commit 3 du chantier Pro grants
-- A EXECUTER MANUELLEMENT dans le SQL Editor Supabase.
--
-- Fait suite au recensement (20260810_pro_grants_recensement.sql), valide
-- manuellement le 2026-08-10 : 2 profils plan='pro' en base, tous deux
-- reclasses vers le nouveau modele grant (colonnes posees par
-- 20260810_pro_grants.sql, deja executee ; RPC recompute_plan verifiee,
-- owner postgres, security definer).
--
-- Ids en dur, IMPOSSIBLE A REJOUER SUR UN AUTRE ENVIRONNEMENT sans relire
-- le recensement de cet environnement. Ne pas versionner ce fichier comme un
-- modele generique.
--
-- Ce fichier N'APPELLE PAS recompute_plan() : les deux profils sont deja
-- plan='pro', et le backfill ne fait que documenter retroactivement le
-- POURQUOI de ce plan='pro' existant, sans changer sa valeur. recompute_plan()
-- entre en jeu a partir du commit suivant (webhook/actions admin migrees),
-- pour tout changement D'ETAT futur.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Chloe Bernard — grant 'vip', sans echeance
-- ----------------------------------------------------------------------------
-- Log admin_logs le plus recent sur ce profil : set_pro. Regle arretee le
-- 2026-08-10 : un set_pro historique sans trace de recruteur devient 'vip'
-- (choix discretionnaire de l'admin avant lancement ; imposer une echeance
-- retroactive serait abusif). granted_by identifie precisement l'admin
-- (4c4dcd81…, qui est elle-meme le 2e profil ci-dessous) car la ligne
-- admin_logs correspondante existe et porte cet admin_id.
update public.profiles
set
  pro_grant_type      = 'vip',
  pro_grant_expires_at = null,
  pro_grant_granted_by = '4c4dcd81-e9af-4fda-a4b4-648a9f456d8e',
  pro_grant_granted_at = '2026-08-07 13:46:07.253516+00'
where id = 'a1000000-0000-0000-0000-000000000002'
  and plan = 'pro'; -- garde-fou : n'ecrit que si l'etat recense tient encore

-- ----------------------------------------------------------------------------
-- 2. Maxime Benalikhoudja — grant 'recruiter', sans echeance (CHECK strict)
-- ----------------------------------------------------------------------------
-- pro_grant_granted_by est laisse NULL volontairement, PAS UNE ANOMALIE :
-- aucune ligne admin_logs (action approve_recruiter ou set_pro) ne cible ce
-- profil — son statut Pro/recruteur est ANTERIEUR a la mise en place de la
-- journalisation admin_logs (pro_since = 2026-06-14, la table admin_logs est
-- posterieure). Il n'existe donc structurellement aucune tracabilite "qui a
-- accorde" a retrouver pour cette ligne, et il serait faux d'inventer un
-- admin_id par convention (ex. le profil lui-meme) pour remplir la colonne.
-- Le CHECK profiles_pro_grant_identity_check (20260810_pro_grants.sql) ne
-- porte QUE sur (pro_grant_type, pro_grant_granted_at) — granted_by en est
-- explicitement exclu depuis la correction du 2026-08-10 (ON DELETE SET NULL
-- sur la FK) — donc ce NULL est accepte par la base sans exception a poser.
-- pro_grant_expires_at reste NULL par contrainte CHECK profiles_pro_grant_
-- expiry_check (recruiter => NULL strict), coherent avec le fait que ce grant
-- est lie au statut recruteur approuve, pas au temps.
update public.profiles
set
  pro_grant_type      = 'recruiter',
  pro_grant_expires_at = null,
  pro_grant_granted_by = null,
  pro_grant_granted_at = '2026-06-14 13:58:30.747737+00'
where id = '4c4dcd81-e9af-4fda-a4b4-648a9f456d8e'
  and plan = 'pro';

commit;

-- ============================================================================
-- Verifications suggerees APRES execution :
--
-- -- 1. Les deux lignes portent exactement les valeurs attendues.
-- select id, full_name, plan, pro_source, pro_since,
--        pro_grant_type, pro_grant_expires_at,
--        pro_grant_granted_by, pro_grant_granted_at
--   from public.profiles
--   where id in ('a1000000-0000-0000-0000-000000000002',
--                '4c4dcd81-e9af-4fda-a4b4-648a9f456d8e');
--
-- -- 2. Aucune autre ligne n'a ete touchee par erreur (doit renvoyer 2).
-- select count(*) from public.profiles where pro_grant_type is not null;
--
-- -- 3. CRITIQUE — plus aucun plan='pro' sans grant valide NI abonnement
-- -- Stripe actif. Doit renvoyer 0 lignes : tout profil Pro doit desormais
-- -- etre explique par l'une des deux sources (la RPC recompute_plan() ne
-- -- sera appelee qu'a partir du prochain commit — cette requete verifie donc
-- -- l'etat DECLARATIF pose par ce backfill, pas encore un recalcul reel).
-- select id, full_name, plan, pro_source, subscription_status,
--        pro_grant_type, pro_grant_expires_at
--   from public.profiles
--   where plan = 'pro'
--     and coalesce(subscription_status, '') not in ('active', 'trialing', 'past_due')
--     and (
--       pro_grant_type is null
--       or (pro_grant_expires_at is not null and pro_grant_expires_at <= now())
--     );
--
-- -- 4. Coherence CHECK (doit renvoyer 0 lignes sur les deux — confirme que
-- -- les contraintes posees par 20260810_pro_grants.sql acceptent bien ces
-- -- deux lignes sans exception ; si l'UPDATE ci-dessus est passe, ceci est
-- -- redondant mais utile en revue).
-- select id, pro_grant_type, pro_grant_expires_at
--   from public.profiles
--   where id in ('a1000000-0000-0000-0000-000000000002',
--                '4c4dcd81-e9af-4fda-a4b4-648a9f456d8e')
--     and (
--       (pro_grant_type = 'recruiter' and pro_grant_expires_at is not null)
--       or (pro_grant_type = 'launch' and pro_grant_expires_at is null)
--     );
-- ============================================================================
