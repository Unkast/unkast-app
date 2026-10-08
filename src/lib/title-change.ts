// Un titre a-t-il nettement change depuis sa validation par l'admin ?
// Sert a la liste « modifies recemment » de l'admin : une faute corrigee, un
// pluriel ou quelques mots ajoutes passent ; un titre remplace, ou allonge au
// point de doubler, remonte.

// Comparaison sans casse, accents ni ponctuation.
function normalize(title: string): string {
  return title.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
}

// Distance d'edition (Levenshtein), deux lignes en memoire.
function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

/** Vrai si moins de 60 % du titre valide se retrouve dans le titre actuel. */
export function titleChangedALot(approved: string, current: string): boolean {
  const a = normalize(approved);
  const b = normalize(current);
  if (a === b) return false;
  const longest = Math.max(a.length, b.length);
  return 1 - distance(a, b) / longest < 0.6;
}
