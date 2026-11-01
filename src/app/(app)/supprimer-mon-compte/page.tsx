import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { Info, Section } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Supprimer mon compte | Unkast",
  description: "Comment supprimer ton compte Unkast, ce qui est supprimé, ce qui reste et les délais.",
};

// Page publique, sans connexion : adresse a donner a Google Play pour la suppression
// de compte. Elle decrit ce que fait reellement POST /api/account/delete et les
// triggers de la migration 20261101 : la mettre a jour avec eux.
export default function SupprimerMonComptePage() {
  return (
    <LegalPage
      title="Supprimer mon compte"
      current="/supprimer-mon-compte"
      intro={
        <>
          Tu peux supprimer ton compte Unkast à tout moment, toi-même, dans l&apos;application Android comme
          sur le site. La suppression est immédiate et définitive.
        </>
      }
    >
      <Section title="1. Dans l'application ou sur le site">
        <ul>
          <li>Connecte-toi à ton compte Unkast.</li>
          <li>
            Ouvre <strong>Mon profil</strong>, puis l&apos;onglet <strong>Compte</strong>.
          </li>
          <li>
            Tout en bas, touche <strong>Supprimer mon compte</strong>.
          </li>
          <li>
            Lis ce qui est supprimé, puis tape l&apos;adresse email de ton compte pour confirmer. Pour un compte
            créé avec Google, c&apos;est l&apos;adresse de ce compte Google. Aucun mot de passe n&apos;est demandé.
          </li>
          <li>
            Touche <strong>Supprimer</strong>. Tu reçois un email pour te confirmer la suppression.
          </li>
        </ul>
        <p>
          Si tu as un abonnement Pro, il est résilié tout de suite, <strong>sans remboursement</strong> de la
          période en cours.
        </p>
      </Section>

      <Section title="2. Ce qui est supprimé">
        <ul>
          <li>ton profil : nom, nom de scène, photo, description, métiers, parcours, coordonnées ;</li>
          <li>les films dont tu es Responsable et pour lesquels tu es la seule personne créditée, avec leur image ;</li>
          <li>
            tes conversations et tes messages, <strong>y compris chez l&apos;autre personne</strong> ;
          </li>
          <li>tes demandes de crédit, tes invitations envoyées et reçues, tes demandes de co-gestion ;</li>
          <li>tes justificatifs de revendication et les autres fichiers que tu avais envoyés ;</li>
          <li>tes notifications sur le téléphone, ta présence dans les listes de recrutement ;</li>
          <li>ton abonnement Pro, qui est résilié.</li>
        </ul>
      </Section>

      <Section title="3. Ce qui reste">
        <ul>
          <li>
            <strong>Ton nom au générique des films des autres</strong>, tel qu&apos;il y figurait, sans lien vers
            un compte.
          </li>
          <li>
            Un film où d&apos;autres personnes sont créditées passe au co-gestionnaire le plus ancien. S&apos;il
            n&apos;y en a pas, il reste, dépublié, sans Responsable.
          </li>
          <li>Les déclarations de droits de ces films, sans lien avec toi.</li>
          <li>Les signalements que tu avais faits, sans ton nom.</li>
          <li>Tes factures Stripe, que la loi nous oblige à conserver.</li>
          <li>Les journaux techniques (voir les délais ci-dessous).</li>
        </ul>
      </Section>

      <Section title="4. Les délais">
        <ul>
          <li>
            <strong>Tes données sont supprimées immédiatement</strong>, au moment où tu confirmes.
          </li>
          <li>Les copies de sauvegarde disparaissent dans les 30 jours.</li>
          <li>
            <strong>Journaux techniques</strong> (adresse IP, appareil, actions de connexion) : conservés au plus
            12 mois, la plupart quelques jours seulement.
          </li>
        </ul>
        <p>
          Plus de détails dans la <Link href="/confidentialite">politique de confidentialité</Link>.
        </p>
      </Section>

      <Section title="5. Par email">
        <p>
          Tu ne peux pas ouvrir l&apos;application, ou ton compte est suspendu : écris-nous à{" "}
          <Info value={LEGAL.contactEmail} />, <strong>depuis l&apos;adresse de ton compte</strong>. Nous traitons
          ta demande dans les 30 jours.
        </p>
        <p>
          Un compte suspendu ne peut pas se supprimer lui-même : c&apos;est la seule voie.
        </p>
      </Section>
    </LegalPage>
  );
}
