# ADR 0018 : page de vente sur unkast.com, dans le même projet que l'app

Date : 01/11/2026
Statut : accepté

## Contexte

La page de vente doit vivre sur unkast.com ; l'app est sur app.unkast.com. L'app Android est une coque Capacitor qui ouvre `https://app.unkast.com/` au lancement (`capacitor.config.ts`) : la racine de app.unkast.com (WelcomeClient) ne peut pas changer.

La page affiche des chiffres qui existent déjà dans le code : 3 films gratuits (`MAX_PROJECTS_FREE`), 2 personnes contactées (`FREE_CONTACT_LIMIT`), 5 nouvelles conversations par jour (`DAILY_CONVERSATION_LIMIT`), date du Pro offert (`LAUNCH_PRO_UNTIL`), libellés des catégories.

## Décision

1. **Même projet Next, même déploiement Vercel.** La page est la route `src/app/site/`.
2. **Aiguillage par domaine dans `next.config.ts`**, pas dans `src/proxy.ts` : réécriture `beforeFiles` de `/` vers `/site` quand le domaine est `unkast.com` ou `www.unkast.com`. Le proxy ignore les préchargements (matcher), une réécriture de configuration s'applique à toutes les requêtes. Le proxy n'est pas modifié.
3. **Le reste de unkast.com renvoie vers app.unkast.com** (redirection temporaire), sauf `/site`, `/_next/` et les chemins avec extension (images, `robots.txt`, `sitemap.xml`) : l'app n'a qu'un domaine.
4. **Styles isolés en CSS Module** (`site.module.css`) : `globals.css` définit déjà `.glass` et la règle Android `.lite .glass`. Polices Inter Tight et Instrument Serif chargées par `src/app/site/layout.tsx` seulement ; l'app garde DM Sans.
5. **Données réelles uniquement**, lues avec la clé publique sans session (la RLS répond comme à un visiteur). Sans film, les blocs de films sont masqués, jamais remplis de faux contenu.
6. **URL canonique `https://unkast.com`** (métadonnées du layout), pour que app.unkast.com/site ne soit pas indexée en double.

## Raison

Alternative écartée : **projet séparé** (dépôt et projet Vercel dédiés). Isolation totale, mais chaque chiffre et chaque prix aurait été recopié à la main ; `constants.ts` rappelle que le nombre de films gratuits a déjà divergé une fois. Deux déploiements à suivre pour une page.

## Conséquences

- `robots.txt` et `sitemap.xml` sont communs aux deux domaines et pointent vers app.unkast.com. Acceptable tant que unkast.com n'a qu'une page.
- Ajouter `unkast.com` et `www.unkast.com` au projet Vercel existant.
- Le layout racine (DM Sans, grain `body::after`, script `.lite`) s'applique aussi à `/site` ; la page neutralise ce qui la gêne dans son module.
- Une seconde page sur unkast.com demandera d'élargir l'exclusion de la redirection.
