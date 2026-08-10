-- ============================================================================
-- Migration : Pro offert (grants admin) decouple de l'abonnement Stripe
-- A EXECUTER MANUELLEMENT dans le SQL Editor Supabase. Ne pas executer en auto.
--
-- IDEMPOTENCE : ce fichier peut etre rejoue plusieurs fois sans effet de bord
-- (meme esprit que 20260731_profiles_column_grants.sql). Les ADD COLUMN IF NOT
-- EXISTS, CREATE INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION et REVOKE/GRANT
-- sont nativement idempotents. Postgres ne supporte PAS "ADD CONSTRAINT IF NOT
-- EXISTS" : les 4 contraintes sont donc chacune enveloppees dans un bloc DO qui
-- verifie pg_constraint avant d'ajouter, pour obtenir la meme garantie.
--
-- Contexte : l'ancien modele (`pro_source` = 'admin' | 'stripe' | null) melange
-- trois informations (pourquoi / jusqu'a quand / qui) dans une seule colonne, et
-- son garde-fou webhook ("si pro_source='admin', ne jamais toucher plan") est
-- INCONDITIONNEL : un profil offert par l'admin qui souscrit ensuite via Stripe
-- paie mais reste etiquete 'admin' et ne peut plus jamais etre retrograde, meme
-- apres resiliation. Un clic accidentel de set_pro sur un abonne payant ecrase
-- pro_source='stripe' -> 'admin' et immunise le compte definitivement.
--
-- Nouveau modele : deux sources de Pro INDEPENDANTES et cumulables.
--   - Stripe (colonnes existantes stripe_customer_id / stripe_subscription_id /
--     subscription_status / current_period_end) : souverain, ecrit par le
--     webhook SANS jamais consulter le grant.
--   - Grant offert (les 5 colonnes ci-dessous) : ecrit par l'admin, avec une
--     nature explicite (launch/vip/recruiter) et une echeance qui depend de
--     cette nature.
--   - `plan` reste la porte effective lue partout dans le code (inchange), mais
--     devient une valeur DERIVEE : plan='pro' <=> abonnement Stripe actif OU
--     grant valide. Le calcul est centralise dans la fonction recompute_plan()
--     ci-dessous, seule autorisee a ecrire `plan`/`pro_since` desormais.
--
-- `pro_source` est GELEE par cette migration : plus jamais ecrite ni lue par le
-- code applicatif a partir du commit qui suit cette migration. Colonne
-- CONSERVEE (pas de DROP) — suppression prevue dans un commit dedie, apres le
-- lancement, une fois repo et prod realignes.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Colonnes du grant
-- ----------------------------------------------------------------------------
--
-- pro_grant_granted_by en ON DELETE SET NULL (pas de valeur par defaut = RESTRICT
-- implicite, qui aurait rendu un admin ayant deja accorde un grant INDELETABLE
-- de auth.users — la cascade de suppression d'un compte admin se serait bloquee
-- sur cette FK). Consequence acceptee : la tracabilite "qui a accorde ce grant"
-- peut redevenir NULL si l'admin est supprime. admin_logs reste la source
-- d'audit complete et n'est pas affectee (elle stocke admin_id independamment
-- au moment de l'action, ligne d'audit immuable).
alter table public.profiles
  add column if not exists pro_grant_type            text,        -- 'launch' | 'vip' | 'recruiter' | null
  add column if not exists pro_grant_expires_at       timestamptz, -- NULL = sans echeance (regles par type, voir CHECK)
  add column if not exists pro_grant_granted_by       uuid references public.profiles(id) on delete set null,
  add column if not exists pro_grant_granted_at       timestamptz,
  add column if not exists pro_grant_reminder_sent_at timestamptz; -- rappel J-7 envoye (idempotence du cron)

comment on column public.profiles.pro_grant_type is
  'Nature du Pro offert par admin. launch = cadeau de lancement, echeance obligatoire (defaut 1 an). vip = choix explicite, echeance libre (null = a vie, date = longue duree possible). recruiter = lie au statut recruteur approuve, jamais d''echeance (retire uniquement par revoke_recruiter_approval). NULL = aucun grant.';
comment on column public.profiles.pro_grant_expires_at is
  'Echeance du grant. Regles imposees par le CHECK profiles_pro_grant_expiry_check : launch => obligatoire, recruiter => interdite (NULL strict), vip => libre. A l''expiration, le cron (commit 5) recompute plan mais NE SUPPRIME PAS ces colonnes : elles restent en base comme temoin (ex: "Free - ex-lancement, expire le X").';
comment on column public.profiles.pro_grant_granted_by is
  'Admin (profiles.id) ayant accorde le grant. ON DELETE SET NULL : redevient NULL si l''admin est supprime, pour ne jamais bloquer cette suppression. admin_logs (details JSONB) reste la source d''audit complete et n''est pas affectee par cette nullification ; cette colonne n''est qu''une lecture rapide sans jointure sur les logs.';
comment on column public.profiles.pro_grant_granted_at is
  'Date d''octroi du grant. Distincte de pro_since (premiere acquisition Pro toutes sources confondues, jamais reinitialisee).';
comment on column public.profiles.pro_grant_reminder_sent_at is
  'Horodatage du dernier email de rappel J-7 envoye avec succes. Le cron ne doit JAMAIS poser cette colonne si l''envoi Resend a echoue (ou si RESEND_API_KEY est absente) — sinon le rappel est marque envoye sans l''avoir ete, et ne repart jamais.';

-- ----------------------------------------------------------------------------
-- 2. Contraintes — l'absence d'echeance doit etre un choix trace, pas un oubli
-- ----------------------------------------------------------------------------

-- Enumeration stricte.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_pro_grant_type_check'
  ) then
    alter table public.profiles
      add constraint profiles_pro_grant_type_check
      check (pro_grant_type is null or pro_grant_type in ('launch', 'vip', 'recruiter'));
  end if;
end $$;

-- Coherence : type et granted_at sont renseignes ensemble ou absents ensemble
-- (type null <=> granted_at null). Empeche un grant "fantome" (type pose sans
-- date d'octroi, ou l'inverse). granted_by est volontairement EXCLU de cette
-- regle : sa nullabilite ON DELETE SET NULL (voir section 1) doit rester
-- possible sur un grant par ailleurs valide et renseigne — sinon la suppression
-- de l'admin casserait aussi cette contrainte, pas seulement la FK.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_pro_grant_identity_check'
  ) then
    alter table public.profiles
      add constraint profiles_pro_grant_identity_check
      check (
        (pro_grant_type is null and pro_grant_granted_at is null)
        or
        (pro_grant_type is not null and pro_grant_granted_at is not null)
      );
  end if;
end $$;

-- Regle d'echeance PAR NATURE (arbitrages du 2026-08-10) :
--   - launch    : echeance OBLIGATOIRE (un cadeau de lancement sans date est
--                 refuse par la base — pas de decouverte tardive d'un Pro a vie
--                 non voulu).
--   - vip       : echeance LIBRE (null = a vie ; une date reste possible pour
--                 un VIP a duree longue mais determinee, ex. 5 ans).
--   - recruiter : echeance INTERDITE (NULL strict) — le grant recruiter est
--                 lie au statut recruteur approuve, jamais au temps ; il ne
--                 peut etre retire QUE par revoke_recruiter_approval (commit 3).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_pro_grant_expiry_check'
  ) then
    alter table public.profiles
      add constraint profiles_pro_grant_expiry_check
      check (
        pro_grant_type is null
        or (pro_grant_type = 'launch' and pro_grant_expires_at is not null)
        or (pro_grant_type = 'vip')  -- expires_at libre, null ou date
        or (pro_grant_type = 'recruiter' and pro_grant_expires_at is null)
      );
  end if;
end $$;

-- Le rappel n'a de sens que sur un grant a echeance.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_pro_grant_reminder_check'
  ) then
    alter table public.profiles
      add constraint profiles_pro_grant_reminder_check
      check (pro_grant_reminder_sent_at is null or pro_grant_expires_at is not null);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Index — balayage cron (commit 5)
-- ----------------------------------------------------------------------------

-- Index partiel : ne couvre QUE les grants a echeance (launch, potentiellement
-- vip a duree determinee). Le cron DOIT filtrer sur pro_grant_expires_at et ne
-- jamais faire de balayage/recompute global sur toute la table `profiles` —
-- seule la lecture de cet index doit piloter son travail.
create index if not exists profiles_pro_grant_expiry_idx
  on public.profiles (pro_grant_expires_at)
  where pro_grant_type is not null and pro_grant_expires_at is not null;

-- ----------------------------------------------------------------------------
-- 4. RPC recompute_plan — seule fonction autorisee a ecrire plan/pro_since
-- ----------------------------------------------------------------------------
--
-- SECURITY DEFINER : necessaire pour ecrire `plan`/`pro_since` independamment
-- des policies RLS de `profiles` (lecture publique restreinte, ecriture
-- reservee au service role — voir 20260731_profiles_column_grants.sql). La
-- fonction ne lit AUCUNE colonne ni parametre implicite lie a l'appelant
-- (pas de current_user, pas de auth.uid(), pas de current_setting) : toute sa
-- logique porte exclusivement sur la ligne `profiles` designee par p_profile_id
-- en parametre explicite. Elle n'etablit donc aucune identite au sens ou le
-- ferait un trigger qui lirait current_user pour distinguer un appelant d'un
-- autre.
--
-- ATTENTION — DEPENDANCE CROISEE avec guard_profiles_system_columns (trigger
-- sur profiles, hors perimetre de cette migration, verrouille 20 colonnes
-- systeme dont `plan`, passe SECURITY INVOKER le 07/08/2026, exempte les roles
-- avec rolbypassrls) : ce trigger determine current_user au moment ou il
-- s'execute, PENDANT l'UPDATE lance par cette fonction. Comme recompute_plan
-- est SECURITY DEFINER, current_user a l'interieur de son corps (et donc pour
-- le trigger qu'elle declenche) vaut le PROPRIETAIRE de la fonction, pas
-- l'appelant reel (le service role applicatif). Si ce proprietaire n'est PAS
-- postgres ou un role avec rolbypassrls, guard_profiles_system_columns va
-- silencieusement RESTAURER l'ancienne valeur de `plan` apres l'UPDATE — la
-- RPC semblera reussir (aucune erreur levee) mais n'aura aucun effet. Voir la
-- requete de verification sur proowner en bas de fichier : a executer et a
-- lire AVANT de considerer cette migration terminee.
--
-- Regle : plan='pro' <=> abonnement Stripe actif (subscription_status dans la
-- meme liste que PRO_STATUSES cote webhook : active/trialing/past_due) OU
-- grant offert valide (pro_grant_type non null ET (pro_grant_expires_at est
-- null OU pro_grant_expires_at > now())). Un grant expire NE COMPTE PAS mais
-- ses colonnes restent en base (voir commentaire pro_grant_expires_at).
--
-- pro_since : posee a la premiere acquisition Pro, jamais reinitialisee tant
-- que le profil reste Pro en continu (meme comportement qu'aujourd'hui).
create or replace function public.recompute_plan(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription_status text;
  v_grant_type          text;
  v_grant_expires_at    timestamptz;
  v_pro_since           timestamptz;
  v_stripe_active       boolean;
  v_grant_valid         boolean;
  v_should_be_pro       boolean;
begin
  select subscription_status, pro_grant_type, pro_grant_expires_at, pro_since
    into v_subscription_status, v_grant_type, v_grant_expires_at, v_pro_since
  from public.profiles
  where id = p_profile_id
  for update; -- verrou ligne : serialise webhook et actions admin concurrents

  if not found then
    return; -- profil inconnu : rien a faire, pas d'erreur (coherent avec le webhook qui ignore un customer inconnu)
  end if;

  -- coalesce(..., '') rend explicite l'intention : `in (...)` sur une valeur
  -- NULL renvoie NULL (ni vrai ni faux), et `v_stripe_active := NULL` aurait
  -- ete traite comme faux par le `or` de v_should_be_pro plus bas — correct
  -- par accident du comportement ternaire de Postgres, pas par construction.
  v_stripe_active := coalesce(v_subscription_status, '') in ('active', 'trialing', 'past_due');
  v_grant_valid := v_grant_type is not null and (v_grant_expires_at is null or v_grant_expires_at > now());
  v_should_be_pro := v_stripe_active or v_grant_valid;

  if v_should_be_pro then
    update public.profiles
      set plan = 'pro',
          pro_since = coalesce(v_pro_since, now())
      where id = p_profile_id;
  else
    update public.profiles
      set plan = 'free'
      where id = p_profile_id;
  end if;
end;
$$;

-- Seul le service_role (routes API : webhook, admin, cron) peut appeler la RPC.
-- Meme posture que check_rate_limit (20260610_rate_limits.sql).
revoke all on function public.recompute_plan(uuid) from public, anon, authenticated;
grant execute on function public.recompute_plan(uuid) to service_role;

commit;

-- ============================================================================
-- Verifications suggerees APRES execution :
--
-- -- Colonnes creees, avec leurs contraintes :
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_name = 'profiles'
--     and column_name like 'pro_grant_%'
--   order by column_name;
--
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.profiles'::regclass
--     and conname like 'profiles_pro_grant%';
--
-- -- Index partiel present :
-- select indexname, indexdef
--   from pg_indexes
--   where tablename = 'profiles' and indexname = 'profiles_pro_grant_expiry_idx';
--
-- -- RPC presente, privileges corrects (doit renvoyer UNE ligne, service_role
-- -- seul en EXECUTE) :
-- select routine_name, security_type
--   from information_schema.routines
--   where routine_name = 'recompute_plan';
--
-- select grantee, privilege_type
--   from information_schema.routine_privileges
--   where routine_name = 'recompute_plan';
--
-- -- CRITIQUE — proprietaire de la RPC (voir commentaire section 4) : recompute_plan
-- -- ecrit `plan`, une des 20 colonnes systeme verrouillees par le trigger
-- -- guard_profiles_system_columns. Ce trigger est SECURITY INVOKER depuis le
-- -- 07/08/2026 et exempte les roles avec rolbypassrls. recompute_plan est
-- -- SECURITY DEFINER : current_user a l'interieur vaut son PROPRIETAIRE (owner),
-- -- pas l'appelant. Si owner n'a PAS rolbypassrls (et n'est pas postgres), le
-- -- trigger restaure `plan` a son ancienne valeur juste apres l'UPDATE : la RPC
-- -- rend la main sans erreur mais plan ne bouge jamais. Executer et LIRE avant
-- -- de considerer cette migration terminee :
-- select p.proname, p.proowner::regrole as owner, p.prosecdef,
--        r.rolbypassrls
--   from pg_proc p
--   join pg_roles r on r.oid = p.proowner
--   where p.proname = 'recompute_plan';
-- -- attendu : rolbypassrls = true (ou owner = postgres). Si faux, reassigner le
-- -- propriétaire de la fonction avant de brancher le moindre code dessus :
-- --   alter function public.recompute_plan(uuid) owner to postgres;
--
-- -- Cette migration est INERTE tant qu'aucun code applicatif n'appelle
-- -- recompute_plan() ou ne lit pro_grant_* : verifier qu'aucun profil existant
-- -- n'est affecte (doit renvoyer 0 lignes) :
-- select id, plan, pro_source, pro_grant_type
--   from public.profiles
--   where pro_grant_type is not null;
-- ============================================================================
