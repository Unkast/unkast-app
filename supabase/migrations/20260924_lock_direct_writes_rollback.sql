-- =============================================================================
-- ROLLBACK de 20260924_lock_direct_writes.sql
-- =============================================================================
--
-- Restaure a l'identique l'etat prod releve le 24/09/2026 (pg_policies) :
-- policies d'ecriture directe sur profiles (INSERT), projects (UPDATE),
-- conversations (INSERT, UPDATE) et messages (INSERT, UPDATE), et les privileges
-- table-level correspondants pour anon / authenticated.
--
-- A n'executer QUE si la migration a casse un parcours. Ce rollback rouvre les
-- failles C1, C2 et C4 de l'audit du 24/09/2026.
--
-- Idempotent : drop policy if exists avant chaque create.
-- =============================================================================

begin;

-- C1. profiles
grant insert, truncate on public.profiles to anon, authenticated;
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- C2. projects
grant update, truncate on public.projects to anon, authenticated;
drop policy if exists "Users can update own projects" on public.projects;
create policy "Users can update own projects" on public.projects
  for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

-- C4. conversations
grant insert, update, delete, truncate on public.conversations to anon, authenticated;
drop policy if exists "Users can create conversations" on public.conversations;
create policy "Users can create conversations" on public.conversations
  for insert with check ((auth.uid() = participant_1) or (auth.uid() = participant_2));
drop policy if exists "Users can update own conversations" on public.conversations;
create policy "Users can update own conversations" on public.conversations
  for update using ((auth.uid() = participant_1) or (auth.uid() = participant_2));

-- C4. messages
grant insert, update, delete, truncate on public.messages to anon, authenticated;
drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants can send messages" on public.messages
  for insert with check (
    (auth.uid() = sender_id) and exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and ((conversations.participant_1 = auth.uid()) or (conversations.participant_2 = auth.uid()))
    )
  );
drop policy if exists "Recipients can mark as read" on public.messages;
create policy "Recipients can mark as read" on public.messages
  for update using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and ((conversations.participant_1 = auth.uid()) or (conversations.participant_2 = auth.uid()))
    )
  );

commit;

-- Verification : la requete pg_policies du fichier principal doit de nouveau
-- lister les 6 policies d'ecriture ci-dessus.
