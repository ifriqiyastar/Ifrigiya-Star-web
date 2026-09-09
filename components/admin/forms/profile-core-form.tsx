"use client";

import * as React from "react";
import { toast } from "sonner";

import { Field, FieldGrid } from "@/components/admin/forms/field";
import { SubmitRow } from "@/components/admin/forms/submit-row";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ROLE, options } from "@/lib/labels";
import type { ActionResult } from "@/lib/actions/result";

export type ProfileCoreValues = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  locale: string | null;
  role: string;
};

/**
 * Fiche compte (§12.1 « Consultation et modification des comptes »).
 *
 * `email` est en lecture seule : la colonne `profiles.email` n'est qu'un
 * miroir de `auth.users.email`, et changer l'adresse de connexion passe par
 * l'API Auth Admin (cle `service_role`). L'ecrire ici desynchroniserait
 * l'affichage de l'identifiant reellement utilise pour se connecter.
 */
export function ProfileCoreForm({
  values,
  action,
  canChangeRole,
}: {
  values: ProfileCoreValues;
  action: (formData: FormData) => Promise<ActionResult>;
  canChangeRole: boolean;
}) {
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);
    try {
      const result = await action(formData);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="space-y-5 px-4 py-5 sm:px-5">
        <FieldGrid>
          <Field label="Nom complet" htmlFor="full_name">
            <Input id="full_name" name="full_name" defaultValue={values.full_name ?? ""} />
          </Field>
          <Field
            label="Adresse email"
            htmlFor="email"
            hint="Non modifiable ici : l'adresse sert d'identifiant de connexion."
          >
            <Input id="email" defaultValue={values.email ?? ""} disabled readOnly />
          </Field>
          <Field label="Telephone" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={values.phone ?? ""} />
          </Field>
          <Field label="Langue" htmlFor="locale" hint="La V1 de l'application est francophone.">
            <NativeSelect id="locale" name="locale" defaultValue={values.locale ?? "fr"}>
              <option value="fr">Francais</option>
              <option value="en">Anglais</option>
              <option value="ar">Arabe</option>
            </NativeSelect>
          </Field>
          <Field
            label="Role"
            htmlFor="role"
            hint={
              canChangeRole
                ? "Changer le role modifie les droits d'acces dans toute l'application."
                : "Vous ne pouvez pas modifier votre propre role (garde-fou en base)."
            }
          >
            <NativeSelect
              id="role"
              name="role"
              defaultValue={values.role}
              disabled={!canChangeRole}
            >
              {options(ROLE).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </FieldGrid>
      </div>
      <SubmitRow pending={pending} />
    </form>
  );
}
