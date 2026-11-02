import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { Info, Section } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Politique de confidentialité | Unkast",
  description: "Quelles données Unkast collecte, pourquoi, et quels sont tes droits.",
};

// Texte de la beta. Il decrit ce que fait reellement l'app : le mettre a jour
// a chaque nouveau prestataire ou nouvelle donnee collectee, et changer
// TERMS_VERSION (src/lib/legal.ts) si le changement est de fond.
export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      current="/confidentialite"
      intro={
        <>
          Cette page explique quelles données Unkast collecte, à quoi elles servent, qui les traite et
          comment exercer tes droits. Le responsable du traitement est <Info value={LEGAL.company} />,{" "}
          <Info value={LEGAL.address} />.
        </>
      }
    >
      <Section title="1. Les données que nous collectons">
        <ul>
          <li>
            <strong>Ton compte</strong> : adresse email, mot de passe (jamais lisible par nous, il est
            stocké chiffré), ou ton identifiant Google si tu te connectes avec Google.
          </li>
          <li>
            <strong>Ton profil</strong> : nom, prénom, nom de scène, photo, ville, métiers, bio, parcours,
            disponibilité, et, si tu les renseignes pour le casting, tes âges de jeu, ton type de rôle et
            tes langues.
          </li>
          <li>
            <strong>Tes coordonnées</strong>, si tu les renseignes : email de contact, téléphone, Instagram,
            site web.
          </li>
          <li>
            <strong>Tes films</strong> : lien de la vidéo, titre, description, image, équipe créditée,
            déclaration de droits (ton rôle, la date, la version du texte accepté).
          </li>
          <li>
            <strong>Tes échanges</strong> : messages envoyés et reçus, invitations, demandes de crédit.
          </li>
          <li>
            <strong>Les listes des recruteurs</strong> : un membre Pro qui recrute peut ranger des profils
            dans des listes privées et y écrire une remarque courte sur chaque personne (280 caractères au
            plus). Il lui est demandé de n&apos;y mettre aucune information sensible (santé, origine,
            religion, opinions, vie privée).
          </li>
          <li>
            <strong>Les statistiques des profils</strong> : quand quelqu&apos;un consulte un profil, l&apos;ajoute
            à une liste ou clique sur « Envoyer un message », nous l&apos;ajoutons à un compteur de ce profil.
            Pour ne compter chaque personne qu&apos;une fois par jour, nous enregistrons une empreinte
            illisible, calculée à partir de ton identifiant de membre, ou, si tu n&apos;es pas connecté, de ton
            adresse IP et de ton navigateur. Ni l&apos;adresse IP ni ton identifiant ne sont enregistrés. Le
            secret qui sert au calcul change chaque jour et l&apos;ancien est détruit : l&apos;empreinte ne
            permet donc de retrouver personne, ni de te suivre d&apos;un jour à l&apos;autre ou d&apos;un profil à
            l&apos;autre. Ta propre visite, celles des robots et de notre équipe ne sont pas comptées.
          </li>
          <li>
            <strong>La modération</strong> : signalements, revendications et leurs justificatifs, décisions
            prises sur ton compte ou tes films.
          </li>
          <li>
            <strong>Des données techniques</strong> : adresse IP (pour limiter les abus), identifiant de ton
            téléphone pour les notifications si tu les actives, journaux de fonctionnement.
          </li>
          <li>
            <strong>L&apos;acceptation des CGU</strong> : la version acceptée et la date.
          </li>
          <li>
            <strong>La liste d&apos;attente</strong> : si tu laisses ton adresse email pour être prévenu de
            l&apos;ouverture, nous la gardons 12 mois au plus, puis nous la supprimons.
          </li>
          <li>
            <strong>Les personnes créditées sans compte</strong> : quand un membre crédite quelqu&apos;un qui
            n&apos;a pas de compte, nous enregistrons son nom pour l&apos;afficher au générique et, s&apos;il
            l&apos;invite à s&apos;inscrire, son adresse email pour lui envoyer l&apos;invitation. Si tu es
            dans ce cas, écris à <Info value={LEGAL.contactEmail} /> pour demander le retrait de ton nom ou la
            suppression de ton adresse. Nous répondons dans un délai d&apos;un mois.
          </li>
        </ul>
        <p>
          Nous ne collectons pas de données sensibles et nous n&apos;utilisons aucun outil de mesure
          d&apos;audience extérieur ni de publicité. Les statistiques des profils sont calculées par Unkast
          seul, sans cookie.
        </p>
      </Section>

      <Section title="2. Ce qui est visible, et par qui">
        <ul>
          <li>
            <strong>Public</strong> : ton nom affiché (ou ton nom de scène si tu l&apos;as choisi), ta photo,
            ta ville, tes métiers, ta bio, ton parcours et tes films publics.
          </li>
          <li>
            <strong>Visiteurs non connectés</strong> : dans l&apos;équipe d&apos;un film, seuls les
            réalisateurs apparaissent en clair ; les autres personnes apparaissent en initiales.
          </li>
          <li>
            <strong>Jamais affichées publiquement</strong> : ton adresse email de connexion, tes coordonnées,
            tes messages.
          </li>
          <li>
            <strong>Visibles du seul recruteur qui les a créées</strong> : ses listes et les remarques
            qu&apos;il y écrit. Tu n&apos;es pas prévenu quand quelqu&apos;un t&apos;ajoute à une liste, et
            aucun autre membre ne peut les voir. Tu peux en demander l&apos;accès (voir « Tes droits »).
          </li>
          <li>
            <strong>Statistiques de ton profil</strong> : visibles par toi seul, si tu as le Pro. Ce sont des
            chiffres (nombre de visites sur 7 jours, sur 30 jours et au total, nombre d&apos;ajouts à une liste,
            nombre de clics sur « Envoyer un message ») : jamais le nom ni l&apos;identité des personnes.
          </li>
          <li>
            <strong>Notre équipe</strong> peut consulter les contenus signalés et les informations
            nécessaires à la modération.
          </li>
        </ul>
      </Section>

      <Section title="3. À quoi servent tes données">
        <ul>
          <li>
            <strong>Faire fonctionner le service</strong> (ton compte, ton profil, tes films, la messagerie) :
            c&apos;est l&apos;exécution du contrat que tu passes avec nous en acceptant les CGU.
          </li>
          <li>
            <strong>Protéger les membres</strong> (validation des films, signalements, détection des
            coordonnées dans les premiers messages, limites anti-abus) : c&apos;est notre intérêt légitime
            et celui des membres.
          </li>
          <li>
            <strong>T&apos;écrire</strong> pour le fonctionnement du service (confirmation de compte,
            invitation, décision sur un film). Pas de newsletter sans ton accord.
          </li>
          <li>
            <strong>Montrer à chaque membre l&apos;intérêt suscité par son profil</strong> (statistiques
            en chiffres, sans identité) : c&apos;est notre intérêt légitime, et le traitement est réduit au
            strict nécessaire (empreinte renouvelée chaque jour, aucune adresse IP enregistrée).
          </li>
          <li>
            <strong>Respecter la loi</strong> quand elle nous l&apos;impose.
          </li>
        </ul>
        <p>Nous ne vendons aucune donnée et nous n&apos;en transmettons à aucun annonceur.</p>
      </Section>

      <Section title="4. Les prestataires qui traitent tes données">
        <ul>
          <li>
            <strong>Supabase</strong> : base de données, connexion, stockage des images. Région
            d&apos;hébergement : <Info value={LEGAL.hostingRegion} />.
          </li>
          <li>
            <strong>Vercel</strong> : hébergement du site.
          </li>
          <li>
            <strong>Resend</strong> : envoi des emails.
          </li>
          <li>
            <strong>Google</strong> : connexion avec ton compte Google si tu la choisis, et envoi des
            notifications sur ton téléphone (Firebase).
          </li>
          <li>
            <strong>Google Identity Services</strong> : le script de Google se charge uniquement sur les
            pages de connexion et d&apos;inscription, pour proposer « Se connecter avec Google ». Google reçoit
            ton adresse IP et les données techniques de ton navigateur à ce moment.
          </li>
          <li>
            <strong>YouTube et Vimeo</strong> : lecture des vidéos. Nous leur demandons aussi le titre et
            l&apos;image d&apos;une vidéo quand un film est publié.
          </li>
          <li>
            <strong>API YouTube Data</strong> : appelée par nos serveurs pour lire les playlists publiques
            des séries. Aucune donnée d&apos;utilisateur n&apos;est envoyée.
          </li>
          <li>
            <strong>Stripe</strong> : paiement, uniquement si une offre payante est ouverte et que tu y
            souscris. Aucun paiement n&apos;est demandé pendant la bêta.
          </li>
        </ul>
        <p>
          Unkast s&apos;adresse à des membres du monde entier. Tes données sont hébergées dans l&apos;Union
          européenne, mais l&apos;éditeur est établi aux Émirats arabes unis et certains prestataires aux
          États-Unis : des données peuvent donc être traitées hors de ton pays. Quand des données de
          personnes situées dans l&apos;Union européenne en sortent, le transfert est encadré par les
          garanties prévues par le règlement européen (clauses contractuelles types ou décision
          d&apos;adéquation).
        </p>
      </Section>

      <Section title="5. Cookies">
        <ul>
          <li>
            Unkast utilise uniquement les cookies nécessaires à ta connexion. Ils ne servent ni à te suivre
            ni à la publicité, et ne demandent donc pas ton consentement.
          </li>
          <li>
            <strong>Vidéos</strong> : un lecteur YouTube ou Vimeo ne se charge que lorsque tu cliques pour
            lancer une vidéo. À ce moment, la plateforme peut déposer ses propres cookies. Tant que tu ne
            lances pas de vidéo, rien n&apos;est déposé.
          </li>
          <li>
            <strong>Connexion avec Google</strong> : sur les pages de connexion et d&apos;inscription, le
            bouton « Se connecter avec Google » est affiché par Google, qui peut y lire ou déposer ses propres
            cookies. Il n&apos;est chargé sur aucune autre page.
          </li>
        </ul>
      </Section>

      <Section title="6. Combien de temps nous les gardons">
        <ul>
          <li>
            <strong>Ton compte et tes contenus</strong> : tant que ton compte existe.
          </li>
          <li>
            <strong>Après la suppression de ton compte</strong> : tes données sont supprimées
            immédiatement, sauf si ton compte est suspendu (voir plus bas). Les copies de sauvegarde
            disparaissent dans les 30 jours. Ton nom reste dans le générique des films des autres, tel qu&apos;il
            y figurait, sauf si tu demandes son retrait par email.
          </li>
          <li>
            <strong>Ce qui reste après la suppression</strong> : ton nom au générique des films des autres ;
            les déclarations de droits des films qui restent, sans lien avec toi ; tes factures Stripe, que
            la loi nous oblige à conserver ; les journaux techniques (voir ci-dessous).
          </li>
          <li>
            <strong>Listes et remarques des recruteurs</strong> : tant que le recruteur les garde. Elles sont
            supprimées si lui ou la personne concernée supprime son compte.
          </li>
          <li>
            <strong>Statistiques des profils</strong> : les empreintes quotidiennes sont supprimées au bout de
            7 jours ; seuls restent des compteurs par jour, sans aucune empreinte, tant que le profil existe.
            Tout est supprimé avec le profil.
          </li>
          <li>
            <strong>Justificatifs de revendication</strong> : 1 an après la décision, ou supprimés avec ton
            compte s&apos;il est supprimé avant.
          </li>
          <li>
            <strong>Journaux techniques</strong> (adresse IP, appareil, actions de connexion) : conservés au plus
            12 mois, la plupart quelques jours seulement.
          </li>
          <li>
            <strong>Compte suspendu</strong> : un compte suspendu ne peut pas se supprimer lui-même. Écris à{" "}
            <Info value={LEGAL.contactEmail} /> depuis l&apos;adresse de ton compte : la suppression est faite
            dans un délai de 30 jours.
          </li>
          <li>
            <strong>Liste d&apos;attente</strong> : 12 mois au plus après ton inscription.
          </li>
        </ul>
      </Section>

      <Section title="7. Tes droits">
        <p>Où que tu vives, tu peux à tout moment :</p>
        <ul>
          <li>
            accéder à tes données et en recevoir une copie, y compris les remarques qu&apos;un recruteur
            a écrites sur toi dans ses listes ;
          </li>
          <li>les corriger (la plupart se modifient directement dans ton espace) ;</li>
          <li>
            les faire supprimer, avec ton compte : tu peux supprimer ton compte toi-même dans{" "}
            <strong>Mon profil, onglet Compte</strong> (voir <Link href="/supprimer-mon-compte">Supprimer mon
            compte</Link>), ou le demander par email à <Info value={LEGAL.contactEmail} />, depuis
            l&apos;adresse de ton compte ;
          </li>
          <li>t&apos;opposer à un traitement ou en demander la limitation ;</li>
          <li>récupérer tes données dans un format réutilisable.</li>
        </ul>
        <p>
          Écris-nous à <Info value={LEGAL.contactEmail} /> : nous répondons dans un délai d&apos;un mois. Si
          la réponse ne te convient pas, tu peux saisir l&apos;autorité de protection des données de ton pays de
          résidence.
        </p>
        <p>
          Représentant dans l&apos;Union européenne : <Info value={LEGAL.euRepresentative} />.
        </p>
      </Section>

      <Section title="8. Sécurité">
        <p>
          Les échanges avec Unkast sont chiffrés, les accès à la base sont limités par des règles strictes,
          et les justificatifs sont stockés dans un espace privé. Aucun système n&apos;est infaillible : en
          cas d&apos;incident touchant tes données, nous te préviendrons.
        </p>
      </Section>

      <Section title="9. Évolution de cette politique">
        <p>
          Cette politique peut changer, par exemple si nous ajoutons un prestataire. En cas de changement
          important, nous te demanderons de l&apos;accepter à nouveau. Les règles d&apos;utilisation sont
          dans les <Link href="/cgu">CGU</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
