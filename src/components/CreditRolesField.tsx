"use client";

import RoleSelector from "@/components/RoleSelector";
import { MAX_CREDIT_ROLES } from "@/lib/credits";

// Roles d'une personne sur un film : plusieurs metiers choisis dans la liste fermee,
// jamais de texte libre (une seule ligne par personne, voir lib/credits.ts). Le
// serveur controle de nouveau chaque metier. Utilise par la demande de credit, les
// invitations, la modification d'un role et la publication.
export default function CreditRolesField({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (roles: string[]) => void;
  placeholder?: string;
}) {
  return (
    <RoleSelector
      selectedRoles={value}
      onChange={onChange}
      maxSelection={MAX_CREDIT_ROLES}
      allowCustom={false}
      showPrimary={false}
      placeholder={placeholder}
    />
  );
}
