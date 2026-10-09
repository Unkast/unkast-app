-- =============================================================================
-- Filmographie : films ou une personne est creditee, vus par un visiteur
-- =============================================================================
--
-- POURQUOI CE FICHIER (decisions de Maxime, 09/10/2026)
-- La fiche d'une personne affiche aussi les films ou elle est creditee, plus
-- seulement ceux dont elle est Responsable. Un membre connecte les lit deja par
-- la RLS (project_credits, projects). Un visiteur non connecte ne lit aucune
-- ligne de project_credits : il passe par les deux fonctions ci-dessous.
-- S'applique APRES 20261008_film_management.sql et
-- 20261010_film_poster_and_member_teasers.sql.
--
-- CE QU'IL FAIT
--   A. public_profile_film_roles : role de la personne sur TOUS les films
--      publics ou elle est creditee (avant : seulement ceux dont elle est
--      Responsable). Type de retour inchange.
--   B. member_only_film_teasers : avec p_profile_id, renvoie aussi les films
--      « membres seulement » ou la personne est creditee. Deux colonnes en plus :
--      role_on_project (son role, pour la carte verrouillee) et is_responsible
--      (filtre Publies / Credite). Le type de retour change : la fonction est
--      supprimee puis recreee.
--   Les deux ne renvoient rien pour un profil non approuve ou suspendu.
--
-- DECISION PRODUIT
-- Le masquage des credits pour un visiteur est leve SUR LA FICHE DE LA PERSONNE
-- uniquement : son nom y est deja public, on y lit donc son role sur chaque
-- film. Sur la page d'un film, public_project_credits est inchangee : initiales
-- pour tout credit hors realisation. Aucune de ces fonctions ne renvoie de nom.
--
-- CE QU'IL NE FAIT PAS
--   - Aucune table, colonne, policy ou donnee n'est modifiee.
--   - Un credit n'existe dans project_credits qu'une fois accepte : les demandes
--     et invitations en attente (credit_requests, project_invitations) ne sont
--     pas lues.
--
-- ORDRE DE MISE EN SERVICE
-- A executer JUSTE AVANT de deployer le code correspondant. Sans ce fichier, le
-- nouveau code fonctionne : un visiteur voit seulement les films publies par la
-- personne, comme avant. Avec ce fichier et l'ancien code : l'ancienne fiche
-- ignore les lignes en plus de A ; pour B, elle afficherait en carte verrouillee
-- les films membres ou la personne est creditee, d'ou l'ordre conseille.
--
-- Rollback : 20261013_profile_filmography_rollback.sql
-- =============================================================================

begin;

-- ---- A. Role de la personne sur les films publics ou elle est creditee --------
create or replace function public.public_profile_film_roles(p_profile_id uuid)
returns table (
  credit_id       uuid,
  project_id      uuid,
  role_on_project text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.project_id, c.role_on_project
  from public.project_credits c
  join public.profiles pr on pr.id = c.profile_id
  where c.profile_id = p_profile_id
    and pr.status = 'approved'
    and pr.is_suspended is not true
    and public.is_project_public(c.project_id);
$$;

revoke all on function public.public_profile_film_roles(uuid) from public;
grant execute on function public.public_profile_film_roles(uuid) to anon, authenticated, service_role;

-- ---- B. Carte verrouillee d'un film « membres seulement » ----------------------
-- Un des deux filtres est obligatoire (sinon rien) : pas de liste de tous les
-- films reserves aux membres.
--   p_slug       : le film ouvert par son lien direct
--   p_profile_id : les films dont cette personne est Responsable ou ou elle est
--                  creditee (sa fiche). Son profil doit etre approuve et non
--                  suspendu.
-- Film approuve, visibilite 'members', Responsable au profil approuve et non
-- suspendu. role_on_project n'est rempli qu'avec p_profile_id (plusieurs
-- credits : reunis par une virgule).
drop function if exists public.member_only_film_teasers(text, uuid);

create function public.member_only_film_teasers(
  p_slug       text default null,
  p_profile_id uuid default null
)
returns table (
  id              uuid,
  slug            text,
  title           text,
  poster_url      text,
  year            integer,
  role_on_project text,
  is_responsible  boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.slug, p.title, p.poster_url, p.year,
         r.role_on_project,
         p_profile_id is not null and p.profile_id = p_profile_id
  from public.projects p
  join public.profiles pr on pr.id = p.profile_id
  left join lateral (
    select string_agg(c.role_on_project, ', ' order by c.id) as role_on_project
    from public.project_credits c
    where c.project_id = p.id
      and c.profile_id = p_profile_id
  ) r on true
  where p.status = 'approved'
    and p.visibility = 'members'
    and pr.status = 'approved'
    and pr.is_suspended is not true
    and (p_slug is not null or p_profile_id is not null)
    and (p_slug is null or p.slug = p_slug)
    and (
      p_profile_id is null
      or (
        (p.profile_id = p_profile_id or r.role_on_project is not null)
        and exists (
          select 1
          from public.profiles h
          where h.id = p_profile_id
            and h.status = 'approved'
            and h.is_suspended is not true
        )
      )
    );
$$;

revoke all on function public.member_only_film_teasers(text, uuid) from public;
grant execute on function public.member_only_film_teasers(text, uuid) to anon, authenticated, service_role;

commit;

-- =============================================================================
-- VERIFICATIONS (a lancer apres, en lecture seule)
-- =============================================================================
-- 1. Les deux fonctions existent, avec leurs colonnes :
--   select proname, pg_get_function_result(oid)
--   from pg_proc
--   where proname in ('public_profile_film_roles', 'member_only_film_teasers');
--
-- 2. Sans filtre, aucune carte verrouillee (attendu : 0) :
--   select count(*) from public.member_only_film_teasers();
--
-- 3. Roles d'une personne sur les films publics (remplacer l'identifiant) :
--   select * from public.public_profile_film_roles('<id du profil>');
