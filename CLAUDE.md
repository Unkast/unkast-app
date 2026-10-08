@AGENTS.md

# Unkast

Plateforme web ou les professionnels du cinema et de l'audiovisuel francais creent un profil, publient des projets video, creditent leurs collaborateurs, et se font decouvrir par des recruteurs/producteurs a travers leur travail.

## Stack technique

- Next.js 16.2.0 (App Router) + React 19 + TypeScript 5
- Supabase (PostgreSQL + Auth + Row Level Security)
- Tailwind CSS 4
- framer-motion 12 (animations)
- react-player 3 (embeds Vimeo/YouTube)
- resend 6 (email transactionnel — installe, pas encore connecte)
- Deploiement : Vercel (https://app.unkast.com)

## Consultation obligatoire de la documentation

AVANT de modifier, creer ou supprimer un fichier, suis ce process dans l'ordre :

1. Lis docs/architecture.md. Identifie la fonctionnalite concernee, son type (CORE/FEATURE/SUB/HOOK/UTILITY) et TOUTES ses dependances.
2. Lis docs/relations.md. Identifie TOUTES les connexions source/destination. Liste les fichiers potentiellement impactes.
3. Si la modification touche une table Supabase ou du RLS → lis docs/database.md.
4. Si la modification touche une route API → lis docs/api-routes.md.
5. Si la modification touche Android, Capacitor, un plugin natif ou un widget → lis docs/capacitor-android.md.
6. Si la modification touche un hook custom → lis docs/hooks.md.
7. Si la modification touche un composant utilise par 3+ features → lis docs/components-critiques.md. Liste explicitement qui sera impacte AVANT de coder.

Ne modifie aucun fichier sans avoir complete les etapes ci-dessus.

## Memoire sceptique

Verifie les informations documentees contre le code reel avant de les appliquer. Si un fichier docs/ contredit le code source, le code source fait foi. Ne te fie jamais a la documentation seule — confirme dans le code.

## Classification des risques

Adapte ton niveau de prudence selon le risque :

RISQUE FAIBLE — lecture, analyse, consultation, generation de documentation :
- Agis directement.

RISQUE MOYEN — modification d'un composant, creation d'un fichier, modification d'un hook, ajout d'une route API :
- Lis la doc pertinente. Identifie les impacts. Propose le changement avant d'executer.

RISQUE ELEVE — migration Supabase, modification de RLS, suppression de fichier, modification de fichier Kotlin (android/), modification d'un composant critique (3+ dependants), modification de la config Capacitor :
- Lis TOUTE la doc impactee. Liste TOUS les fichiers et features impactes. Demande une confirmation explicite AVANT d'executer. Ne supprime JAMAIS sans validation.

## Regles obligatoires

1. Fournis toute migration Supabase en SQL separe pour execution manuelle dans le SQL Editor. Ne jamais executer automatiquement.
2. Ne fais JAMAIS de git push ou de deploiement Vercel sans permission explicite.
3. Teste localement avant tout deploiement Vercel.
4. Ne modifie JAMAIS un composant mobile sans tester le rendu desktop. Teste les deux.
5. Lis le fichier AVANT de l'editer. Audite l'etat actuel du code avant de modifier.
6. Ne supprime JAMAIS une feature sans validation explicite.
7. Ne modifie les fichiers Kotlin (android/) que sur demande explicite.
8. Ne fais apparaitre AUCUNE cle API, secret ou credential dans le code versionne.
9. N'arrete JAMAIS toi-meme le serveur de dev de Maxime (pas de taskkill, pas de kill du process next dev). Si un build est necessaire pendant qu'il tourne, demande-lui de l'arreter et attends.

## Interdictions explicites

- Ne desactive PAS une fonctionnalite existante pour en corriger une autre.
- Ne refactorise PAS un fichier qui n'est pas concerne par la demande en cours.
- Ne modifie PAS le schema de base de donnees sans fournir le SQL de migration separe.
- Ne remplace PAS un composant partage sans verifier TOUS ses usages dans docs/components-critiques.md.
- Ne supprime PAS un fichier sans avoir verifie qu'il n'est importe nulle part.
- Ne modifie PAS le CLAUDE.md ou les fichiers docs/ sans demande explicite (sauf mise a jour post-modification comme indique dans la section Consultation).

## Mise a jour de la documentation

Apres toute modification significative (nouvelle feature, nouveau hook, nouvelle route API, nouvelle table, modification d'un composant critique), mets a jour les fichiers docs/ impactes AVANT de considerer la tache terminee.

## Documentation

Destination des notes de session : `docs/sessions/`
Destination des ADR : `docs/adr/`
Langue : francais
Les decisions structurantes et durables sont formalisees en ADR dans docs/adr/.
