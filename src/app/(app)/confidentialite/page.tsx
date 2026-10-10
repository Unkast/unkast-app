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
            disponibilité.
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
        </ul>
        <p>
          Nous ne collectons pas de données sensibles et nous n&apos;utilisons aucun outil de mesure
          d&apos;audience ni de publicité.
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
            <strong>Après la suppression de ton compte</strong> : tes données sont effacées dans les 30
            jours. Ton nom reste dans le générique des films des autres, tel qu&apos;il y figurait, sauf si
            tu demandes son retrait.
          </li>
          <li>
            <strong>Justificatifs de revendication</strong> : 1 an après la décision.
          </li>
          <li>
            <strong>Journaux techniques</strong> : 12 mois.
          </li>
        </ul>
      </Section>

      <Section title="7. Tes droits">
        <p>Où que tu vives, tu peux à tout moment :</p>
        <ul>
          <li>accéder à tes données et en recevoir une copie ;</li>
          <li>les corriger (la plupart se modifient directement dans ton espace) ;</li>
          <li>
            les faire supprimer, avec ton compte : <strong>pendant la bêta</strong>, la suppression du compte
            se demande par email à <Info value={LEGAL.contactEmail} />, depuis l&apos;adresse de ton compte ;
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
