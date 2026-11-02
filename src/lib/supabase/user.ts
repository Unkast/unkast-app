import { cache } from "react";
import { createClient } from "./server";

// Utilisateur de la requete, VERIFIE aupres de Supabase Auth (auth.getUser(), jamais
// getSession) : le layout (app) et la page rendus dans la meme requete partagent un
// seul appel. cache() vit le temps d'une requete serveur, rien n'est garde entre deux.
// Pour decider d'un droit, c'est toujours ce resultat, pas un cookie lu a la main.
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});
