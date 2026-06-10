-- ============================================================================
-- Migration : rate limiting des endpoints publics (S3)
-- À EXÉCUTER MANUELLEMENT dans le SQL Editor Supabase. Ne pas exécuter en auto.
--
-- Contexte : /api/signup, /api/contact, /api/waitlist sont publics et sans
-- limite → abusables en masse (création de comptes en boucle, spam, etc.).
-- On implémente une limite par clé (ex. "signup:<ip>") via une table + une RPC
-- atomique. Tant que cette migration n'est pas exécutée, le helper côté app
-- "fail-open" (ne bloque personne) — donc déployable sans casse.
-- ============================================================================

create table if not exists public.rate_limits (
  key          text primary key,
  count        integer not null default 0,
  window_start timestamptz not null default now()
);

-- RLS : table interne, accessible uniquement via la RPC SECURITY DEFINER
-- et le service_role. On bloque tout accès direct anon/authenticated.
alter table public.rate_limits enable row level security;

-- Incrémente atomiquement le compteur de la clé pour la fenêtre courante.
-- Retourne TRUE si la requête est AUTORISÉE (sous la limite), FALSE sinon.
create or replace function public.check_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into rate_limits (key, count, window_start)
    values (p_key, 1, now())
  on conflict (key) do update
    set
      count = case
        when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
          then 1
        else rate_limits.count + 1
      end,
      window_start = case
        when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
          then now()
        else rate_limits.window_start
      end
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

-- Seul le service_role (utilisé par les routes API) peut appeler la RPC.
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
