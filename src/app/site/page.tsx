import { MAX_PROJECTS_FREE } from "@/lib/constants";
import { DAILY_CONVERSATION_LIMIT, FREE_CONTACT_LIMIT } from "@/lib/messaging";
import { LAUNCH_PRO_UNTIL, isLaunchOfferOpen } from "@/lib/pro-plan";
import { formatDateParis } from "@/lib/utils";
import { loadSiteFilms } from "./films";
import Hero from "./Hero";
import { Audience, Faq, Pricing } from "./interactive";
import { Catalogue, FinalCta, Footer, Manifesto, Nav, Network, RolesMarquee, Steps, Trust } from "./sections";
import s from "./site.module.css";

// Limites du plan gratuit, lues dans le code de l'app (jamais recopiees en dur).
const LIMITS = { freeFilms: MAX_PROJECTS_FREE, freeContacts: FREE_CONTACT_LIMIT, dailyConversations: DAILY_CONVERSATION_LIMIT };

// Films et fin de l'offre de lancement recalcules au plus une fois par heure.
export const revalidate = 3600;

export default async function SitePage() {
  const offerUntil = isLaunchOfferOpen() ? formatDateParis(LAUNCH_PRO_UNTIL, "long") : null;
  const films = await loadSiteFilms();
  // Film a la une : le plus recent avec une image (aucun : blocs titre masques).
  const featured = films.find((f) => f.poster) ?? null;

  return (
    <div className={s.root}>
      <div className={s.progress} aria-hidden="true"></div>
      <svg className={s.grain} aria-hidden="true"><filter id="unk-noise"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"></feTurbulence></filter><rect width="100%" height="100%" filter="url(#unk-noise)"></rect></svg>
      <Nav />
      <main>
        <Hero film={featured} offerUntil={offerUntil} />
        <RolesMarquee />
        <Manifesto />
        <Catalogue films={films} />
        <Steps />
        <Network film={films.filter((f) => f.poster)[1] ?? featured} />
        <Audience film={films.filter((f) => f.poster)[2] ?? featured} />
        <Trust />
        <Pricing offerUntil={offerUntil} limits={LIMITS} />
        <Faq limits={LIMITS} />
        <FinalCta offerUntil={offerUntil} />
      </main>
      <Footer />
    </div>
  );
}
