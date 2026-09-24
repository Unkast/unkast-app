-- =============================================================================
-- Bannissement des 6 comptes de demo (audit du 24/09/2026 : C3)
-- =============================================================================
--
-- POURQUOI CE FICHIER
-- supabase/seed.sql cree 6 comptes *@demo.com avec le mot de passe connu
-- 'password123'. Releve prod du 24/09/2026 : les 6 existent dans auth.users, et
-- a1000000-...-000000000002 (chloe.bernard) porte un grant Pro VIP
-- (20260810_pro_grants_backfill.sql). N'importe qui pouvait s'y connecter.
--
-- CE QU'IL FAIT
--   1. auth.users.banned_until = 'infinity' : GoTrue refuse toute connexion
--      (mot de passe, magic link, OAuth) et tout refresh de token.
--   2. Supprime leurs sessions et refresh tokens : les appareils deja connectes
--      ne peuvent plus renouveler leur session.
--
-- CE QU'IL NE FAIT PAS
--   - Aucune donnee supprimee : profiles, projects, project_credits, messages,
--     grants Pro restent intacts. Les profils restent donc visibles publiquement.
--   - Un access token JWT deja emis reste valide jusqu'a son expiration
--     (1 h par defaut dans Supabase), il ne peut simplement plus etre renouvele.
--
-- Double garde : chaque requete filtre sur l'id ET sur l'email, pour ne jamais
-- toucher un vrai compte si un id etait reutilise.
-- Idempotent : peut etre rejoue sans effet de bord.
--
-- ROLLBACK (si besoin de reactiver un compte) :
--   update auth.users set banned_until = null
--   where id = '<uuid>' and email like '%@demo.com';
--   (les sessions supprimees ne se restaurent pas : il faudra se reconnecter)
--
-- =============================================================================
-- VERIFICATION AVANT EXECUTION (doit renvoyer exactement 6 lignes)
-- =============================================================================
--   select u.id, u.email, u.banned_until, u.last_sign_in_at,
--          (select count(*) from auth.sessions s where s.user_id = u.id)             as sessions,
--          (select count(*) from auth.refresh_tokens r where r.user_id = u.id::text) as refresh_tokens
--   from auth.users u
--   where u.id in (
--     'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002',
--     'a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004',
--     'a1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000006'
--   ) and u.email like '%@demo.com'
--   order by u.email;
--
--   A regarder : last_sign_in_at recent = quelqu'un s'est peut-etre deja connecte.
-- =============================================================================

begin;

create temp table demo_accounts on commit drop as
select id
from auth.users
where id in (
  'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004',
  'a1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000006'
)
and email like '%@demo.com';

-- 1. Bannissement definitif.
update auth.users
set banned_until = 'infinity'
where id in (select id from demo_accounts);

-- 2. Refresh tokens (user_id est de type varchar dans auth.refresh_tokens).
delete from auth.refresh_tokens
where user_id in (select id::text from demo_accounts);

-- 3. Sessions.
delete from auth.sessions
where user_id in (select id from demo_accounts);

commit;

-- =============================================================================
-- VERIFICATION APRES EXECUTION
-- =============================================================================
--   Relancer la requete ci-dessus. Attendu sur les 6 lignes :
--     banned_until   = infinity
--     sessions       = 0
--     refresh_tokens = 0
--
--   Test fonctionnel : se connecter sur app.unkast.com avec
--   chloe.bernard@demo.com / password123 -> la connexion doit etre refusee.
-- =============================================================================
