-- ============================================================================
-- Migration : Recrutement « Je recrute / Disponible » — chantier 2 (structure)
-- À EXÉCUTER MANUELLEMENT dans le SQL Editor Supabase. Ne pas exécuter en auto.
--
-- Crée les 4 tables du recrutement (conception validée, voir docs/ROADMAP.md) :
--   1. availability_signals   — le signal « Disponible » (talent × poste × recruteur)
--   2. recruiter_folders      — les dossiers-films privés du recruteur
--   3. folder_candidates      — le rangement (quel candidat dans quel dossier)
--   4. recruiter_dismissals   — l'écartement silencieux (par poste)
--
-- Garanties RLS :
--   - le talent ne voit JAMAIS les dossiers d'un recruteur ni qu'il a été écarté
--     (tables 2/3/4 sans aucune policy SELECT côté talent → invisibilité structurelle) ;
--   - le recruteur ne voit que SES signaux reçus, SES dossiers, SES écartements.
--
-- Rappels de conception (arbitrages actés) :
--   - signaux orphelins : laissés expirer seuls (pas d'invalidation) ;
--   - écartement PAR POSTE (recruteur × talent × rôle) ;
--   - peut se signaler : tout compte NON-recruteur (talent OU creator) ; cible =
--     recruteur is_recruiting=true + plan 'pro' + rôle ∈ recruiting_roles
--     (garde-fou RLS ci-dessous, en plus du contrôle applicatif) ;
--   - Pro ↔ Pro : OUVERT en base (masqué dans l'UI seulement, pas de blocage RLS) ;
--   - expirés : on garde et on filtre (expires_at > now()), pas de purge.
--
-- Hypothèse : public.profiles est lisible (SELECT) par les utilisateurs
-- authentifiés — les sous-requêtes de validation ci-dessous en dépendent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. availability_signals — les signaux de disponibilité
-- ----------------------------------------------------------------------------
create table if not exists public.availability_signals (
  id           uuid primary key default gen_random_uuid(),
  talent_id    uuid not null references public.profiles(id) on delete cascade,
  recruiter_id uuid not null references public.profiles(id) on delete cascade,
  role         text not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '30 days'),

  -- un seul signal vivant par (talent, recruteur, poste) :
  -- se re-signaler / prolonger = UPDATE de cette ligne, jamais un doublon.
  constraint availability_signals_unique unique (talent_id, recruiter_id, role),
  -- on ne se signale pas soi-même.
  constraint availability_signals_not_self check (talent_id <> recruiter_id)
);

-- « tous les signaux reçus par un recruteur, par poste, non expirés » :
create index if not exists availability_signals_recruiter_role_exp_idx
  on public.availability_signals (recruiter_id, role, expires_at);

alter table public.availability_signals enable row level security;

-- SELECT : le talent revoit ses propres signaux ; le recruteur lit ceux qui le visent.
create policy availability_signals_select
  on public.availability_signals for select to authenticated
  using (talent_id = auth.uid() or recruiter_id = auth.uid());

-- INSERT : le talent crée SON signal ; garde-fou cible (recruteur recrutant + Pro
-- + rôle proposé) et émetteur non-recruteur.
create policy availability_signals_insert
  on public.availability_signals for insert to authenticated
  with check (
    talent_id = auth.uid()
    and talent_id <> recruiter_id
    and exists (
      select 1 from public.profiles s
      where s.id = auth.uid()
        and coalesce(s.account_type, 'talent') <> 'recruiter'
    )
    and exists (
      select 1 from public.profiles r
      where r.id = recruiter_id
        and r.is_recruiting = true
        and r.plan = 'pro'
        and role = any (r.recruiting_roles)
    )
  );

-- UPDATE : prolongation par le talent (bump expires_at). Volontairement on ne
-- re-vérifie PAS la cible ici : prolonger ne doit jamais échouer si le recruteur
-- a entre-temps changé d'état — le signal expirera seul (arbitrage « orphelins »).
create policy availability_signals_update
  on public.availability_signals for update to authenticated
  using (talent_id = auth.uid())
  with check (talent_id = auth.uid());

-- DELETE : le talent retire son signal.
create policy availability_signals_delete
  on public.availability_signals for delete to authenticated
  using (talent_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. recruiter_folders — les dossiers-films privés du recruteur
-- ----------------------------------------------------------------------------
create table if not exists public.recruiter_folders (
  id           uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists recruiter_folders_recruiter_idx
  on public.recruiter_folders (recruiter_id);

alter table public.recruiter_folders enable row level security;

-- Un seul ayant droit : le recruteur propriétaire. Aucun accès talent → invisible.
create policy recruiter_folders_all
  on public.recruiter_folders for all to authenticated
  using (recruiter_id = auth.uid())
  with check (recruiter_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. folder_candidates — le rangement (dispatch)
-- ----------------------------------------------------------------------------
create table if not exists public.folder_candidates (
  id         uuid primary key default gen_random_uuid(),
  folder_id  uuid not null references public.recruiter_folders(id) on delete cascade,
  talent_id  uuid not null references public.profiles(id) on delete cascade,
  role       text not null,
  -- provenance optionnelle ; un candidat rangé reste rangé même si son signal
  -- expire (snapshot talent_id + role), d'où ON DELETE SET NULL.
  signal_id  uuid references public.availability_signals(id) on delete set null,
  added_at   timestamptz not null default now(),

  -- pas de doublon du même candidat/poste dans un même film.
  constraint folder_candidates_unique unique (folder_id, talent_id, role)
);

create index if not exists folder_candidates_folder_idx
  on public.folder_candidates (folder_id);
create index if not exists folder_candidates_talent_idx
  on public.folder_candidates (talent_id);

alter table public.folder_candidates enable row level security;

-- Accès gated par la propriété du dossier parent → recruteur uniquement.
-- Aucun accès talent → un talent ne sait jamais qu'il est rangé.
create policy folder_candidates_all
  on public.folder_candidates for all to authenticated
  using (
    exists (
      select 1 from public.recruiter_folders f
      where f.id = folder_id and f.recruiter_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.recruiter_folders f
      where f.id = folder_id and f.recruiter_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 4. recruiter_dismissals — l'écartement silencieux (par poste)
-- ----------------------------------------------------------------------------
create table if not exists public.recruiter_dismissals (
  id           uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles(id) on delete cascade,
  talent_id    uuid not null references public.profiles(id) on delete cascade,
  role         text not null,
  created_at   timestamptz not null default now(),

  constraint recruiter_dismissals_unique unique (recruiter_id, talent_id, role)
);

-- pour calculer « liste à traiter d'un poste = signaux MINUS écartements ».
create index if not exists recruiter_dismissals_recruiter_role_idx
  on public.recruiter_dismissals (recruiter_id, role);

alter table public.recruiter_dismissals enable row level security;

-- Recruteur uniquement, toutes opérations. AUCUNE policy SELECT côté talent :
-- c'est ce qui garantit STRUCTURELLEMENT que le talent ne sait jamais qu'il a
-- été écarté (impossible avec une simple colonne sur availability_signals,
-- ligne que le talent a le droit de lire).
create policy recruiter_dismissals_all
  on public.recruiter_dismissals for all to authenticated
  using (recruiter_id = auth.uid())
  with check (recruiter_id = auth.uid());

-- ============================================================================
-- Fin de migration. Vérifs post-exécution suggérées :
--   select tablename, rowsecurity from pg_tables
--     where tablename in ('availability_signals','recruiter_folders',
--                         'folder_candidates','recruiter_dismissals');
--   -- rowsecurity doit être true partout.
--   select polname, tablename from pg_policies
--     where tablename in ('availability_signals','recruiter_folders',
--                         'folder_candidates','recruiter_dismissals');
-- ============================================================================
