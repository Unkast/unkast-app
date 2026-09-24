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
| [ROADMAP.md](ROADMAP.md) | Pour situer une demande dans le plan produit et connaitre l'etat d'avancement |
| [adr/](adr/) | Decisions structurantes et durables, avec leur contexte et les alternatives ecartees |
| [sessions/](sessions/) | Notes de session, chronologiques |

## Points ouverts

- `docs/capacitor-android.md` est reference par CLAUDE.md (section Consultation, point 5)
  mais n'existe pas. Le fichier reste a ecrire : Capacitor et Android sont bien utilises
  dans ce repo (`capacitor.config.ts`, `android/`, plugins `@capacitor/*` dans package.json),
  donc la reference est legitime, seule la doc manque.

- **`lib/rate-limit.ts` mal decrit dans components-critiques.md**, qui annonce
  « fail-open si migration absente ». Le fichier est FAIL-CLOSED par defaut ; la tolerance
  a l'absence de RPC est bornee aux codes PGRST202/42883 ET a `NODE_ENV !== "production"`.
  Voir [adr/0004](adr/0004-echouer-ferme-par-defaut.md). Non corrige volontairement.
