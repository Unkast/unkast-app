// Appels aux routes API de l'espace /moi et types de leurs reponses.
import type { Project, ProjectCredit } from "@/types/database";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  code?: string;
  // Message du serveur (champ `error`), ou message generique.
  error: string;
  data: T;
}

// body : objet (envoye en JSON) ou FormData (multipart). Ne leve jamais.
export async function callApi<T = Record<string, unknown>>(
  url: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: unknown
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      ...(body instanceof FormData
        ? { body }
        : body !== undefined
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
          : {}),
    });
    const data = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      status: res.status,
      code: typeof data.code === "string" ? data.code : undefined,
      error: typeof data.error === "string" && data.error ? data.error : "Une erreur est survenue. Réessaie.",
      data,
    };
  } catch {
    return { ok: false, status: 0, error: "Connexion impossible. Réessaie.", data: {} as T };
  }
}

/* ---------- GET /api/dashboard/projects ---------- */

export interface ManagedProject extends Project {
  credits: ProjectCredit[];
  my_role: "owner" | "manager";
  needs_rights_declaration: boolean;
}

export interface ManagerInvite {
  request_id: string;
  project_id: string;
  project_title: string | null;
  project_slug: string | null;
  invited_by: string | null;
}

export interface FilmsData {
  projects: ManagedProject[];
  owned_count: number;
  limit: number;
  manager_invites: ManagerInvite[];
}

/* ---------- POST /api/dashboard/projects, 409 duplicate ---------- */

export interface DuplicateProject {
  id: string;
  slug: string | null;
  title: string | null;
  is_visible: boolean;
}

export type ShowToast = (message: string) => void;
