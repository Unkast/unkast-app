import { NextResponse } from "next/server";

// Lecture defensive du body JSON des routes API : request.json() sans
// try/catch plante en 500 brut sur un body malforme. Ici : null si le body
// est absent, non-JSON ou n'est pas un objet -> la route repond un 400 uniforme
// via invalidBodyResponse().
//
// Retour type Record<string, any> (et pas unknown) : les champs destructures
// gardent le meme typage souple que l'ancien await request.json().
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readJsonBody(request: Request): Promise<Record<string, any> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

/** Reponse uniforme pour un body JSON manquant ou malforme. */
export function invalidBodyResponse() {
  return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
}

/**
 * Texte libre recu d'un client : une chaine d'au plus `max` caracteres. Absent ou
 * vide : accepte seulement si `optional`. Toute autre valeur (nombre, objet) est refusee.
 */
export function isText(value: unknown, max: number, optional = false): boolean {
  if (value === undefined || value === null || value === "") return optional;
  return typeof value === "string" && value.length <= max;
}

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_NOTE_LENGTH = 1000;
export const MAX_ROLE_LENGTH = 80;
