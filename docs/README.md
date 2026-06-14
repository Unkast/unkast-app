# Documentation Unkast

Index des fichiers de documentation. Consulter AVANT toute modification du code.

> **Derniere remise a niveau : 2026-06-13** (audit doc vs code). Les docs decrivaient le MVP ;
> elles refletent desormais l'etat reel (admin, messagerie, credits, invitations, Pro, push).
> ⚠️ **Derive de schema connue** : `supabase/schema.sql` et `src/types/database.ts` sont en retard
> sur la base de production (~12 colonnes `profiles`, 3 colonnes `projects`, 8+ tables non versionnees) —
> detail et chantier dans [database.md](database.md).

| Fichier | Quand le consulter |
|---|---|
| [architecture.md](architecture.md) | Pour comprendre la structure du projet, les dependances entre fichiers, et identifier les impacts d'une modification |
| [relations.md](relations.md) | Pour tracer toutes les connexions source/destination entre composants, pages, API et tables |
| [hooks.md](hooks.md) | Pour comprendre les hooks utilises et le pattern de state management |
| [components-critiques.md](components-critiques.md) | AVANT de modifier un composant partage — identifie le niveau de risque |
| [database.md](database.md) | Pour comprendre le schema Supabase, les RLS policies, et les contraintes |
| [api-routes.md](api-routes.md) | Pour comprendre chaque endpoint API, ses dependances et ses limites |
