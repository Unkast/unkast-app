-- =============================================================================
-- 20261022_series_A.sql — lot 10 « Séries », étape 1 : nouvelle catégorie
-- =============================================================================
-- A EXECUTER A LA MAIN dans le SQL Editor, SEULE, AVANT 20261023_series_B.sql
-- et avant de deployer le code du lot 10.
--
-- Une valeur ajoutee a un enum ne peut pas etre utilisee dans la transaction qui
-- l'ajoute : ce fichier ne contient donc que cette instruction, sans begin/commit.
-- Sans risque pour l'existant : aucune ligne ne change, l'ancien code ignore la
-- nouvelle valeur. Une valeur d'enum ne se retire pas (pas de retour arriere).
-- =============================================================================

alter type public.project_category add value if not exists 'serie';

-- Controle :
--   select enum_range(null::public.project_category);
--   -- attendu : la liste se termine par serie
