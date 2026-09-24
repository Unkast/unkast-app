---
date: 2026-08-14
projet: Unkast
categorie: technique
tags: [adr, documentation, gouvernance, audit, retro-documentation]
---

## Contexte

Le projet avait une documentation technique fournie (`docs/`, 8 fichiers) mais aucune trace des arbitrages : les règles existaient sous forme impérative dans CLAUDE.md, sans le raisonnement qui les avait produites. Mise en place de la structure de session et des ADR, puis rétro-documentation des décisions déjà prises.

## Décisions

- Séparation stricte entre règle et arbitrage : les règles restent dans CLAUDE.md, l'ADR ajoute le contexte et la raison. Alternative écartée : déplacer les règles dans les ADR, ce qui aurait vidé CLAUDE.md de son rôle opérationnel et forcé la lecture de 12 fichiers avant chaque tâche.

- Critère de tri d'un ADR : un arbitrage avec une alternative écartée. Une procédure de travail et un fait factuel sans arbitrage sont exclus. Ce critère a servi à écarter la section « Consultation obligatoire de la documentation », la « Classification des risques », les « Règles obligatoires » et la stack technique listée comme un fait.

- 12 ADR créés (0001 à 0012), numérotation validée par Maxime. Le candidat « épingler Next.js en version exacte » a été écarté faute de pouvoir confirmer l'arbitrage.

- Deux cas limites initialement écartés ont été rapatriés en 0008 (migrations SQL manuelles) et 0009 (le code prime sur la doc), pour cohérence avec un autre repo de Maxime où ils sont déjà formalisés. Enseignement : le périmètre d'un ADR se décide aussi au niveau du portefeuille de projets, pas seulement du repo courant.

- Marquage explicite du niveau de traçabilité de chaque ADR. Ceux dont le contexte a été reconstruit sans délibération tracée (0010, 0011, 0012) portent la mention « Contexte reconstruit depuis le repo, non issu d'une délibération tracée ». Alternative écartée : écrire un contexte plausible sans le signaler, ce qui aurait produit de la fausse mémoire indétectable six mois plus tard.

- Les incohérences doc/code trouvées en cours de route sont recensées dans une section « Points ouverts » de `docs/README.md` plutôt que corrigées à la volée, pour qu'elles soient traitées comme des tâches. Le quota de projets a ensuite été corrigé sur demande explicite, les deux autres restent ouvertes.

## Erreurs et corrections

- Symptôme : hypothèse d'un bootstrap depuis un template commun non adapté, pour expliquer la référence de CLAUDE.md à `docs/capacitor-android.md` qui n'existe pas.
  Cause réelle : hypothèse fausse. Capacitor et Android sont réellement utilisés dans Unkast (6 dépendances `@capacitor/*`, `capacitor.config.ts` avec `appId: com.unkast.app`, dossier `android/` complet, hook `usePushNotifications`, mentions dans 3 fichiers docs). La référence est légitime, c'est la doc qui n'a jamais été écrite.
  Correction : hypothèse infirmée par vérification du code avant d'agir. Le point est noté comme ouvert, le lien n'a pas été supprimé.

- Symptôme : contradiction entre `docs/architecture.md` (« FAIL-CLOSED ») et `docs/components-critiques.md` (« fail-open si migration absente ») sur `lib/rate-limit.ts`, au moment d'écrire l'ADR 0004.
  Cause réelle : `components-critiques.md` est en retard et sous-estime la protection. Le fichier est fail-closed par défaut, la tolérance à l'absence de RPC est doublement bornée : codes `PGRST202`/`42883` ET `NODE_ENV !== "production"`.
  Correction : lecture du code source avant rédaction. L'ADR décrit le comportement réel, l'écart documentaire est consigné en point ouvert.

- Symptôme : après correction du quota dans `architecture.md`, l'ADR 0009 citait encore l'écart au présent (« annonce encore un maximum de 2 films »).
  Cause réelle : effet de bord d'une correction demandée sur un fichier qui servait d'exemple dans un ADR.
  Correction : phrase remise au passé avec les deux dates (divergence 2026-08-10, correction 2026-08-14). Enseignement : un ADR qui cite l'état courant d'un fichier crée un couplage ; préférer citer un état daté.

- Symptôme : demande de créer « 11 ADR » accompagnée d'une liste de 12 numéros.
  Cause réelle : arithmétique de la liste, 11 candidats moins 1 écarté plus 2 rapatriés font 12.
  Correction : écart signalé, les 12 fichiers listés créés.

## Contraintes découvertes

- `MAX_PROJECTS_FREE = 3` et `MAX_PROJECTS_PRO = 30` depuis le 2026-08-10 (nouveau modèle économique, valeur passée de 2 à 3). Les 9 usages produits interpolent la constante depuis `src/lib/constants.ts`, aucun nombre n'est écrit en dur dans l'interface. Le commentaire du fichier signale que la valeur a déjà divergé une fois : ne jamais réintroduire de valeur littérale.

- `AGENTS.md` n'est pas un fichier rédigé à la main. Son contenu est encadré par `<!-- BEGIN:nextjs-agent-rules -->` / `<!-- END:nextjs-agent-rules -->`, marqueurs d'un bloc généré et géré par l'outillage Next.js. Toute modification manuelle à l'intérieur de ces marqueurs risque d'être écrasée.

- `next` et `eslint-config-next` sont épinglés en version exacte `16.2.0`, sans caret, contrairement à toutes les autres dépendances du projet. Origine de ce pin non tracée, arbitrage non confirmé.

- `recompute_plan` est la seule fonction autorisée à écrire `profiles.plan` et `pro_since`. Elle est `SECURITY DEFINER` et révoquée pour `public`, `anon` et `authenticated` (`supabase/migrations/20260810_pro_grants.sql`). `src/lib/pro-plan.ts` en maintient un miroir TypeScript en lecture seule : cette duplication est une dette connue, une divergence entre les deux produirait un bug d'affichage silencieux.

- `docs/` contient 8 fichiers dont 2 très volumineux (`database.md` 44 Ko, `api-routes.md` 42 Ko). `docs/README.md` n'en indexait que 6 : `ROADMAP.md` était absent de l'index. Vérifier l'index contre le contenu réel du dossier, pas l'inverse.

## Reste ouvert

- `docs/capacitor-android.md` reste à écrire. Référencé par CLAUDE.md (section Consultation, point 5), utilisé réellement par le projet, jamais rédigé.

- `docs/components-critiques.md` décrit mal `lib/rate-limit.ts` (« fail-open si migration absente »). Non corrigé volontairement, consigné en point ouvert.

- `supabase/schema.sql` est en retard sur la base réelle (5 tables versus 15 dans `src/types/database.ts`) et reste à régénérer. Conséquence documentée dans l'ADR 0007 : le repo ne contient plus de moyen fiable de reconstruire la base de zéro.

- Origine du pin de version exacte de Next.js à confirmer. Si l'arbitrage a réellement eu lieu, un ADR 0013 serait justifié ; sinon c'est un effet de bord de `create-next-app`.

- La mention « Contexte reconstruit » sur 0010, 0011 et 0012 est à lever si Maxime confirme ou corrige l'arbitrage réel.
