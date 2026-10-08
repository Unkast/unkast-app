-- =============================================================================
-- Image du film et films « membres seulement » vus par un visiteur
-- =============================================================================
--
-- POURQUOI CE FICHIER (decisions de Maxime, 08/10/2026)
-- S'applique APRES 20261008_film_management.sql et
-- 20261009_film_limit_and_edit_watch.sql.
--
-- CE QU'IL FAIT
--   A. Bucket Storage public `posters` : images de film envoyees par les
--      gestionnaires. Aucune policy sur storage.objects : seul le service role
--      ecrit (route /api/projects/[id]/poster, qui controle le gestionnaire, le
--      type reel du fichier et son poids). Lecture publique par URL, comme
--      le bucket `avatars`. Plafond et types rappeles au niveau du bucket.
--   B. Fonction member_only_film_teasers : pour un visiteur non connecte, le
--      strict necessaire a une carte verrouillee d'un film « membres
--      seulement » (identifiant, adresse, titre, image, annee). Le lien video,
--      la description et l'equipe ne sortent pas de la base.
--
-- CE QU'IL NE FAIT PAS
--   - projects.poster_url reste protegee par guard_projects_columns : un client
--     ne l'ecrit pas, seule la route serveur le fait.
--   - Aucune vignette n'est remplie ici : elles sont lues chez YouTube / Vimeo
--     par le serveur (publication, et bouton de rattrapage dans l'admin).
--
-- ORDRE DE MISE EN SERVICE
-- A executer JUSTE AVANT de deployer le code correspondant. L'ancien code
-- n'utilise ni le bucket ni la fonction : aucune interruption.
--
-- Rollback : 20261010_film_poster_and_member_teasers_rollback.sql
-- =============================================================================

begin;

-- ---- A. Bucket des images de film --------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posters', 'posters', true, 4194304, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- ---- B. Carte verrouillee d'un film « membres seulement » ----------------------
-- Un des deux filtres est obligatoire (sinon rien) : pas de liste de tous les
-- films reserves aux membres.
--   p_slug       : le film ouvert par son lien direct
--   p_profile_id : les films dont cette personne est Responsable (sa fiche)
-- Film approuve, visibilite 'members', Responsable au profil approuve et non
-- suspendu.
create or replace function public.member_only_film_teasers(
  p_slug       text default null,
  p_profile_id uuid default null
)
returns table (
  id         uuid,
  slug       text,
  title      text,
  poster_url text,
  year       integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.slug, p.title, p.poster_url, p.year
  from public.projects p
  join public.profiles pr on pr.id = p.profile_id
  where p.status = 'approved'
    and p.visibility = 'members'
    and pr.status = 'approved'
    and pr.is_suspended is not true
    and (p_slug is not null or p_profile_id is not null)
    and (p_slug is null or p.slug = p_slug)
    and (p_profile_id is null or p.profile_id = p_profile_id);
$$;

revoke all on function public.member_only_film_teasers(text, uuid) from public;
grant execute on function public.member_only_film_teasers(text, uuid) to anon, authenticated, service_role;

commit;

-- =============================================================================
-- VERIFICATION APRES EXECUTION (lecture seule)
-- =============================================================================
--   -- 1. Le bucket existe, public, 4 Mo, 3 types
--   select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'posters';
--
--   -- 2. Sans filtre : 0 ligne
--   select count(*) from public.member_only_film_teasers();
--
--   -- 3. Colonnes renvoyees : id, slug, title, poster_url, year, rien d'autre
--   select * from public.member_only_film_teasers(p_slug => '<slug d un film membres>');
-- =============================================================================
