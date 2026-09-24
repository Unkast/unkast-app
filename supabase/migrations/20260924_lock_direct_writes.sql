-- =============================================================================
-- Fermeture des ecritures directes PostgREST (audit du 24/09/2026 : C1, C2, C4)
-- =============================================================================
--
-- POURQUOI CE FICHIER
-- Les regles metier (moderation des films, quotas de messagerie, blocage des
-- coordonnees, colonnes systeme de profiles) sont appliquees par les routes API.
-- Mais la cle anon est publique : un utilisateur connecte peut appeler PostgREST
-- directement avec son JWT et contourner l'API partout ou un GRANT + une policy
-- d'ecriture existent. Etat prod releve le 24/09/2026 (pg_policies) :
--
--   C1 profiles      policy INSERT "Users can insert own profile"
--                    WITH CHECK (auth.uid() = id). Un compte auth sans profil
--                    peut s'inserer avec is_admin = true, plan = 'pro'. Le trigger
--                    guard_profiles_system_columns restaure OLD.*, il n'agit donc
--                    que sur UPDATE.
--   C2 projects      policy UPDATE "Users can update own projects", aucune
--                    restriction de colonne. Un proprietaire peut passer
--                    status = 'approved' (auto-moderation) ou changer video_url
--                    apres validation.
--   C4 conversations policies INSERT + UPDATE : creation de conversations hors
--                    quota, changement de participant_1 / participant_2
--                    (UPDATE sans WITH CHECK).
--      messages      policies INSERT + UPDATE : envoi hors quota / hors regle
--                    48 h / hors blocage coordonnees ; UPDATE sans restriction
--                    de colonne permet de reecrire le contenu d'un message de
--                    l'autre participant.
--
-- PREUVE QUE RIEN NE CASSE (grep du 24/09/2026 sur src/)
--   profiles       INSERT : uniquement createAdminClient()
--                  (api/signup/route.ts:99, auth/callback/route.ts:34).
--   projects       UPDATE : uniquement createAdminClient() (api/admin/route.ts:331,337).
--                  INSERT et DELETE passent par le client utilisateur
--                  (api/dashboard/projects/route.ts:97,168) : ON NE LES TOUCHE PAS ici.
--   conversations  INSERT/UPDATE : uniquement admin (lib/messaging.ts:96 recoit
--                  toujours `admin`, api/messages/route.ts:232).
--   messages       INSERT/UPDATE : uniquement admin (api/messages/route.ts:223,
--                  api/messages/read/route.ts:33, api/messages/[conversationId]:34).
--   Lectures client utilisateur conservees : messages (layout.tsx:35,
--   messages/unread-count, realtime messages/[id]/page.tsx:93) et conversations
--   (sous-requete de la policy SELECT de messages). Le SELECT n'est PAS revoque.
--
-- CE QUE LE FICHIER NE FAIT PAS
--   - UPDATE sur profiles : les 17 GRANT UPDATE colonne restent en place. Ne
--     JAMAIS faire `revoke update on profiles` : en Postgres, retirer un privilege
--     au niveau table retire aussi tous ses privileges colonne, /moi casserait.
--   - INSERT sur projects : reste ouvert (la policy prod impose deja
--     status = 'pending'). Le contournement du plafond de films et de video_key
--     par INSERT direct reste possible ; le fermer demande de basculer l'insert de
--     api/dashboard/projects/route.ts sur le service role (changement de code, a
--     valider separement), puis un `revoke insert on projects`.
--
-- Idempotent : revoke et drop policy if exists peuvent etre rejoues.
-- Rollback : 20260924_lock_direct_writes_rollback.sql
--
-- =============================================================================
-- VERIFICATION AVANT EXECUTION
-- =============================================================================
--   -- privileges table-level par role (le releve du 24/09 etait tronque)
--   select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type)
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and table_name in ('profiles', 'projects', 'conversations', 'messages')
--     and grantee in ('anon', 'authenticated')
--   group by table_name, grantee order by 1, 2;
--
--   -- evenements du trigger de garde (confirme qu'il ne couvre pas INSERT)
--   select tgname, pg_get_triggerdef(oid)
--   from pg_trigger
--   where tgrelid = 'public.profiles'::regclass and not tgisinternal;
--
--   -- aucune ligne ne doit sortir : un profil admin que tu ne connais pas
--   select id, full_name, created_at from public.profiles where is_admin = true;
-- =============================================================================

begin;

-- C1. profiles : plus aucune creation de profil par un client.
drop policy if exists "Users can insert own profile" on public.profiles;
revoke insert, truncate on public.profiles from anon, authenticated;

-- C2. projects : plus aucune modification de film par un client.
--     SELECT, INSERT et DELETE conserves (utilises par le client utilisateur).
drop policy if exists "Users can update own projects" on public.projects;
revoke update, truncate on public.projects from anon, authenticated;

-- C4. conversations / messages : lecture seule cote client.
drop policy if exists "Users can create conversations" on public.conversations;
drop policy if exists "Users can update own conversations" on public.conversations;
revoke insert, update, delete, truncate on public.conversations from anon, authenticated;

drop policy if exists "Participants can send messages" on public.messages;
drop policy if exists "Recipients can mark as read" on public.messages;
revoke insert, update, delete, truncate on public.messages from anon, authenticated;

commit;

-- =============================================================================
-- VERIFICATION APRES EXECUTION
-- =============================================================================
--   1. La premiere requete ci-dessus ne doit plus lister :
--        profiles      : INSERT, TRUNCATE
--        projects      : UPDATE, TRUNCATE
--        conversations : INSERT, UPDATE, DELETE, TRUNCATE
--        messages      : INSERT, UPDATE, DELETE, TRUNCATE
--
--   2. Policies restantes attendues :
--      select tablename, policyname, cmd from pg_policies
--      where schemaname = 'public'
--        and tablename in ('profiles', 'projects', 'conversations', 'messages')
--      order by 1, 3;
--        profiles      : 2 SELECT + 1 UPDATE
--        projects      : 2 SELECT + 1 INSERT + 1 DELETE
--        conversations : 1 SELECT
--        messages      : 1 SELECT
--
--   3. Parcours a tester dans l'app juste apres :
--      - /moi : modifier son profil (bio, liens, coordonnees) -> enregistre
--      - /moi : ajouter puis supprimer un film -> OK
--      - admin : approuver / refuser un film -> OK
--      - profil d'un autre -> Contacter -> envoyer un message -> recu en direct
--        chez l'autre (realtime) et badge non lu mis a jour
--      - inscription email + premier login Google -> profil cree
-- =============================================================================
