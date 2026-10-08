import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { Info, Section } from "@/components/LegalPage";
import { AGE_MINIMUM, LEGAL } from "@/lib/legal";
import { MAX_PROJECTS_FREE } from "@/lib/constants";
import { FREE_CONTACT_LIMIT } from "@/lib/messaging";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation | Unkast",
  description: "Les règles d'utilisation d'Unkast pendant la bêta.",
};

// Texte de la beta. Tout changement de fond impose de changer TERMS_VERSION
// (src/lib/legal.ts), ce qui redemande l'acceptation a tous les membres.
export default function CguPage() {
  return (
    <LegalPage
      title="Conditions générales d'utilisation"
      current="/cgu"
      intro={
        <>
          Unkast est une plateforme où les professionnels du cinéma et de l&apos;audiovisuel présentent leur
          travail, créditent leurs équipes et se font repérer. Le service est édité par{" "}
          <Info value={LEGAL.company} />. En créant un compte, tu acceptes ces règles. Elles sont courtes,
          lis-les.
        </>
      }
    >
      <Section title="1. Une version bêta">
        <p>
          Unkast est en <strong>bêta</strong>. Le service évolue vite : des fonctions peuvent changer,
          apparaître ou disparaître, et des pannes peuvent arriver.
        </p>
        <p>
          Nous faisons de notre mieux, mais le service est fourni <strong>en l&apos;état, sans garantie</strong>{" "}
          de disponibilité ni de résultat. Garde toujours une copie de tes films et de tes textes : Unkast
          n&apos;est pas un lieu de sauvegarde.
        </p>
      </Section>

      <Section title="2. Ton compte">
        <ul>
          <li>Tu dois avoir <strong>{AGE_MINIMUM} ans ou plus</strong>.</li>
          <li>Un compte par personne, avec des informations exactes. Tu peux afficher un nom de scène.</li>
          <li>Tu es responsable de ton mot de passe et de ce qui est fait avec ton compte.</li>
          <li>Tu peux demander la suppression de ton compte à tout moment (voir « Nous contacter »).</li>
        </ul>
      </Section>

      <Section title="3. Publier un film">
        <ul>
          <li>
            <strong>Tu dois avoir les droits.</strong> Tu ne publies que des films dont tu détiens les droits
            de diffusion, ou pour lesquels tu as l&apos;accord de leur détenteur.
          </li>
          <li>
            <strong>Tu le déclares.</strong> À chaque publication, tu indiques ton rôle sur le film et tu
            confirmes détenir ces droits. Pour une publicité ou un clip, tu confirmes aussi que le client ou
            le label a autorisé la diffusion publique. Ta déclaration est enregistrée avec sa date.
          </li>
          <li>
            <strong>Chaque film est validé.</strong> Notre équipe regarde chaque film avant sa mise en ligne.
            Elle peut le refuser, et t&apos;indique alors pourquoi. Tu peux proposer une nouvelle version ou un
            autre film.
          </li>
          <li>
            <strong>La vidéo reste chez YouTube ou Vimeo.</strong> Unkast affiche ta vidéo depuis ces
            plateformes : leurs propres conditions s&apos;appliquent aussi.
          </li>
          <li>
            <strong>Tu restes propriétaire</strong> de ton film. Tu nous autorises seulement à l&apos;afficher
            sur Unkast, avec son image, son titre et son équipe, tant qu&apos;il y est publié.
          </li>
          <li>
            Un compte gratuit peut avoir <strong>{MAX_PROJECTS_FREE} films</strong> en ligne ou en attente de
            validation.
          </li>
          <li>
            Tu peux à tout moment dépublier ou supprimer un film dont tu es Responsable. Si tu choisis
            « Membres seulement », Unkast limite l&apos;accès aux membres connectés, mais ne peut pas garantir
            qu&apos;un festival ne considère pas cela comme une diffusion. La décision t&apos;appartient.
          </li>
        </ul>
      </Section>

      <Section title="4. Créditer une équipe">
        <p>
          Tu ne crédites que des personnes qui ont réellement travaillé sur le film, avec leur vrai rôle. Une
          personne créditée peut demander à être retirée d&apos;un générique : écris-nous.
        </p>
      </Section>

      <Section title="5. Messages et coordonnées">
        <ul>
          <li>
            Le premier contact passe par Unkast. Les <strong>coordonnées personnelles</strong> (téléphone,
            email, réseaux, liens) sont <strong>interdites dans les premiers messages</strong> d&apos;une
            conversation, ainsi que dans ta bio, ton parcours et la description de tes films. C&apos;est une
            protection contre les arnaques.
          </li>
          <li>
            Un compte gratuit peut contacter {FREE_CONTACT_LIMIT} personnes ; répondre est toujours possible.
          </li>
          <li>Pas de démarchage en masse, de harcèlement, ni de fausse offre de travail.</li>
        </ul>
      </Section>

      <Section title="6. Ce qui est interdit">
        <ul>
          <li>Publier le film de quelqu&apos;un d&apos;autre sans son accord, ou se faire passer pour un autre.</li>
          <li>Les contenus illégaux, haineux, violents ou à caractère sexuel explicite.</li>
          <li>Demander de l&apos;argent à quelqu&apos;un pour un casting, un rôle ou une mise en relation.</li>
          <li>Contourner les limites du service ou tenter d&apos;accéder aux données des autres.</li>
        </ul>
      </Section>

      <Section title="7. Signaler un problème">
        <p>
          Chaque profil, film et message peut être signalé depuis l&apos;app. Si un film a été publié sans ton
          accord, utilise « Signaler » sur sa page, puis « Je détiens les droits de ce film », avec un
          justificatif. Notre équipe traite chaque demande.
        </p>
      </Section>

      <Section title="8. Suspension">
        <p>
          Si ces règles ne sont pas respectées, nous pouvons refuser ou retirer un contenu, et suspendre ou
          supprimer un compte, selon la gravité. Dans les cas graves (vol d&apos;œuvre, arnaque, harcèlement),
          la suspension est immédiate. Tu peux contester une décision en nous écrivant.
        </p>
      </Section>

      <Section title="9. Unkast Pro pendant la bêta">
        <ul>
          <li>
            L&apos;offre Pro est <strong>offerte jusqu&apos;au 1er février 2027</strong> aux membres qui en
            bénéficient pendant la bêta.
          </li>
          <li>
            <strong>Sans engagement</strong> : aucun moyen de paiement n&apos;est demandé, rien n&apos;est
            prélevé, rien ne se renouvelle tout seul.
          </li>
          <li>
            À cette date, ton compte repasse en version gratuite. Tes films restent en ligne ; les limites du
            compte gratuit s&apos;appliquent aux nouvelles publications et aux nouveaux contacts.
          </li>
          <li>Si une offre payante est proposée ensuite, tu choisiras librement d&apos;y souscrire ou non.</li>
        </ul>
      </Section>

      <Section title="10. Responsabilité">
        <p>
          Chaque membre est responsable de ce qu&apos;il publie et de ce qu&apos;il écrit. Unkast met des
          personnes en relation mais n&apos;est partie à aucun contrat, engagement ou paiement entre membres :
          vérifie toujours à qui tu as affaire avant de t&apos;engager.
        </p>
        <p>Rien dans ces conditions ne limite les droits que la loi te reconnaît.</p>
      </Section>

      <Section title="11. Évolution de ces conditions">
        <p>
          Ces conditions peuvent changer. En cas de changement important, nous te demanderons de les accepter
          à nouveau lors de ta prochaine connexion. La version que tu as acceptée et sa date sont
          enregistrées.
        </p>
      </Section>

      <Section title="12. Droit applicable">
        <p>
          <Info value={LEGAL.governingLaw} />
        </p>
      </Section>

      <Section title="Nous contacter">
        <p>
          Une question, une demande de suppression, une contestation : <Info value={LEGAL.contactEmail} />.
          Pour tes données personnelles, lis la{" "}
          <Link href="/confidentialite">politique de confidentialité</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
