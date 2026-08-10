-- ============================================================================
-- Recensement (SELECT SEUL) — commit 2 du chantier Pro grants
-- A EXECUTER MANUELLEMENT dans le SQL Editor Supabase. AUCUN UPDATE ici.
--
-- Objectif : lister tous les profils plan='pro' avec assez de contexte pour
-- decider, profil par profil, du reclassement retroactif vers le nouveau
-- modele (pro_grant_type/pro_grant_expires_at/pro_grant_granted_by/
-- pro_grant_granted_at — voir 20260810_pro_grants.sql, deja executee).
--
-- Le croisement cle : `admin_logs` garde la trace de l'action qui a rendu le
-- profil Pro (`set_pro` = cadeau discretionnaire, `approve_recruiter` = Pro
-- lie a l'approbation recruteur). C'est cette action, pas `pro_source` seule,
-- qui permet de distinguer retroactivement un Pro recruteur d'un Pro offert :
-- les deux portent aujourd'hui `pro_source='admin'` sans que rien d'autre ne
-- les separe (voir l'audit initial de ce chantier).
--
-- Rien n'est ecrit par ce fichier. Le backfill (commit 3, fichier separe) ne
-- sera redige qu'apres validation manuelle de la liste ci-dessous.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Requete principale
-- ----------------------------------------------------------------------------
-- Pour chaque profil Pro, on retient la ligne admin_logs la plus RECENTE parmi
-- {set_pro, approve_recruiter} ciblant ce profil (target_type='profile',
-- target_id=profil). Un profil peut ne matcher aucune ligne (Pro accorde par
-- un mecanisme hors de ces deux actions, ou log absent/purge) : il ressort
-- avec last_grant_action NULL et doit etre traite au cas par cas.
with relevant_logs as (
  select
    target_id,
    action,
    admin_id,
    created_at,
    row_number() over (
      partition by target_id
      order by created_at desc
    ) as rn
  from public.admin_logs
  where target_type = 'profile'
    and action in ('set_pro', 'approve_recruiter')
)
select
  p.id,
  p.full_name,
  u.email,
  p.pro_source,
  p.pro_since,
  p.account_type,
  p.recruiter_status,
  p.stripe_customer_id,
  l.action       as last_grant_action,
  l.admin_id     as last_grant_admin_id,
  admin_p.full_name as last_grant_admin_name,
  l.created_at   as last_grant_at,
  -- Suggestion INDICATIVE, pas une decision : a confirmer ligne par ligne
  -- avant d'ecrire le backfill. Reprend les regles arretees le 2026-08-10 :
  -- approve_recruiter -> grant 'recruiter' (jamais d'echeance) ; set_pro sans
  -- trace de recruteur -> grant 'vip' (les set_pro historiques sont des choix
  -- a la main avant lancement, imposer une echeance retroactive serait
  -- abusif) ; ni l'un ni l'autre -> a examiner manuellement (NULL ci-dessous).
  case
    when l.action = 'approve_recruiter' then 'recruiter'
    when l.action = 'set_pro' then 'vip'
    else null
  end as suggested_pro_grant_type
from public.profiles p
left join relevant_logs l
  on l.target_id = p.id and l.rn = 1
left join public.profiles admin_p
  on admin_p.id = l.admin_id
left join auth.users u
  on u.id = p.id
where p.plan = 'pro'
order by p.created_at asc nulls last;

-- ----------------------------------------------------------------------------
-- Requetes de controle — a lancer avant/apres lecture de la liste ci-dessus
-- ----------------------------------------------------------------------------

-- 1. Volume total de profils Pro (pour recouper avec le nombre de lignes
--    retournees par la requete principale — doit correspondre exactement).
-- select count(*) from public.profiles where plan = 'pro';

-- 2. Profils Pro SANS aucune trace admin_logs correspondante (last_grant_action
--    NULL dans la requete principale) — a examiner un par un avant le
--    backfill, ils ne rentrent dans aucune regle automatique.
-- with relevant_logs as (
--   select target_id, action, row_number() over (partition by target_id order by created_at desc) as rn
--   from public.admin_logs
--   where target_type = 'profile' and action in ('set_pro', 'approve_recruiter')
-- )
-- select p.id, p.full_name, p.pro_source, p.pro_since, p.account_type, p.recruiter_status
-- from public.profiles p
-- left join relevant_logs l on l.target_id = p.id and l.rn = 1
-- where p.plan = 'pro' and l.target_id is null;

-- 3. Profils avec pro_source='stripe' parmi les Pro actuels (cas theorique,
--    webhook jamais actif en prod a ce jour — ne doivent PAS entrer dans le
--    backfill grant, leurs colonnes stripe_* suffisent deja).
-- select id, full_name, pro_source, stripe_customer_id, subscription_status
--   from public.profiles
--   where plan = 'pro' and pro_source = 'stripe';

-- 4. Doublons potentiels : un profil avec a la fois un log approve_recruiter
--    ET un log set_pro (le plus recent des deux gagne dans la requete
--    principale via row_number(), mais utile de voir l'historique complet
--    pour trancher un cas ambigu).
-- select target_id, action, admin_id, created_at
--   from public.admin_logs
--   where target_type = 'profile' and action in ('set_pro', 'approve_recruiter')
--   order by target_id, created_at desc;
-- ============================================================================
