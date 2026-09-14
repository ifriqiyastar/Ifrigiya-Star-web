"use client";

import { useAdminTranslations } from "@/lib/i18n/admin-client";


import * as React from "react";
import { toast } from "sonner";

import { Field, FieldGrid } from "@/components/admin/forms/field";
import { SubmitRow } from "@/components/admin/forms/submit-row";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FOOT_PREFERENCE, PLAYER_LEVEL } from "@/lib/labels";
import type { ActionResult } from "@/lib/actions/result";

export type PlayerProfileValues = {
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  nationality: string | null;
  country: string | null;
  city: string | null;
  main_position: string | null;
  secondary_position: string | null;
  foot_preference: string | null;
  current_club: string | null;
  is_free_agent: boolean;
  height_cm: number | string | null;
  weight_kg: number | string | null;
  level: string;
  about: string | null;
};

/**
 * Profil sportif (§5.1). Les postes sont des colonnes `text` libres cote base
 * — la liste proposee reprend celle de l'app mobile (`FOOTBALL_POSITIONS`),
 * mais on garde un champ ouvert pour ne pas perdre une valeur historique
 * saisie librement.
 */
const POSITIONS = [
  "Gardien de but",
  "Defenseur central",
  "Lateral droit",
  "Lateral gauche",
  "Milieu defensif",
  "Milieu central",
  "Milieu offensif",
  "Ailier droit",
  "Ailier gauche",
  "Attaquant de soutien",
  "Avant-centre",
];

export function PlayerProfileForm({
  values,
  action,
}: {
  values: PlayerProfileValues;
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

  const positionOptions = [
    ...new Set(
      [values.main_position, values.secondary_position]
        .filter((value): value is string => Boolean(value) && !POSITIONS.includes(value!))
        .concat(POSITIONS),
    ),
  ];

  return (
    <form onSubmit={submit}>
      <div className="space-y-5 px-4 py-5 sm:px-5">
        <FieldGrid>
          <Field label={i18n.t("Prenom")} htmlFor="first_name">
            <Input id="first_name" name="first_name" defaultValue={values.first_name ?? ""} required />
          </Field>
          <Field label={i18n.t("Nom")} htmlFor="last_name">
            <Input id="last_name" name="last_name" defaultValue={values.last_name ?? ""} required />
          </Field>
          <Field label={i18n.t("Date de naissance")} htmlFor="birth_date">
            <Input
              id="birth_date"
              name="birth_date"
              type="date"
              defaultValue={values.birth_date ?? ""}
              required
            />
          </Field>
          <Field label={i18n.t("Nationalite")} htmlFor="nationality">
            <Input id="nationality" name="nationality" defaultValue={values.nationality ?? ""} />
          </Field>
          <Field label={i18n.t("Pays")} htmlFor="country">
            <Input id="country" name="country" defaultValue={values.country ?? ""} />
          </Field>
          <Field label={i18n.t("Ville")} htmlFor="city">
            <Input id="city" name="city" defaultValue={values.city ?? ""} />
          </Field>
          <Field label={i18n.t("Poste principal")} htmlFor="main_position">
            <NativeSelect
              id="main_position"
              name="main_position"
              defaultValue={values.main_position ?? ""}
            >
              <option value="">{i18n.t("Non renseigne")}</option>
              {positionOptions.map((position) => (
                <option key={position} value={position}>
                  {i18n.labels.position(position)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={i18n.t("Poste secondaire")} htmlFor="secondary_position">
            <NativeSelect
              id="secondary_position"
              name="secondary_position"
              defaultValue={values.secondary_position ?? ""}
            >
              <option value="">{i18n.t("Non renseigne")}</option>
              {positionOptions.map((position) => (
                <option key={position} value={position}>
                  {i18n.labels.position(position)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={i18n.t("Pied fort")} htmlFor="foot_preference">
            <NativeSelect
              id="foot_preference"
              name="foot_preference"
              defaultValue={values.foot_preference ?? ""}
            >
              <option value="">{i18n.t("Non renseigne")}</option>
              {i18n.labels.options(FOOT_PREFERENCE).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={i18n.t("Niveau")} htmlFor="level">
            <NativeSelect id="level" name="level" defaultValue={values.level}>
              {i18n.labels.options(PLAYER_LEVEL).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={i18n.t("Club actuel")} htmlFor="current_club">
            <Input id="current_club" name="current_club" defaultValue={values.current_club ?? ""} />
          </Field>
          <Field label={i18n.t("Taille (cm)")} htmlFor="height_cm" hint={i18n.t("Entre 100 et 230 (contrainte en base).")}>
            <Input
              id="height_cm"
              name="height_cm"
              type="number"
              min={100}
              max={230}
              step="0.5"
              defaultValue={values.height_cm ?? ""}
            />
          </Field>
          <Field label={i18n.t("Poids (kg)")} htmlFor="weight_kg" hint={i18n.t("Entre 30 et 150 (contrainte en base).")}>
            <Input
              id="weight_kg"
              name="weight_kg"
              type="number"
              min={30}
              max={150}
              step="0.5"
              defaultValue={values.weight_kg ?? ""}
            />
          </Field>
        </FieldGrid>

        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="is_free_agent"
            defaultChecked={values.is_free_agent}
            className="size-4 accent-brand"
          />
          {i18n.t("Joueur libre")}</label>

        <Field label={i18n.t("A propos")} htmlFor="about">
          <Textarea id="about" name="about" rows={4} defaultValue={values.about ?? ""} />
        </Field>
      </div>
      <SubmitRow pending={pending} />
    </form>
  );
}
