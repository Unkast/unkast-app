import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { Info, Section } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Mentions légales | Unkast",
  description: "Éditeur, hébergeur et contact d'Unkast.",
};

export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales" current="/mentions-legales">
      <Section title="Éditeur du site">
        <ul>
          <li>
            Société : <Info value={LEGAL.company} />
          </li>
          <li>
            Forme juridique : <Info value={LEGAL.legalForm} />
          </li>
          <li>
            Capital social : <Info value={LEGAL.capital} />
          </li>
          <li>
            Siège : <Info value={LEGAL.address} />
          </li>
          <li>
            Immatriculation : <Info value={LEGAL.registration} />
          </li>
          <li>
            Directeur de la publication : <Info value={LEGAL.publisher} />
          </li>
          <li>
            Contact : <Info value={LEGAL.contactEmail} />
          </li>
        </ul>
      </Section>

      <Section title="Hébergeur">
        <p>
          Le site est hébergé par <strong>Vercel Inc.</strong>, 440 N Barranca Avenue #4133, Covina, CA 91723,
          États-Unis (
          <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">
            vercel.com
          </a>
          ).
        </p>
        <p>
          La base de données et les fichiers sont hébergés par <strong>Supabase</strong>, région{" "}
          <Info value={LEGAL.hostingRegion} />.
        </p>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          La marque Unkast, le site et son habillage appartiennent à leur éditeur. Les films, images et
          textes publiés par les membres restent la propriété de leurs auteurs et ayants droit : ils ne
          peuvent pas être repris sans leur accord.
        </p>
      </Section>

      <Section title="Signaler un contenu">
        <p>
          Pour signaler un contenu illicite ou un film publié sans ton accord, utilise le bouton « Signaler »
          sur la page concernée, ou écris à <Info value={LEGAL.contactEmail} /> en indiquant l&apos;adresse de
          la page et le motif.
        </p>
      </Section>

      <Section title="Données personnelles">
        <p>
          Tout est expliqué dans la <Link href="/confidentialite">politique de confidentialité</Link>. Les
          règles d&apos;utilisation sont dans les <Link href="/cgu">CGU</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
