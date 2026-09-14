"use client";

import { useAdminTranslations } from "@/lib/i18n/admin-client";


import * as React from "react";
import { toast } from "sonner";

import { Field, FieldGrid } from "@/components/admin/forms/field";
import { SubmitRow } from "@/components/admin/forms/submit-row";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PROFESSIONAL_TYPE } from "@/lib/labels";
import type { ActionResult } from "@/lib/actions/result";

export type ProfessionalProfileValues = {
  professional_type: string;
  organization_name: string | null;
  contact_full_name: string | null;
  position_title: string | null;
  country: string | null;
  city: string | null;
};

export function ProfessionalProfileForm({
  values,
  action,
}: {
  values: ProfessionalProfileValues;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const i18n = useAdminTranslations();

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
          <Field label={i18n.t("Type de compte")} htmlFor="professional_type">
            <NativeSelect
              id="professional_type"
              name="professional_type"
              defaultValue={values.professional_type}
            >
              {i18n.labels.options(PROFESSIONAL_TYPE).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label={i18n.t("Organisation")}
            htmlFor="organization_name"
            hint={i18n.t("Obligatoire cote application pour un club ou une academie.")}
          >
            <Input
              id="organization_name"
              name="organization_name"
              defaultValue={values.organization_name ?? ""}
            />
          </Field>
          <Field label={i18n.t("Nom du contact")} htmlFor="contact_full_name">
            <Input
              id="contact_full_name"
              name="contact_full_name"
              defaultValue={values.contact_full_name ?? ""}
              required
            />
          </Field>
          <Field label={i18n.t("Fonction")} htmlFor="position_title">
            <Input
              id="position_title"
              name="position_title"
              defaultValue={values.position_title ?? ""}
            />
          </Field>
          <Field label={i18n.t("Pays")} htmlFor="country">
            <Input id="country" name="country" defaultValue={values.country ?? ""} />
          </Field>
          <Field label={i18n.t("Ville")} htmlFor="city">
            <Input id="city" name="city" defaultValue={values.city ?? ""} />
          </Field>
        </FieldGrid>
      </div>
      <SubmitRow pending={pending} />
    </form>
  );
}
