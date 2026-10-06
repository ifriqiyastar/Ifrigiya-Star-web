"use client";

import { useAdminTranslations } from "@/lib/i18n/admin-client";
import { CalendarDaysIcon, FunnelIcon, MapPinIcon, TicketIcon, UserIcon } from "lucide-react";

import { Field, FieldGrid } from "@/components/admin/forms/field";
import { CountryCitySelect } from "@/components/admin/country-city-select";
import { PlacePicker } from "@/components/admin/place-picker";
import { ServerForm } from "@/components/admin/server-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { saveScoutDay } from "@/lib/actions/scout-days";
import type { Country } from "@/lib/countries-api";
import { FOOTBALL_POSITIONS, type EligibilityCriteria } from "@/lib/football";
import { PLAYER_LEVEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

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

/**
 * Un bloc du formulaire : numero d'etape, pastille d'icone, titre, contenu.
 * Le numero dit ou l'on en est dans un formulaire long, le meme langage que
 * les etapes du formulaire d'evaluation.
 */
function Section({
  step,
  icon: Icon,
  title,
  hint,
  children,
}: {
  step: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card/60 p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/20">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="micro-label text-brand">{step}</p>
          <h3 className="font-heading text-sm font-bold">{title}</h3>
          {hint ? <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

/**
 * Une case a cocher presentee en puce : la case native reste dans le
 * formulaire (le serveur lit `"on"` ou la valeur, comme avant) mais n'est plus
 * dessinee. La puce s'allume en vert quand elle est cochee et porte l'anneau de
 * focus au clavier — `has-[:checked]` et `has-[:focus-visible]` lisent l'etat
 * de la case qu'elle contient, sans etat React.
 *
 * ⚠️ `relative` sur l'etiquette n'est pas decoratif. La case est `sr-only`,
 * donc en position absolue : sans ancetre positionne proche, elle se placait
 * par rapport a la fenetre entiere. Au clic, le navigateur lui donne le focus
 * et fait defiler son conteneur pour la montrer — c'etait la fenetre, en
 * `overflow-hidden`, dont tout le contenu glissait hors du cadre : la
 * fenetre devenait entierement noire.
 */
function Chip({
  name,
  value,
  id,
  defaultChecked,
  children,
  className,
}: {
  name: string;
  value?: string;
  id?: string;
  defaultChecked?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "relative flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors select-none",
        "hover:border-brand/40 hover:text-foreground",
        "has-[:checked]:border-brand/60 has-[:checked]:bg-brand/12 has-[:checked]:text-brand",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40",
        className,
      )}
    >
      <input
        type="checkbox"
        id={id}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      {/* Le petit carre : vide au repos, plein et coche une fois choisi. */}
      <span
        aria-hidden
        className="flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border border-muted-foreground/50 peer-checked:border-brand peer-checked:bg-brand peer-checked:[&>svg]:opacity-100"
      >
        <svg viewBox="0 0 12 12" className="size-2.5 text-brand-foreground opacity-0" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m2.5 6 2.5 2.5 4.5-5" />
        </svg>
      </span>
      <span className="truncate">{children}</span>
    </label>
  );
}

export function ScoutDayForm({
  value,
  organizers = [],
  countries = [],
  submitLabel,
  onSuccess,
  onCancel,
}: {
  value?: ScoutDayFormValue;
  /** Professionnels valides pouvant porter l'evenement (creation seulement). */
  organizers?: ScoutDayOrganizer[];
  /** Referentiel pays, charge cote serveur (meme service que l'app mobile). */
  countries?: Country[];
  submitLabel: string;
  onSuccess?: () => void;
  /** Ferme la fenetre sans enregistrer. */
  onCancel?: () => void;
}) {
  const i18n = useAdminTranslations();

  const criteria: EligibilityCriteria = value?.eligibility_criteria ?? {};
  const editing = Boolean(value?.id);
  const withOrganizer = !editing;
  // Les etapes se numerotent selon ce qui est affiche : en modification il
  // n'y a pas d'organisateur, et la premiere section ne doit pas s'appeler 02.
  const step = (index: number) =>
    `${i18n.t("Etape")} ${String(index + (withOrganizer ? 1 : 0)).padStart(2, "0")}`;

  return (
    <ServerForm
      action={saveScoutDay}
      submitLabel={submitLabel}
      onSuccess={onSuccess}
      className="flex min-h-0 flex-1 flex-col"
      renderSubmit={(submit) => (
        // Pied fixe : les boutons restent visibles quel que soit l'endroit du
        // formulaire ou l'on se trouve.
        <div className="flex flex-col-reverse gap-3 border-t border-border bg-popover px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-[0.6875rem] text-muted-foreground">
            {editing
              ? i18n.t("Les inscrits seront notifies si la date, l'heure ou le lieu change.")
              : i18n.t("Cree en brouillon : rien n'est visible des joueurs avant publication.")}
          </p>
          <div className="flex shrink-0 items-center justify-end gap-2">
            {onCancel ? (
              <Button type="button" variant="ghost" onClick={onCancel}>
                {i18n.t("Annuler")}
              </Button>
            ) : null}
            {submit}
          </div>
        </div>
      )}
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
        {value?.id ? <input type="hidden" name="id" value={value.id} /> : null}
        {/* L'organisateur identifie l'evenement : on ne le propose donc qu'a la
            creation, pas en modification. */}
        {/* Un `select` requis et vide bloque l'envoi du formulaire sans rien
            dire : le navigateur refuse de soumettre et le clic parait sans
            effet. On explique plutot la cause. */}
        {withOrganizer && organizers.length === 0 ? (
          <Section step={step(0)} icon={UserIcon} title={i18n.t("Organisateur")}>
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs leading-relaxed text-destructive">
              {i18n.t("Aucun professionnel valide n'est disponible : un Scout Day est porte par un compte professionnel dont le dossier est")} <strong>{i18n.t("valide")}</strong>
              {i18n.t("(`professional_profiles.status = 'valide'`), et la cle etrangere `scout_days.organizer_id` l'exige. Validez un compte professionnel depuis l'ecran Validations, puis revenez ici.")}</p>
          </Section>
        ) : null}

        {withOrganizer && organizers.length > 0 ? (
          <Section
            step={step(0)}
            icon={UserIcon}
            title={i18n.t("Organisateur")}
            hint={i18n.t("L'evenement portera son nom. Qui l'a reellement saisi reste tracable cote administration.")}
          >
            <Field label={i18n.t("Professionnel organisateur")} htmlFor="organizer_id">
              <NativeSelect id="organizer_id" name="organizer_id" required>
                <option value="">{i18n.t("Selectionner un organisateur")}</option>
                {organizers.map((organizer) => (
                  <option key={organizer.id} value={organizer.id}>
                    {organizer.contact_full_name ?? i18n.t("Professionnel")}
                    {organizer.organization_name ? ` — ${organizer.organization_name}` : ""}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </Section>
        ) : null}

        <Section step={step(1)} icon={CalendarDaysIcon} title={i18n.t("L'evenement")}>
          <Field label={i18n.t("Titre")} htmlFor="title">
            <Input id="title" name="title" defaultValue={value?.title ?? ""} required />
          </Field>
          <FieldGrid>
            <Field label={i18n.t("Date")} htmlFor="event_date">
              <Input id="event_date" name="event_date" type="date" defaultValue={value?.event_date?.slice(0, 10) ?? ""} required />
            </Field>
            <Field label={i18n.t("Capacite")} htmlFor="capacity" hint={i18n.t("Vide = sans limite")}>
              <Input id="capacity" name="capacity" type="number" min="1" defaultValue={value?.capacity ?? ""} />
            </Field>
            <Field label={i18n.t("Debut")} htmlFor="start_time">
              <Input id="start_time" name="start_time" type="time" defaultValue={value?.start_time?.slice(0, 5) ?? ""} />
            </Field>
            <Field label={i18n.t("Fin")} htmlFor="end_time">
              <Input id="end_time" name="end_time" type="time" defaultValue={value?.end_time?.slice(0, 5) ?? ""} />
            </Field>
          </FieldGrid>
          <Field label={i18n.t("Description")} htmlFor="description">
            <Textarea id="description" name="description" defaultValue={value?.description ?? ""} />
          </Field>
        </Section>

        <Section
          step={step(2)}
          icon={MapPinIcon}
          title={i18n.t("Le lieu")}
          hint={i18n.t("Le libelle est obligatoire ; le point sur la carte est facultatif et sert l'itineraire des joueurs.")}
        >
          <Field label={i18n.t("Lieu")} htmlFor="location">
            <Input id="location" name="location" defaultValue={value?.location ?? ""} required />
          </Field>
          <PlacePicker
            latitude={value?.latitude}
            longitude={value?.longitude}
            address={value?.location_address}
          />
        </Section>

        {/* `group/tarif` : le prix et la devise n'apparaissent que si la case
            « payant » est cochee — lu par `has-[[data-paid-toggle]:checked]`, sans etat
            React. Masques, ils restent dans le formulaire : l'action ignore
            deja le prix d'un evenement gratuit. */}
        <Section step={step(3)} icon={TicketIcon} title={i18n.t("Tarif")}>
          <div className="group/tarif space-y-4">
            <label className="relative flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border bg-secondary/50 px-4 py-3 transition-colors has-[:checked]:border-brand/50 has-[:checked]:bg-brand/8 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40">
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{i18n.t("Evenement payant")}</span>
                <span className="block text-[0.6875rem] text-muted-foreground">
                  {i18n.t("Decoche = inscription gratuite.")}
                </span>
              </span>
              <input
                id="is_paid"
                name="is_paid"
                data-paid-toggle=""
                type="checkbox"
                defaultChecked={Boolean(value?.is_paid)}
                className="peer sr-only"
              />
              {/* Interrupteur dessine : la case native, invisible, porte la valeur. */}
              <span
                aria-hidden
                className="relative h-5 w-9 shrink-0 rounded-full bg-muted transition-colors peer-checked:bg-brand after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-foreground after:transition-transform peer-checked:after:translate-x-4 peer-checked:after:bg-brand-foreground"
              />
            </label>
            <FieldGrid className="hidden group-has-[[data-paid-toggle]:checked]/tarif:grid">
              <Field label={i18n.t("Prix")} htmlFor="price_amount">
                <Input id="price_amount" name="price_amount" type="number" min="0" step="0.001" defaultValue={value?.price_amount ?? 0} />
              </Field>
              <Field label={i18n.t("Devise")} htmlFor="price_currency">
                <NativeSelect id="price_currency" name="price_currency" defaultValue={value?.price_currency ?? "TND"}>
                  <option value="TND">TND</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </NativeSelect>
              </Field>
            </FieldGrid>
          </div>
        </Section>

        {/* Criteres d'eligibilite — memes champs que le formulaire de
            l'application mobile, et surtout **memes cles** : le controle
            d'eligibilite (§8.2) lit `age_min`, `positions`, `levels`,
            `countries`, `cities`, `free_agent_only`, `other`. Un critere
            range ailleurs ne filtrerait personne. */}
        <Section
          step={step(4)}
          icon={FunnelIcon}
          title={i18n.t("Criteres d'eligibilite")}
          hint={i18n.t("Tous facultatifs. Un champ laisse vide n'exclut personne.")}
        >
          <FieldGrid>
            <div className="grid grid-cols-2 gap-3">
              <Field label={i18n.t("Age minimum")} htmlFor="age_min">
                <Input id="age_min" name="age_min" type="number" min="10" max="60" defaultValue={criteria.age_min ?? ""} />
              </Field>
              <Field label={i18n.t("Age maximum")} htmlFor="age_max">
                <Input id="age_max" name="age_max" type="number" min="10" max="60" defaultValue={criteria.age_max ?? ""} />
              </Field>
            </div>
            <CountryCitySelect
              countries={countries}
              defaultCountry={criteria.countries?.[0]}
              defaultCity={criteria.cities?.[0]}
            />
          </FieldGrid>

          {/* Puces plutot qu'un `select multiple` : le Ctrl+clic est invisible
              pour qui ne le connait pas, et la feuille mobile coche, elle
              aussi. */}
          <Field label={i18n.t("Postes recherches")} hint={i18n.t("Aucun coche = tous les postes.")}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FOOTBALL_POSITIONS.map((position) => (
                <Chip
                  key={position}
                  name="positions"
                  value={position}
                  defaultChecked={criteria.positions?.includes(position) ?? false}
                >
                  {i18n.labels.position(position)}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label={i18n.t("Niveaux")} hint={i18n.t("Aucun coche = tous les niveaux.")}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {i18n.labels.options(PLAYER_LEVEL).map((level) => (
                <Chip
                  key={level.value}
                  name="levels"
                  value={level.value}
                  defaultChecked={criteria.levels?.includes(level.value) ?? false}
                >
                  {level.label}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label={i18n.t("Situation")}>
            <Chip
              id="free_agent_only"
              name="free_agent_only"
              defaultChecked={criteria.free_agent_only ?? false}
              className="w-fit"
            >
              {i18n.t("Joueurs sans club uniquement")}
            </Chip>
          </Field>

          <Field label={i18n.t("Autres exigences")} htmlFor="other" hint={i18n.t("Texte libre, affiche aux joueurs.")}>
            <Textarea id="other" name="other" defaultValue={criteria.other ?? ""} />
          </Field>
        </Section>
      </div>
    </ServerForm>
  );
}
