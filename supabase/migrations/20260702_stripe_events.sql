-- Idempotence des webhooks Stripe (audit fiabilité, 2026-07-02).
-- Un event.id Stripe déjà traité ne doit jamais être rejoué : le webhook
-- (api/billing/webhook) INSERT l'event.id ici AVANT toute écriture sur
-- profiles ; un doublon (23505) => réponse 200 sans traitement.
--
-- À exécuter MANUELLEMENT dans le SQL Editor Supabase.

create table if not exists public.stripe_events (
  id text primary key,                          -- Stripe event.id (evt_...)
  type text not null,                           -- event.type (audit/debug)
  received_at timestamptz not null default now()
);

-- RLS activée SANS aucune policy : table accessible uniquement via le
-- service role (même posture que rate_limits).
alter table public.stripe_events enable row level security;

comment on table public.stripe_events is
  'Idempotence des webhooks Stripe : event.id revendiqué avant traitement (api/billing/webhook).';
