-- ============================================================================
-- Migration : liaison Stripe (abonnement Pro) — chantier 7
-- À EXÉCUTER MANUELLEMENT dans le SQL Editor Supabase. Ne pas exécuter en auto.
--
-- Objectif : permettre de souscrire le Pro via Stripe Checkout (mode TEST d'abord).
-- `plan` ('free'/'pro') + `pro_since` RESTENT la porte effective lue partout dans
-- le code ; ces colonnes ne font QUE relier le profil à son abonnement Stripe.
--
-- Principes (chantier 7) :
--   - AUCUNE donnée de carte stockée — uniquement des IDs Stripe.
--   - Le webhook Stripe est la SEULE source de vérité pour accorder/retirer le Pro.
--   - Garde-fou : `pro_source` distingue un Pro 'admin' (manuel, à vie) d'un Pro
--     'stripe' (abonnement payé). Un webhook ne retrouve un profil que par
--     `stripe_customer_id` → un Pro manuel (sans customer Stripe) n'est JAMAIS
--     écrasé/rétrogradé. De plus, le webhook ne rétrograde jamais `pro_source='admin'`.
-- ============================================================================

alter table public.profiles
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status    text,        -- statut Stripe brut : active/trialing/past_due/canceled/unpaid/incomplete...
  add column if not exists current_period_end      timestamptz, -- fin de période payée (info portail / relance)
  add column if not exists pro_source              text;        -- 'stripe' | 'admin' | null

-- Un customer Stripe = un profil au plus. Retrouve vite un profil depuis un webhook.
create unique index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id) where stripe_customer_id is not null;

create index if not exists profiles_stripe_subscription_id_idx
  on public.profiles (stripe_subscription_id) where stripe_subscription_id is not null;

-- ============================================================================
-- Note : pas de CHECK sur subscription_status (valeurs Stripe brutes, stockées
-- telles quelles). pro_source pourrait recevoir un CHECK ('stripe','admin') plus
-- tard ; laissé libre pour l'instant (cohérent avec les autres pseudo-enums).
--
-- Vérifs post-exécution suggérées :
--   select column_name from information_schema.columns
--     where table_name='profiles'
--       and column_name in ('stripe_customer_id','stripe_subscription_id',
--                           'subscription_status','current_period_end','pro_source');
-- ============================================================================
