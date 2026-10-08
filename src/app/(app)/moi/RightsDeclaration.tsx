// Bloc de declaration de droits : role sur le film, case des droits de diffusion,
// et case de l'accord du client ou du label (publicite et clip).
import {
  CLIENT_AUTHORIZATION_CATEGORIES,
  CLIENT_AUTHORIZATION_TEXT,
  DECLARED_ROLES,
  RIGHTS_DECLARATION_TEXT,
} from "@/lib/constants";
import type { DeclaredRole } from "@/types/database";
import Select from "@/components/ui/Select";
import { CheckRow } from "./parts";

export const needsClientAuthorization = (category: string) =>
  (CLIENT_AUTHORIZATION_CATEGORIES as string[]).includes(category);

export interface Declaration {
  role: DeclaredRole | "";
  rights: boolean;
  client: boolean;
}

export const EMPTY_DECLARATION: Declaration = { role: "", rights: false, client: false };

export const isDeclarationComplete = (d: Declaration, category: string) =>
  d.role !== "" && d.rights && (!needsClientAuthorization(category) || d.client);

// Corps attendu par les routes (POST : a plat ; PATCH : sous `declaration`).
export const declarationPayload = (d: Declaration, category: string) => ({
  declared_role: d.role,
  rights_accepted: d.rights,
  client_authorized: needsClientAuthorization(category) && d.client,
});

export default function RightsDeclaration({
  value,
  onChange,
  category,
}: {
  value: Declaration;
  onChange: (value: Declaration) => void;
  category: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Select
        label="Ton rôle sur ce film"
        value={value.role}
        onChange={(e) => onChange({ ...value, role: e.target.value as DeclaredRole | "" })}
      >
        <option value="">Choisis ton rôle</option>
        {DECLARED_ROLES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </Select>
      <CheckRow checked={value.rights} onChange={(rights) => onChange({ ...value, rights })}>
        {RIGHTS_DECLARATION_TEXT}
      </CheckRow>
      {needsClientAuthorization(category) && (
        <CheckRow checked={value.client} onChange={(client) => onChange({ ...value, client })}>
          {CLIENT_AUTHORIZATION_TEXT}
        </CheckRow>
      )}
    </div>
  );
}
