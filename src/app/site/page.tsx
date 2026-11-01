import { LAUNCH_PRO_UNTIL, isLaunchOfferOpen } from "@/lib/pro-plan";
import { formatDateParis } from "@/lib/utils";
import Hero from "./Hero";
import { Catalogue, Manifesto, Nav, RolesMarquee, Steps } from "./sections";
import s from "./site.module.css";

export default function SitePage() {
  const offerUntil = isLaunchOfferOpen() ? formatDateParis(LAUNCH_PRO_UNTIL, "long") : null;

  return (
    <div className={s.root}>
      <div className={s.progress} aria-hidden="true"></div>
      <svg className={s.grain} aria-hidden="true"><filter id="unk-noise"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"></feTurbulence></filter><rect width="100%" height="100%" filter="url(#unk-noise)"></rect></svg>
      <Nav />
      <Hero film={null} offerUntil={offerUntil} />
      <RolesMarquee />
      <Manifesto />
      <Catalogue films={[]} />
      <Steps />
    </div>
  );
}
