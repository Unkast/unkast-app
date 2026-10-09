import { FilmPlayerFrame } from "@/components/FilmLink";

const BAR = "rounded bg-white/[0.07]";

// Cale sur ProjetClient : « Retour », lecteur 16:9 (max 1080 px), puis deux colonnes.
// Le cadre du lecteur porte le meme nom de transition que la page : la vignette
// cliquee s'agrandit vers lui si la page n'est pas encore chargee.
export default function ProjectSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1160px] px-4 pb-10 pt-5 lg:px-10 lg:pb-16 lg:pt-9">
      <div className={`mb-5 mt-3.5 h-4 w-16 animate-pulse ${BAR}`} />
      <FilmPlayerFrame>
        <div className="aspect-video w-full rounded-[22px] border border-white/10 bg-glass-solid" />
      </FilmPlayerFrame>

      <div className="mt-8 grid animate-pulse gap-7 lg:mt-11 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div className="min-w-0">
          {/* Infos, titre, description, boutons */}
          <div className={`h-3.5 w-40 ${BAR}`} />
          <div className={`mt-4 h-10 w-3/4 lg:h-14 ${BAR}`} />
          <div className="mt-5 space-y-2.5">
            <div className={`h-4 w-full max-w-[620px] ${BAR}`} />
            <div className={`h-4 w-4/5 max-w-[500px] ${BAR}`} />
          </div>
          <div className="mt-6 flex gap-2.5">
            <div className="h-11 w-40 rounded-pill bg-white/[0.07]" />
            <div className="h-11 w-32 rounded-pill bg-white/[0.07]" />
          </div>

          {/* Equipe en generique */}
          <div className={`mb-4 mt-12 h-6 w-24 ${BAR}`} />
          <div className="grid gap-x-7 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex min-h-16 items-center gap-3.5 border-b border-white/[0.07]">
                <div className={`h-3 w-[110px] ${BAR}`} />
                <div className="size-9 rounded-full bg-white/[0.07]" />
                <div className={`h-3.5 w-28 ${BAR}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Colonne : realise par, fiche technique */}
        <div className="flex flex-col gap-3.5">
          <div className="glass h-[168px] rounded-card" />
          <div className="glass h-[140px] rounded-card" />
        </div>
      </div>
    </div>
  );
}
