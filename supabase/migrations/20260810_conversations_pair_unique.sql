-- ============================================================================
-- Unicite de la paire de participants d'une conversation
-- A EXECUTER MANUELLEMENT dans le SQL Editor Supabase. Ne pas executer en auto.
--
-- Contexte : le quota gratuit « 2 personnes contactees » (nouveau modele
-- economique, 2026-08-10) se calcule a partir des conversations INITIEES par un
-- profil (participant_1, par convention applicative). Deux lignes pour la meme
-- paire feraient compter la meme personne deux fois, et le lookup applicatif
-- casserait (il n'attend qu'une ligne au plus).
--
-- Etat verifie AVANT redaction (lecture seule, 2026-08-10) : 4 conversations,
-- 4 paires distinctes, 0 doublon, 0 auto-conversation. Les deux contraintes
-- ci-dessous passent donc sans aucun nettoyage prealable.
--
-- IDEMPOTENCE : « create unique index if not exists » l'est nativement.
-- Postgres ne supporte PAS « add constraint if not exists » : le CHECK est
-- enveloppe dans un bloc DO qui verifie pg_constraint avant d'ajouter (meme
-- forme que 20260810_pro_grants.sql).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. VERIFICATIONS PREALABLES — a executer et LIRE avant le begin ci-dessous.
--    Les deux requetes doivent renvoyer 0 ligne. Si ce n'est pas le cas sur cet
--    environnement, resoudre AVANT (pour un doublon : garder la conversation la
--    plus ancienne, y rattacher les messages de l'autre, supprimer l'autre) —
--    sinon la creation de l'index echoue et la transaction est annulee.
-- ----------------------------------------------------------------------------
-- -- Doublons de paire (ordre des deux colonnes indifferent) :
-- select least(participant_1, participant_2)    as profil_a,
--        greatest(participant_1, participant_2) as profil_b,
--        count(*)                               as lignes,
--        array_agg(id order by created_at)      as conversation_ids
--   from public.conversations
--  group by 1, 2
-- having count(*) > 1;
--
-- -- Auto-conversations :
-- select id, participant_1
--   from public.conversations
--  where participant_1 = participant_2;

begin;

-- Une paire de profils = AU PLUS une conversation, quel que soit l'ordre des
-- deux colonnes. Index sur EXPRESSION (least/greatest) : une contrainte UNIQUE
-- de table ne peut pas porter sur une expression, seul un index le peut.
--
-- Ce que cet index garantit : on ne peut plus compter deux fois la meme
-- personne, et le lookup applicatif ne peut plus tomber sur 2 lignes.
-- Ce qu'il ne garantit PAS : la convention « participant_1 = initiateur »,
-- qui reste purement applicative — aucune contrainte ne peut exprimer « qui a
-- commence ». Il faudrait une colonne dediee (initiator_id) pour cela, dont le
-- quota n'a pas besoin.
create unique index if not exists conversations_pair_unique
  on public.conversations (
    least(participant_1, participant_2),
    greatest(participant_1, participant_2)
  );

-- Une conversation avec soi-meme gonflerait le quota d'une personne qui
-- n'existe pas, en plus de n'avoir aucun sens produit. 0 ligne concernee au
-- 2026-08-10. Le code refuse deja recipient_id = auth.uid() en amont (400) ;
-- ce CHECK est le dernier rempart, non contournable meme en acces direct.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.conversations'::regclass
      and conname = 'conversations_distinct_participants'
  ) then
    alter table public.conversations
      add constraint conversations_distinct_participants
      check (participant_1 <> participant_2);
  end if;
end $$;

commit;

-- ============================================================================
-- Verifications APRES execution :
--
-- -- Index present et bien UNIQUE :
-- select indexname, indexdef
--   from pg_indexes
--  where tablename = 'conversations'
--    and indexname = 'conversations_pair_unique';
--
-- -- CHECK present :
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--  where conrelid = 'public.conversations'::regclass
--    and conname = 'conversations_distinct_participants';
--
-- ----------------------------------------------------------------------------
-- Effet de bord cote code, DEJA gere (ne rien faire de plus) :
-- deux requetes concurrentes qui creaient jusqu'ici deux lignes pour la meme
-- paire recoivent desormais une erreur 23505 sur la seconde. Les deux chemins
-- d'insertion (POST /api/messages et POST /api/messages/conversation) passent
-- par createOrReuseConversation() (src/lib/messaging.ts), qui attrape 23505,
-- relit la conversation existante et la reutilise silencieusement — pas
-- d'erreur remontee a l'utilisateur, la course se resout en reutilisation.
-- ============================================================================
