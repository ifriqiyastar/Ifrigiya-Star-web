import { CalendarDaysIcon, FunnelIcon, MapPinIcon, TicketIcon, UserIcon } from "lucide-react";

import { Field, FieldGrid } from "@/components/admin/forms/field";
import { CountryCitySelect } from "@/components/admin/country-city-select";
import { PlacePicker } from "@/components/admin/place-picker";
import { ServerForm } from "@/components/admin/server-form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { saveScoutDay } from "@/lib/actions/scout-days";
import type { Country } from "@/lib/countries-api";
import { FOOTBALL_POSITIONS, type EligibilityCriteria } from "@/lib/football";
import { PLAYER_LEVEL, options } from "@/lib/labels";

export type ScoutDayFormValue = {
  id?: string;
  title?: string | null;
  description?: string | null;
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  capacity?: number | null;
  location_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /**
   * Le jsonb tel quel, **pas** un texte libre : le formulaire edite les memes
   * cles que l'application mobile (age_min, positions, levels…), sinon un
   * critere saisi ici serait invisible du controle d'eligibilite du §8.2.
   */
  eligibility_criteria?: EligibilityCriteria | null;
  is_paid?: boolean | null;
  price_amount?: number | null;
  price_currency?: string | null;
};

export type ScoutDayOrganizer = {
  id: string;
  contact_full_name: string | null;
  organization_name: string | null;
};


/** Un bloc du formulaire : pastille d'icone, titre, contenu. */
function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl bg-secondary/40 p-4">
      <header className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
          <Icon className="size-4 text-foreground/70" />
        </span>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

export function ScoutDayForm({
  value,
  organizers = [],
  countries = [],
  submitLabel,
  onSuccess,
}: {
  value?: ScoutDayFormValue;
  /** Professionnels valides pouvant porter l'evenement (creation seulement). */
  organizers?: ScoutDayOrganizer[];
  /** Referentiel pays, charge cote serveur (meme service que l'app mobile). */
  countries?: Country[];
  submitLabel: string;
  onSuccess?: () => void;
}) {
  const criteria: EligibilityCriteria = value?.eligibility_criteria ?? {};

  return (
    <ServerForm action={saveScoutDay} submitLabel={submitLabel} onSuccess={onSuccess} className="space-y-5 p-4 sm:p-5">
      {value?.id ? <input type="hidden" name="id" value={value.id} /> : null}
      {/* L'organisateur identifie l'evenement : on ne le propose donc qu'a la
          creation, pas en modification. */}
      {/* Un `select` requis et vide bloque l'envoi du formulaire sans rien
          dire : le navigateur refuse de soumettre et le clic parait sans
          effet. On explique plutot la cause. */}
      {!value?.id && organizers.length === 0 ? (
        <Section icon={UserIcon} title="Organisateur">
          <p className="text-sm leading-relaxed text-destructive">
            Aucun professionnel valide n&apos;est disponible : un Scout Day est porte par un
            compte professionnel dont le dossier est <strong>valide</strong>
            (`professional_profiles.status = &apos;valide&apos;`), et la cle etrangere
            `scout_days.organizer_id` l&apos;exige. Validez un compte professionnel depuis
            l&apos;ecran Validations, puis revenez ici.
          </p>
        </Section>
      ) : null}

      {value?.id || organizers.length === 0 ? null : (
        <Section
          icon={UserIcon}
          title="Organisateur"
          hint="L'evenement portera son nom. Qui l'a reellement saisi reste tracable cote administration."
        >
          <Field label="Professionnel organisateur" htmlFor="organizer_id">
            <NativeSelect id="organizer_id" name="organizer_id" required>
              <option value="">Selectionner un organisateur</option>
              {organizers.map((organizer) => (
                <option key={organizer.id} value={organizer.id}>
                  {organizer.contact_full_name ?? "Professionnel"}
                  {organizer.organization_name ? ` — ${organizer.organization_name}` : ""}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </Section>
      )}

      <Section icon={CalendarDaysIcon} title="L'evenement">
        <FieldGrid>
          <Field label="Titre" htmlFor="title"><Input id="title" name="title" defaultValue={value?.title ?? ""} required /></Field>
          <Field label="Date" htmlFor="event_date"><Input id="event_date" name="event_date" type="date" defaultValue={value?.event_date?.slice(0, 10) ?? ""} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Debut" htmlFor="start_time"><Input id="start_time" name="start_time" type="time" defaultValue={value?.start_time?.slice(0, 5) ?? ""} /></Field>
            <Field label="Fin" htmlFor="end_time"><Input id="end_time" name="end_time" type="time" defaultValue={value?.end_time?.slice(0, 5) ?? ""} /></Field>
          </div>
          <Field label="Capacite" htmlFor="capacity" hint="Vide = sans limite"><Input id="capacity" name="capacity" type="number" min="1" defaultValue={value?.capacity ?? ""} /></Field>
        </FieldGrid>
        <Field label="Description" htmlFor="description"><Textarea id="description" name="description" defaultValue={value?.description ?? ""} /></Field>
      </Section>

      <Section
        icon={MapPinIcon}
        title="Le lieu"
        hint="Le libelle est obligatoire ; le point sur la carte est facultatif et sert l'itineraire des joueurs."
      >
        <Field label="Lieu" htmlFor="location">
          <Input id="location" name="location" defaultValue={value?.location ?? ""} required />
        </Field>
        <PlacePicker
          latitude={value?.latitude}
          longitude={value?.longitude}
          address={value?.location_address}
        />
      </Section>

      <Section icon={TicketIcon} title="Tarif">
        <FieldGrid>
          <Field label="Tarification" htmlFor="is_paid"><label className="flex h-10 items-center gap-2 text-sm"><input id="is_paid" name="is_paid" type="checkbox" defaultChecked={Boolean(value?.is_paid)} className="size-4 accent-brand" /> Evenement payant</label></Field>
          <Field label="Prix" htmlFor="price_amount"><Input id="price_amount" name="price_amount" type="number" min="0" step="0.001" defaultValue={value?.price_amount ?? 0} /></Field>
          <Field label="Devise" htmlFor="price_currency"><NativeSelect id="price_currency" name="price_currency" defaultValue={value?.price_currency ?? "TND"}><option value="TND">TND</option><option value="EUR">EUR</option><option value="USD">USD</option></NativeSelect></Field>
        </FieldGrid>
      </Section>

      {/* Criteres d'eligibilite — memes champs que le formulaire de
          l'application mobile, et surtout **memes cles** : le controle
          d'eligibilite (§8.2) lit `age_min`, `positions`, `levels`,
          `countries`, `cities`, `free_agent_only`, `other`. Un critere
          range ailleurs ne filtrerait personne. */}
      <Section
        icon={FunnelIcon}
        title="Criteres d'eligibilite"
        hint="Tous facultatifs. Un champ laisse vide n'exclut personne."
      >

        <FieldGrid>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age minimum" htmlFor="age_min">
              <Input id="age_min" name="age_min" type="number" min="10" max="60" defaultValue={criteria.age_min ?? ""} />
            </Field>
            <Field label="Age maximum" htmlFor="age_max">
              <Input id="age_max" name="age_max" type="number" min="10" max="60" defaultValue={criteria.age_max ?? ""} />
            </Field>
          </div>
          <CountryCitySelect
            countries={countries}
            defaultCountry={criteria.countries?.[0]}
            defaultCity={criteria.cities?.[0]}
          />
        </FieldGrid>

        {/* Cases a cocher plutot qu'un `select multiple` : le Ctrl+clic est
            invisible pour qui ne le connait pas, et la feuille mobile coche,
            elle aussi. */}
        <Field label="Postes recherches" hint="Aucun coche = tous les postes.">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {FOOTBALL_POSITIONS.map((position) => (
              <label key={position} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="positions"
                  value={position}
                  defaultChecked={criteria.positions?.includes(position) ?? false}
                  className="size-4 accent-brand"
                />
                <span className="truncate">{position}</span>
              </label>
            ))}
          </div>
        </Field>

        <Field label="Niveaux" htmlFor="levels" hint="Aucun coche = tous les niveaux.">
          <div className="flex flex-wrap gap-4">
            {options(PLAYER_LEVEL).map((level) => (
              <label key={level.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="levels"
                  value={level.value}
                  defaultChecked={criteria.levels?.includes(level.value) ?? false}
                  className="size-4 accent-brand"
                />
                {level.label}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Situation" htmlFor="free_agent_only">
          <label className="flex items-center gap-2 text-sm">
            <input
              id="free_agent_only"
              name="free_agent_only"
              type="checkbox"
              defaultChecked={criteria.free_agent_only ?? false}
              className="size-4 accent-brand"
            />
            Joueurs sans club uniquement
          </label>
        </Field>

        <Field label="Autres exigences" htmlFor="other" hint="Texte libre, affiche aux joueurs.">
          <Textarea id="other" name="other" defaultValue={criteria.other ?? ""} />
        </Field>
      </Section>
    </ServerForm>
  );
}
