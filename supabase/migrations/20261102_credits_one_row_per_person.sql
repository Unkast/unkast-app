-- =============================================================================
-- Equipe d'un film : UNE ligne par personne (2 novembre 2026)
-- =============================================================================
-- Table touchee : public.project_credits. Fonction : public.publish_project.
--
-- CONTEXTE
--   Une meme personne apparaissait deux fois dans l'equipe d'un film (une ligne
--   « Realisateur », une autre aux postes saisis a la main) : le compteur « 2 talents »
--   comptait deux lignes. Decision du 30/10/2026 : une ligne par personne, roles
--   separes par « / ». Seule l'invitation d'un membre fusionnait ; la publication, la
--   demande de credit acceptee et le credit par email inserraient une ligne de plus.
--   Desormais : tous les roles viennent de la liste fermee des metiers (controle cote
--   serveur, src/lib/credits.ts), une seule ligne par (film, profil).
--
-- CE QUE FAIT CETTE MIGRATION
--   A. Donnees : pour chaque personne et chaque film, fusionne ses lignes en une seule
--      (la ligne gardee est celle de plus petit id, les autres sont supprimees). Les
--      roles sont ramenes aux libelles de la liste, dans l'ordre de la liste
--      (ALL_ROLES, src/lib/constants.ts), sans doublon (« Monteur » et « Monteuse » = un
--      seul). Seul remappage : « Acteur » devient « Comedien » (decide d'apres
--      l'audit du 02/11/2026). Les virgules finales disparaissent. Les credits sans
--      compte (ghost) sont remis dans la meme forme, ligne par ligne, sans fusion.
--      SECURITE : si un role hors liste (autre que « Acteur ») est encore present, la
--      migration s'arrete AVANT toute modification (exception, rien n'est change).
--   B. Index : remplace project_credits_one_role_per_person (project_id, profile_id,
--      role) par un index unique (project_id, profile_id) sur les credits avec compte.
--      PAS d'index sur ghost_name : la suppression d'un compte copie son nom dans
--      ghost_name (trigger keep_credit_name_on_profile_delete), un homonyme deja sans
--      compte sur le film ferait echouer toute la suppression.
--   C. publish_project : fusionne les credits d'une meme personne dans p_credits
--      (seule la partie « INSERT INTO project_credits » change ; signature, droits et
--      reste de la fonction sont ceux de 20261009).
--
-- NOTES
--   - Le declencheur track_project_credit_edit est coupe pendant la correction des
--     donnees (sinon les films touches iraient dans « modifies recemment » de l'admin),
--     puis remis. Il est dans la meme transaction.
--   - Idempotent : rejouable sans effet une fois appliquee.
--   - Pas de CHECK sur les roles : la liste vit dans le code, pas en base.
--   - Si la liste des metiers change dans constants.ts, la copie ci-dessous n'a pas a
--     suivre : elle ne sert qu'a cette correction, une fois.
--
-- A executer a la main dans le SQL Editor. Retour arriere :
-- 20261102_credits_one_row_per_person_rollback.sql
-- =============================================================================

begin;

alter table public.project_credits disable trigger track_project_credit_edit;

-- ---- A. Donnees --------------------------------------------------------------
-- Liste fermee : libelle, rang (ordre de la liste, la forme feminine a le rang du
-- masculin), libelle sans accents ni majuscules.
create temp table _credit_roles (label text not null, rank integer not null, folded text) on commit drop;
insert into _credit_roles (label, rank) values
    ('Réalisateur', 0),
    ('Premier assistant réalisateur', 1),
    ('Deuxième assistant réalisateur', 2),
    ('Stagiaire réalisation', 3),
    ('Scripte', 4),
    ('Réalisateur second équipe', 5),
    ('Directeur de la photographie', 6),
    ('Cadreur', 7),
    ('Premier assistant caméra', 8),
    ('Deuxième assistant caméra', 9),
    ('Steadicameur', 10),
    ('Drone operator', 11),
    ('Photographe de plateau', 12),
    ('Chef électricien', 13),
    ('Électricien', 14),
    ('Chef machiniste', 15),
    ('Machiniste', 16),
    ('Étalonneur', 17),
    ('Ingénieur du son', 18),
    ('Perchiste', 19),
    ('Monteur son', 20),
    ('Mixeur', 21),
    ('Compositeur', 22),
    ('Superviseur musical', 23),
    ('Bruiteur', 24),
    ('Monteur', 25),
    ('Assistant monteur', 26),
    ('Monteur VFX', 27),
    ('Superviseur VFX', 28),
    ('Motion designer', 29),
    ('Coloriste', 30),
    ('Producteur', 31),
    ('Producteur délégué', 32),
    ('Producteur exécutif', 33),
    ('Directeur de production', 34),
    ('Régisseur général', 35),
    ('Régisseur adjoint', 36),
    ('Régisseur de plateau', 37),
    ('Chargé de production', 38),
    ('Assistant de production', 39),
    ('Directeur de casting', 40),
    ('Assistant casting', 41),
    ('Chef décorateur', 42),
    ('Assistant décorateur', 43),
    ('Ensemblier', 44),
    ('Accessoiriste', 45),
    ('Chef costumier', 46),
    ('Costumier', 47),
    ('Habilleuse', 48),
    ('Chef maquilleur', 49),
    ('Maquilleur', 50),
    ('Assistant maquilleur', 51),
    ('Chef coiffeur', 52),
    ('Coiffeur', 53),
    ('Coordinateur effets spéciaux', 54),
    ('Technicien effets spéciaux', 55),
    ('Comédien', 56),
    ('Comédien de complément', 57),
    ('Cascadeur', 58),
    ('Coordinateur de cascades', 59),
    ('Doublure', 60),
    ('Doublure lumière', 61),
    ('Voix off', 62),
    ('Comédien de doublage', 63),
    ('Scénariste', 64),
    ('Dialoguiste', 65),
    ('Story-boardeur', 66),
    ('Auteur', 67),
    ('Distributeur', 68),
    ('Agent artistique', 69),
    ('Attaché de presse', 70),
    ('Chargé de communication', 71),
    ('Community manager', 72),
    ('Graphiste', 73),
    ('Affichiste', 74),
    ('Bande-annonciste', 75),
    ('Chef opérateur son', 76),
    ('Technicien HF', 77),
    ('Vidéo assist', 78),
    ('Technicien plateau', 79),
    ('Coordinateur post-production', 80),
    ('Superviseur post-production', 81),
    ('Producteur de post-production', 82),
    ('Directeur artistique', 83),
    ('Concepteur sonore', 84),
    ('Illustrateur', 85),
    ('Animateur', 86),
    ('Chef monteur publicité', 87),
    ('Coordinateur de tournage', 88),
    ('Logisticien', 89),
    ('Chauffeur de production', 90),
    ('Réalisatrice', 0),
    ('Première assistante réalisatrice', 1),
    ('Deuxième assistante réalisatrice', 2),
    ('Réalisatrice seconde équipe', 5),
    ('Directrice de la photographie', 6),
    ('Cadreuse', 7),
    ('Première assistante caméra', 8),
    ('Deuxième assistante caméra', 9),
    ('Steadicameuse', 10),
    ('Cheffe électricienne', 13),
    ('Électricienne', 14),
    ('Cheffe machiniste', 15),
    ('Étalonneuse', 17),
    ('Ingénieure du son', 18),
    ('Monteuse son', 20),
    ('Mixeuse', 21),
    ('Compositrice', 22),
    ('Superviseuse musicale', 23),
    ('Bruiteuse', 24),
    ('Monteuse', 25),
    ('Assistante monteuse', 26),
    ('Monteuse VFX', 27),
    ('Superviseuse VFX', 28),
    ('Productrice', 31),
    ('Productrice déléguée', 32),
    ('Productrice exécutive', 33),
    ('Directrice de production', 34),
    ('Régisseuse générale', 35),
    ('Régisseuse adjointe', 36),
    ('Régisseuse de plateau', 37),
    ('Chargée de production', 38),
    ('Assistante de production', 39),
    ('Directrice de casting', 40),
    ('Assistante casting', 41),
    ('Cheffe décoratrice', 42),
    ('Assistante décoratrice', 43),
    ('Ensemblière', 44),
    ('Cheffe costumière', 46),
    ('Costumière', 47),
    ('Habilleur', 48),
    ('Cheffe maquilleuse', 49),
    ('Maquilleuse', 50),
    ('Assistante maquilleuse', 51),
    ('Cheffe coiffeuse', 52),
    ('Coiffeuse', 53),
    ('Coordinatrice effets spéciaux', 54),
    ('Technicienne effets spéciaux', 55),
    ('Comédienne', 56),
    ('Comédienne de complément', 57),
    ('Cascadeuse', 58),
    ('Coordinatrice de cascades', 59),
    ('Comédienne de doublage', 63),
    ('Story-boardeuse', 66),
    ('Autrice', 67),
    ('Distributrice', 68),
    ('Agente artistique', 69),
    ('Attachée de presse', 70),
    ('Chargée de communication', 71),
    ('Cheffe opératrice son', 76),
    ('Technicienne HF', 77),
    ('Technicienne plateau', 79),
    ('Coordinatrice post-production', 80),
    ('Superviseuse post-production', 81),
    ('Productrice de post-production', 82),
    ('Directrice artistique', 83),
    ('Conceptrice sonore', 84),
    ('Illustratrice', 85),
    ('Animatrice', 86),
    ('Cheffe monteuse publicité', 87),
    ('Coordinatrice de tournage', 88),
    ('Logisticienne', 89),
    ('Chauffeuse de production', 90);
update _credit_roles set folded = translate(lower(label), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc');

-- Un morceau par ligne (coupe sur & , / et « et »), sans vide, « Acteur » -> « Comedien ».
-- key : une personne dans un film (profil + film) ; un credit sans compte est seul.
create temp table _credit_parts on commit drop as
select s.id,
       coalesce(s.profile_id::text || ':' || s.project_id::text, s.id::text) as key,
       case when s.f = 'acteur' then 'comedien' else s.f end as folded
from (
  select c.id, c.project_id, c.profile_id,
         translate(lower(btrim(x.part)), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc') as f
  from public.project_credits c,
       regexp_split_to_table(c.role_on_project, '\s*(?:&|/|,|\met\M)\s*') as x(part)
) s
where s.f <> '';

do $$
declare
  v_bad text;
begin
  select string_agg(distinct p.folded, ', ') into v_bad
  from _credit_parts p
  left join _credit_roles r on r.folded = p.folded
  where r.label is null;
  if v_bad is not null then
    raise exception 'Role hors liste restant : %. Migration annulee, rien n''a ete modifie. Voir l''audit (supabase/audit_credits_equipes.sql).', v_bad;
  end if;
end $$;

-- Role final de chaque personne : metiers distincts (un par rang), dans l'ordre de la liste.
create temp table _credit_fix on commit drop as
select k.key, string_agg(k.label, ' / ' order by k.rank) as new_role
from (
  select p.key, r.rank, min(r.label) as label
  from _credit_parts p
  join _credit_roles r on r.folded = p.folded
  group by p.key, r.rank
) k
group by k.key;

-- Ligne gardee : celle de plus petit id.
create temp table _credit_keep on commit drop as
select key, (array_agg(id order by id))[1] as keep_id
from (select distinct key, id from _credit_parts) d
group by key;

update public.project_credits c
set role_on_project = f.new_role
from _credit_keep k
join _credit_fix f on f.key = k.key
where c.id = k.keep_id
  and c.role_on_project is distinct from f.new_role;

delete from public.project_credits c
where c.id in (select id from _credit_parts)
  and c.id not in (select keep_id from _credit_keep);

do $$
declare
  v_n integer;
begin
  select count(*) into v_n from (
    select 1 from public.project_credits
    where profile_id is not null
    group by project_id, profile_id
    having count(*) > 1
  ) d;
  if v_n > 0 then
    raise exception '% personne(s) ont encore plusieurs lignes sur un film. Migration annulee.', v_n;
  end if;
end $$;

-- ---- B. Index ----------------------------------------------------------------
drop index if exists public.project_credits_one_role_per_person;

create unique index if not exists project_credits_one_row_per_person
  on public.project_credits (project_id, profile_id)
  where profile_id is not null;

-- ---- C. publish_project --------------------------------------------------------
-- Memes signature et droits (service role uniquement) : conserves par CREATE OR REPLACE.
create or replace function public.publish_project(
  p_profile_id        uuid,
  p_title             text,
  p_slug              text,
  p_description       text,
  p_category          public.project_category,
  p_year              integer,
  p_video_url         text,
  p_declared_role     text,
  p_text_version      text,
  p_client_authorized boolean,
  p_limit             integer,
  p_source_title      text,
  p_source_author     text,
  p_credits           jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_dup record;
  v_project_id uuid;
begin
  if p_declared_role is null
     or p_declared_role not in ('realisateur', 'producteur', 'ayant_droit', 'autre')
     or coalesce(btrim(p_text_version), '') = '' then
    return jsonb_build_object('ok', false, 'code', 'rights_declaration_required');
  end if;

  if p_category in ('publicite', 'clip') and not coalesce(p_client_authorized, false) then
    return jsonb_build_object('ok', false, 'code', 'client_authorization_required');
  end if;

  -- Serialise les publications d'un meme compte (le plafond ne se depasse pas
  -- par deux requetes simultanees).
  perform pg_advisory_xact_lock(hashtext('publish_project:' || p_profile_id::text));

  -- Plafond : films dont on est Responsable, en ligne ou en attente de
  -- validation (project_slots_used). p_limit NULL = illimite (Pro).
  if p_limit is not null and public.project_slots_used(p_profile_id) >= p_limit then
    return jsonb_build_object('ok', false, 'code', 'limit_reached');
  end if;

  v_key := public.extract_video_key(p_video_url);
  if v_key is not null then
    select p.id, p.slug, p.title,
           (p.status = 'approved' and p.visibility in ('public', 'members')) as is_visible
    into v_dup
    from public.projects p
    where p.video_key = v_key and p.status is distinct from 'refused'
    limit 1;
    if found then
      -- Titre et slug seulement si le film existant est visible par un membre
      -- (public ou membres seulement) : celui qui publie est connecte.
      return jsonb_build_object(
        'ok', false, 'code', 'duplicate',
        'project_id', v_dup.id,
        'is_visible', v_dup.is_visible,
        'slug',  case when v_dup.is_visible then v_dup.slug end,
        'title', case when v_dup.is_visible then v_dup.title end
      );
    end if;
  end if;

  begin
    insert into public.projects
      (profile_id, title, slug, description, category, year, video_url, video_key, status)
    values
      (p_profile_id, p_title, p_slug, nullif(btrim(p_description), ''), p_category, p_year,
       p_video_url, v_key, 'pending')
    returning id into v_project_id;
  exception when unique_violation then
    -- Course sur la cle video (ou slug) : l'index unique tranche.
    return jsonb_build_object('ok', false, 'code', 'duplicate');
  end;

  insert into public.project_rights_declarations
    (project_id, profile_id, declared_role, text_version, client_authorized)
  values
    (v_project_id, p_profile_id, p_declared_role, p_text_version, coalesce(p_client_authorized, false));

  insert into public.project_moderation (project_id, source_title, source_author)
  values (v_project_id, p_source_title, p_source_author);

  -- UNE ligne par personne (20261102_credits_one_row_per_person.sql) : les credits
  -- d'une meme personne (meme profil, ou meme nom sans compte) sont fusionnes, leurs
  -- roles joints par « / » dans l'ordre recu (api/dashboard/projects et api/signup
  -- les envoient deja fusionnes et dans l'ordre canonique ; ceci est le filet qui
  -- empeche l'index unique (project_id, profile_id) de faire echouer la publication).
  with src as (
    select nullif(c.val->>'profile_id', '')::uuid as profile_id,
           nullif(btrim(c.val->>'ghost_name'), '') as ghost_name,
           btrim(c.val->>'role') as role_name,
           c.pos
    from jsonb_array_elements(coalesce(p_credits, '[]'::jsonb)) with ordinality as c(val, pos)
    where coalesce(btrim(c.val->>'role'), '') <> ''
      and (nullif(c.val->>'profile_id', '') is not null or nullif(btrim(c.val->>'ghost_name'), '') is not null)
  ),
  keyed as (
    select s.*, coalesce(s.profile_id::text, 'g:' || lower(s.ghost_name)) as person
    from src s
  ),
  per_role as (
    select person,
           (array_agg(profile_id order by pos))[1] as profile_id,
           (array_agg(ghost_name order by pos))[1] as ghost_name,
           (array_agg(role_name order by pos))[1] as role_name,
           min(pos) as pos
    from keyed
    group by person, lower(role_name)
  )
  insert into public.project_credits (project_id, profile_id, ghost_name, role_on_project)
  select v_project_id,
         (array_agg(profile_id order by pos))[1],
         (array_agg(ghost_name order by pos))[1],
         string_agg(role_name, ' / ' order by pos)
  from per_role
  group by person;

  return jsonb_build_object('ok', true, 'code', 'created', 'project_id', v_project_id);
end;
$$;

alter table public.project_credits enable trigger track_project_credit_edit;

commit;

-- Verification (lecture seule) :
--   1. Plus aucune personne avec plusieurs lignes sur un film (attendu : 0 ligne) :
--      select project_id, profile_id, count(*) from public.project_credits
--      where profile_id is not null group by 1, 2 having count(*) > 1;
--   2. Index en place, ancien index absent :
--      select indexname from pg_indexes where schemaname = 'public'
--      and tablename = 'project_credits' and indexname like 'project_credits_one_%';
--      -> project_credits_one_row_per_person seulement
--   3. Declencheur actif (attendu : O) :
--      select tgenabled from pg_trigger where tgname = 'track_project_credit_edit';
--   4. Roles : relancer supabase/audit_credits_equipes.sql, requetes 1 et 2 vides.
