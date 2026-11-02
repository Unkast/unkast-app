import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_ACCOUNT_TYPE } from "@/lib/adminSession";

// Statistiques de profil (plan Pro, etape 2). Migration : 20261102_profile_stats.sql.
//
// Le comptage ne doit JAMAIS gener le parcours qui le declenche (profil,
// messagerie, listes) : recordProfileEvent ne leve jamais d'erreur, l'appelant
// le lance dans after() (apres la reponse). Une panne ne coute que des chiffres.
//
// Cle visiteur : `u:<id>` pour un membre connecte, `a:<ip>|<user agent>` pour un
// visiteur anonyme. Elle n'est jamais stockee : la RPC la hache avec le sel du
// jour et l'id du profil, puis l'oublie.

export type ProfileStatKind = "view" | "list_add" | "message_click";

export const memberVisitorKey = (userId: string) => `u:${userId}`;

export async function recordProfileEvent(profileId: string, kind: ProfileStatKind, visitorKey: string): Promise<void> {
  try {
    const { error } = await createAdminClient().rpc("record_profile_event", {
      p_profile_id: profileId,
      p_kind: kind,
      p_visitor_key: visitorKey,
    });
    // Journal sans identifiant (ni profil, ni visiteur).
    if (error) console.warn(`[profile-stats] comptage "${kind}" ignoré :`, error.code ?? error.message);
  } catch (err) {
    console.warn(`[profile-stats] comptage "${kind}" ignoré :`, err);
  }
}

// Robots, aperçus de liens et outils automatiques. Volontairement large : un
// visiteur humain avec un navigateur exotique non compte coute moins qu'un robot compte.
const BOT_UA =
  /bot|crawl|spider|slurp|archiver|fetch|scrape|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|skype|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|curl|wget|python|httpclient|okhttp|axios|node-fetch|go-http|java\/|libwww|postman|insomnia/i;

export function isBot(userAgent: string | null): boolean {
  return !userAgent || userAgent.length < 20 || BOT_UA.test(userAgent);
}

/** Est-ce le compte administrateur ? En cas de doute (lecture en echec), on ne compte pas. */
export async function isAdminAccount(userId: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient()
      .from("profiles")
      .select("is_admin, account_type")
      .eq("id", userId)
      .maybeSingle();
    if (error) return true;
    return data?.is_admin === true || data?.account_type === ADMIN_ACCOUNT_TYPE;
  } catch {
    return true;
  }
}
