// Transition partagee « vignette -> lecteur de la page film » (View Transitions).
//
// Un meme film peut apparaitre plusieurs fois sur une page (a la une, rangees) :
// seule la vignette cliquee porte le nom de transition, pose au moment du clic.
// Au retour, la meme vignette le porte encore, et la position de defilement de
// la page de depart est remise (c'est le <main> d'AppShell qui defile, ni Next ni
// le navigateur ne le restaurent).

/** Nom de transition commun a la vignette cliquee et au lecteur de la page film. */
export const FILM_POSTER_NAME = "film-poster";
/** Classe de transition (regles ::view-transition-*(.film-share) de globals.css). */
export const FILM_SHARE_CLASS = "film-share";

let activeKey: string | null = null;
let savedScroll: { path: string; top: number } | null = null;
const listeners = new Set<() => void>();

export function subscribeFilmClick(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getActiveFilmKey() {
  return activeKey;
}

/** A appeler au clic sur une vignette, avant la navigation. */
export function markFilmClick(key: string) {
  activeKey = key;
  const main = document.querySelector("main");
  savedScroll = main ? { path: window.location.pathname, top: main.scrollTop } : null;
  listeners.forEach((l) => l());
}

/** Position a remettre au premier retour sur la page d'ou l'on a ouvert un film (une seule fois). */
export function takeSavedScroll(path: string): number | null {
  if (savedScroll?.path !== path) return null;
  const { top } = savedScroll;
  savedScroll = null;
  return top;
}

function nameForTransition(el: HTMLElement, on: boolean) {
  el.style.setProperty("view-transition-name", on ? FILM_POSTER_NAME : "");
  el.style.setProperty("view-transition-class", on ? FILM_SHARE_CLASS : "");
}

/**
 * Bouton « Retour » de la page film : le lecteur se referme vers la vignette d'ou
 * l'on vient. React n'anime pas un retour dans l'historique : la transition est
 * lancee ici. Sans vignette de depart ou sans View Transitions : retour simple.
 */
export function backWithTransition(player: HTMLElement | null, back: () => void) {
  if (!player || !activeKey || typeof document.startViewTransition !== "function") return back();

  nameForTransition(player, true);
  let target: HTMLElement | null = null;
  const from = window.location.pathname;
  const deadline = performance.now() + 1500;

  const transition = document.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        let ticksAfterChange = 0;
        const check = () => {
          const changed = window.location.pathname !== from;
          target = changed ? document.querySelector<HTMLElement>("[data-film-share]") : null;
          if (changed && !target) ticksAfterChange += 1;
          if (target || ticksAfterChange > 3 || performance.now() > deadline) {
            if (player.isConnected) nameForTransition(player, false);
            if (target) nameForTransition(target, true);
            resolve();
          } else setTimeout(check, 16);
        };
        back();
        setTimeout(check, 16);
      })
  );
  const clean = () => { if (target) nameForTransition(target, false); };
  transition.ready.catch(() => {});
  transition.finished.then(clean, clean);
}
