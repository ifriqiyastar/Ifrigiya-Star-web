"use client";

import * as React from "react";
import {
  AtSignIcon,
  CheckIcon,
  HandIcon,
  Loader2Icon,
  MonitorIcon,
  MousePointerClickIcon,
  PaletteIcon,
  RotateCcwIcon,
  SaveIcon,
  SmartphoneIcon,
  TypeIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  BRAND_SWATCHES,
  NAME_TOKEN,
  isHexColor,
  type EmailTemplateRow,
  type ResolvedEmailCopy,
} from "@/emails/copy";
import { EmailBlockBuilder } from "@/components/admin/email-block-builder";
import type { EmailBlock } from "@/lib/email/blocks";
import type { ActionResult } from "@/lib/actions/result";
import { useAdminTranslations } from "@/lib/i18n/admin-client";
import { cn } from "@/lib/utils";

type Locale = "fr" | "en" | "ar";

const LANGUAGE: Record<Locale, string> = { fr: "Francais", en: "English", ar: "العربية" };

/**
 * L'editeur d'un modele d'e-mail : les textes a gauche, le courriel a droite.
 *
 * ⚠️ **Des champs nommes, pas un editeur libre**, et ce n'est pas une
 * economie de moyens : le courriel part chez des milliers de personnes, un
 * balisage saisi a la main ne survit pas a Outlook, et du HTML libre serait
 * une injection. Chaque valeur est du texte, echappee au rendu, posee dans
 * une structure qui reste dans le code.
 *
 * Trois choix d'interface valent d'etre expliques :
 *
 *  * **Le placeholder de chaque champ est le texte livre**, pas un exemple
 *    invente : laisser un champ vide revient au defaut, donc le placeholder
 *    montre exactement ce qui partira. Un exemple fictif laisserait croire
 *    qu'il faut remplir.
 *  * **Une pastille marque les champs personnalises.** Sans elle, treize
 *    champs dont trois sont modifies se lisent tous pareil, et on ne sait
 *    plus ce qu'on a change ni ce qui suit encore le defaut.
 *  * **Les langues sont des onglets dans le formulaire**, pas des pages : on
 *    traduit un habillage en regardant celui d'a cote, et changer de page
 *    perdrait la saisie en cours.
 */
export function EmailTemplateForm({
  action,
  resetAction,
  blocksAction,
  blocks,
  locales,
  rows,
  defaults,
  previews,
  disabled,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  resetAction: (locale: string) => Promise<ActionResult>;
  blocksAction: (blocks: EmailBlock[]) => Promise<ActionResult>;
  blocks: EmailBlock[];
  locales: readonly Locale[];
  rows: Record<Locale, EmailTemplateRow | null>;
  /** L'habillage effectif par langue : sert de placeholder a chaque champ. */
  defaults: Record<Locale, ResolvedEmailCopy>;
  /** Le courriel rendu, par langue. */
  previews: Record<Locale, string>;
  disabled: boolean;
}) {
  const i18n = useAdminTranslations();
  const [locale, setLocale] = React.useState<Locale>(locales[0] ?? "fr");
  const [pending, start] = React.useTransition();
  const [resetting, startReset] = React.useTransition();
  const [narrow, setNarrow] = React.useState(false);

  const row = rows[locale];
  // Une case par langue : les trois formulaires vivent en meme temps, donc
  // leur etat aussi. Un seul booleen se serait applique aux trois.
  const [ctaOverrides, setCtaOverrides] = React.useState<Partial<Record<Locale, boolean>>>({});
  const showCtaFor = (value: Locale) => ctaOverrides[value] ?? rows[value]?.show_cta ?? true;
  const setShowCta = (value: Locale, next: boolean) =>
    setCtaOverrides((current) => ({ ...current, [value]: next }));
  const customisedIn = (value: Locale, field: keyof EmailTemplateRow) =>
    Boolean((rows[value]?.[field] ?? "").toString().trim());

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    start(async () => {
      const result = await action(formData);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function reset() {
    startReset(async () => {
      const result = await resetAction(locale);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-12">
      <div className="min-w-0 space-y-3 xl:col-span-7">
        {/* Le corps d'abord : c'est ce que le destinataire lit. L'habillage
            — accueil, pied, desabonnement — vient ensuite, parce qu'on y
            touche une fois pour toutes. */}
        <EmailBlockBuilder
          initial={blocks}
          locale={locale}
          locales={locales}
          onPickLocale={setLocale}
          action={blocksAction}
          disabled={disabled}
        />

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Les langues en tete du formulaire : l'onglet actif dit laquelle
              on edite, la pastille dit laquelle est deja personnalisee. */}
          <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted p-1.5">
            {locales.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={value === locale}
                onClick={() => setLocale(value)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors",
                  value === locale
                    ? "bg-card font-bold text-brand shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {LANGUAGE[value]}
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 rounded-full",
                    rows[value] ? "bg-brand" : "bg-muted-foreground/40",
                  )}
                />
              </button>
            ))}
            {!disabled && row ? (
              <button
                type="button"
                onClick={reset}
                disabled={resetting}
                className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-60"
              >
                {resetting ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <RotateCcwIcon className="size-3.5" />
                )}
                {i18n.t("Textes d'origine")}
              </button>
            ) : null}
          </div>

          {/* ⚠️ **Un formulaire par langue, tous montes, un seul visible.**
              La version precedente n'en montait qu'un, remonte par `key` a
              chaque changement d'onglet : une traduction a moitie tapee
              disparaissait sans un mot des qu'on allait verifier la langue
              d'a cote. Ici le navigateur garde l'etat de chaque champ, et
              `hidden` sort les autres du flux comme de l'ordre de
              tabulation. */}
          {locales.map((formLocale) => (
          <form
            key={formLocale}
            hidden={formLocale !== locale}
            onSubmit={submit}
            className="space-y-5 p-4"
          >
            {/* La langue voyage dans le formulaire : l'action est deja liee a
                son modele, il lui manque seulement de quoi savoir quelle
                ligne ecrire. */}
            <input type="hidden" name="locale" value={formLocale} />
            <Group icon={AtSignIcon} title={i18n.t("Expediteur")}>
              <Field
                name="sender_name"
                label={i18n.t("Nom affiche")}
                hint={i18n.t("Ce que le destinataire lit a la place de l'adresse.")}
                defaultValue={rows[formLocale]?.sender_name ?? ""}
                placeholder={defaults[formLocale].senderName}
                changed={customisedIn(formLocale, "sender_name")}
                disabled={disabled}
              />
              <Field
                name="reply_to"
                label={i18n.t("Adresse de reponse")}
                hint={i18n.t("Ou arrivent les reponses. Vide : les reponses ne vont nulle part.")}
                defaultValue={rows[formLocale]?.reply_to ?? ""}
                placeholder={i18n.t("aucune")}
                changed={customisedIn(formLocale, "reply_to")}
                disabled={disabled}
              />
            </Group>

            <Group icon={HandIcon} title={i18n.t("Formule d'accueil")}>
              {blocks.some((block) => block.type === "greeting") ? (
                <p className="rounded-lg bg-muted px-3 py-2 text-[0.625rem] leading-relaxed text-muted-foreground sm:col-span-2">
                  {i18n.t("La mise en page contient un bloc d'accueil : ces champs ne sont pas envoyes.")}
                </p>
              ) : null}
              <Field
                name="greeting_named"
                label={i18n.t("Avec le nom du destinataire")}
                hint={i18n.t("Doit contenir {0}, remplace par le nom du compte.", { "0": NAME_TOKEN })}
                defaultValue={rows[formLocale]?.greeting_named ?? ""}
                placeholder={defaults[formLocale].greetingNamed}
                changed={customisedIn(formLocale, "greeting_named")}
                disabled={disabled}
              />
              <Field
                name="greeting_plain"
                label={i18n.t("Sans nom du destinataire")}
                hint={i18n.t("Utilise quand le compte n'a pas de nom renseigne.")}
                defaultValue={rows[formLocale]?.greeting_plain ?? ""}
                placeholder={defaults[formLocale].greetingPlain}
                changed={customisedIn(formLocale, "greeting_plain")}
                disabled={disabled}
              />
            </Group>

            <Group icon={MousePointerClickIcon} title={i18n.t("Bouton")}>
              {blocks.some((block) => block.type === "button") ? (
                <p className="rounded-lg bg-muted px-3 py-2 text-[0.625rem] leading-relaxed text-muted-foreground sm:col-span-2">
                  {i18n.t("La mise en page contient deja un bouton : celui-ci n'est pas envoye, pour ne pas en afficher deux.")}
                </p>
              ) : null}
              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  name="show_cta"
                  checked={showCtaFor(formLocale)}
                  disabled={disabled}
                  onChange={(event) => setShowCta(formLocale, event.target.checked)}
                  className="size-4 accent-brand"
                />
                <span className="text-xs font-medium">
                  {i18n.t("Afficher un bouton dans le courriel")}
                </span>
              </label>
              <Field
                name="cta_label"
                label={i18n.t("Libelle")}
                defaultValue={rows[formLocale]?.cta_label ?? ""}
                placeholder={defaults[formLocale].ctaLabel}
                changed={customisedIn(formLocale, "cta_label")}
                disabled={disabled || !showCtaFor(formLocale)}
              />
              <Field
                name="cta_url"
                label={i18n.t("Adresse")}
                hint={i18n.t("http:// ou https:// uniquement.")}
                defaultValue={rows[formLocale]?.cta_url ?? ""}
                placeholder={defaults[formLocale].ctaUrl ?? ""}
                changed={customisedIn(formLocale, "cta_url")}
                disabled={disabled || !showCtaFor(formLocale)}
              />
            </Group>

            <Group icon={PaletteIcon} title={i18n.t("Couleurs")}>
              <ColorField
                name="color_header_bg"
                label={i18n.t("Fond de l'en-tete")}
                defaultValue={rows[formLocale]?.color_header_bg ?? ""}
                fallback={defaults[formLocale].colors.headerBg}
                changed={customisedIn(formLocale, "color_header_bg")}
                disabled={disabled}
                swatchLabel={i18n.t("Couleur de la charte")}
              />
              <ColorField
                name="color_body_bg"
                label={i18n.t("Fond du message")}
                defaultValue={rows[formLocale]?.color_body_bg ?? ""}
                fallback={defaults[formLocale].colors.bodyBg}
                changed={customisedIn(formLocale, "color_body_bg")}
                disabled={disabled}
                swatchLabel={i18n.t("Couleur de la charte")}
              />
              <ColorField
                name="color_text"
                label={i18n.t("Couleur du texte")}
                defaultValue={rows[formLocale]?.color_text ?? ""}
                fallback={defaults[formLocale].colors.text}
                changed={customisedIn(formLocale, "color_text")}
                disabled={disabled}
                swatchLabel={i18n.t("Couleur de la charte")}
              />
              <ColorField
                name="color_button_bg"
                label={i18n.t("Fond du bouton")}
                defaultValue={rows[formLocale]?.color_button_bg ?? ""}
                fallback={defaults[formLocale].colors.buttonBg}
                changed={customisedIn(formLocale, "color_button_bg")}
                disabled={disabled}
                swatchLabel={i18n.t("Couleur de la charte")}
              />
              <ColorField
                name="color_button_text"
                label={i18n.t("Texte du bouton")}
                defaultValue={rows[formLocale]?.color_button_text ?? ""}
                fallback={defaults[formLocale].colors.buttonText}
                changed={customisedIn(formLocale, "color_button_text")}
                disabled={disabled}
                swatchLabel={i18n.t("Couleur de la charte")}
                className="sm:col-span-2"
              />
              <p className="text-[0.625rem] leading-relaxed text-muted-foreground sm:col-span-2">
                {i18n.t("Le nom de la marque passe du blanc au noir selon le fond choisi : il reste lisible sans reglage.")}
              </p>
            </Group>

            <Group icon={TypeIcon} title={i18n.t("Signature et pied de page")}>
              {blocks.some((block) => block.type === "signature") ? (
                <p className="rounded-lg bg-muted px-3 py-2 text-[0.625rem] leading-relaxed text-muted-foreground sm:col-span-2">
                  {i18n.t("La mise en page contient un bloc de signature : ce champ n'est pas envoye.")}
                </p>
              ) : null}
              <Field
                name="signature"
                label={i18n.t("Signature")}
                hint={i18n.t("Posee sous le message. Vide : aucune signature.")}
                defaultValue={rows[formLocale]?.signature ?? ""}
                placeholder={i18n.t("aucune")}
                changed={customisedIn(formLocale, "signature")}
                disabled={disabled}
                rows={2}
              />
              <Field
                name="footer_why"
                label={i18n.t("Pourquoi ce message")}
                defaultValue={rows[formLocale]?.footer_why ?? ""}
                placeholder={defaults[formLocale].footerWhy}
                changed={customisedIn(formLocale, "footer_why")}
                disabled={disabled}
                rows={2}
              />
              <Field
                name="unsubscribe_label"
                label={i18n.t("Lien de desabonnement")}
                defaultValue={rows[formLocale]?.unsubscribe_label ?? ""}
                placeholder={defaults[formLocale].unsubscribeLabel}
                changed={customisedIn(formLocale, "unsubscribe_label")}
                disabled={disabled}
              />
              <Field
                name="unsubscribe_hint"
                label={i18n.t("Precision sous le lien")}
                defaultValue={rows[formLocale]?.unsubscribe_hint ?? ""}
                placeholder={defaults[formLocale].unsubscribeHint}
                changed={customisedIn(formLocale, "unsubscribe_hint")}
                disabled={disabled}
                rows={2}
              />
              <Field
                name="rights"
                label={i18n.t("Mention finale")}
                defaultValue={rows[formLocale]?.rights ?? ""}
                placeholder={defaults[formLocale].rights}
                changed={customisedIn(formLocale, "rights")}
                disabled={disabled}
                className="sm:col-span-2"
              />
            </Group>

            {/* La barre d'enregistrement colle au bas de la fenetre : le
                formulaire fait treize champs, et un bouton en pied de page
                oblige a redescendre pour chaque essai. */}
            <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
              <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                {i18n.t("Un champ laisse vide reprend le texte livre, montre en gris.")}
              </p>
              <button
                type="submit"
                disabled={disabled || pending}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-bold text-brand-foreground transition-[filter] hover:brightness-110 disabled:opacity-60"
              >
                {pending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <SaveIcon className="size-4" />
                )}
                {i18n.t("Enregistrer")}
              </button>
            </div>
          </form>
          ))}
        </div>
      </div>

      {/* L'apercu suit le defilement : on modifie en haut du formulaire et on
          regarde le resultat, sans faire l'aller-retour. */}
      <div className="min-w-0 xl:sticky xl:top-4 xl:col-span-5">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted px-3 py-2">
            <h2 className="text-xs font-semibold">{i18n.t("Apercu reel")}</h2>
            <div className="flex items-center gap-0.5 rounded-md bg-background p-0.5">
              <DeviceButton
                active={!narrow}
                onClick={() => setNarrow(false)}
                icon={MonitorIcon}
                label={i18n.t("Bureau")}
              />
              <DeviceButton
                active={narrow}
                onClick={() => setNarrow(true)}
                icon={SmartphoneIcon}
                label={i18n.t("Mobile")}
              />
            </div>
          </div>
          <div className="flex justify-center bg-[#f4f4f4] p-2">
            {/* ⚠️ Une `iframe` en `sandbox=""` : le courriel porte son propre
                `<body>` et ses styles en ligne, qui se melangeraient a ceux
                du back-office — et son contenu vient de la base, on ne le
                laisse pas s'executer dans l'administration. */}
            <iframe
              title={i18n.t("Apercu reel")}
              srcDoc={previews[locale]}
              sandbox=""
              className="h-144 border-0 bg-white transition-[width]"
              style={{ width: narrow ? "375px" : "100%" }}
            />
          </div>
          <p className="border-t border-border px-3 py-2 text-[0.625rem] leading-relaxed text-muted-foreground">
            {i18n.t("Rendu par le meme code que l'envoi, avec un message d'exemple. Il se met a jour apres enregistrement.")}
          </p>
        </div>
      </div>
    </div>
  );
}

function DeviceButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={cn(
        "flex size-6 items-center justify-center rounded",
        active ? "bg-accent text-brand" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

/**
 * Un champ de couleur : la pastille native, la valeur en clair, et les
 * teintes de la charte a un clic.
 *
 * ⚠️ `<input type="color">` ne sait pas etre vide — il vaut `#000000` par
 * defaut, ce qui **enregistrerait du noir** la ou l'administrateur voulait
 * « laisse comme c'est ». La valeur qui part dans `FormData` est donc celle
 * du champ texte, et la pastille ne fait que l'ecrire.
 */
function ColorField({
  name,
  label,
  defaultValue,
  fallback,
  changed,
  disabled,
  swatchLabel,
  className,
}: {
  name: string;
  label: string;
  defaultValue: string;
  /** La couleur effective, affichee quand rien n'est enregistre. */
  fallback: string;
  changed: boolean;
  disabled: boolean;
  swatchLabel: string;
  className?: string;
}) {
  const [value, setValue] = React.useState(defaultValue);
  const shown = isHexColor(value) ? value : fallback;
  const id = `modele-${name}`;

  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium">
        {label}
        {changed ? (
          <span className="inline-flex items-center gap-0.5 rounded bg-brand/12 px-1 py-px text-[0.5625rem] font-bold tracking-wide text-brand uppercase">
            <CheckIcon className="size-2.5" />
            perso
          </span>
        ) : null}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          aria-label={label}
          value={shown}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-lg border border-border bg-background p-1 disabled:opacity-60"
        />
        <input
          id={id}
          name={name}
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          placeholder={fallback}
          spellCheck={false}
          className="h-9 min-w-0 flex-1 rounded-lg bg-background px-3 font-mono text-xs outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-brand disabled:opacity-60"
        />
        {value ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setValue("")}
            title={swatchLabel}
            className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <RotateCcwIcon className="size-3.5" />
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {BRAND_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            disabled={disabled}
            title={swatch}
            aria-label={`${swatchLabel} ${swatch}`}
            onClick={() => setValue(swatch)}
            className="size-4 rounded border border-border disabled:opacity-40"
            style={{ backgroundColor: swatch }}
          />
        ))}
      </div>
    </div>
  );
}

function Group({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-brand/12 text-brand">
          <Icon className="size-3.5" />
        </span>
        <span className="micro-label">{title}</span>
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  name,
  label,
  hint,
  defaultValue,
  placeholder,
  changed,
  disabled,
  rows,
  className,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue: string;
  placeholder: string;
  /** Ce champ porte-t-il une valeur enregistree, ou suit-il le defaut ? */
  changed: boolean;
  disabled: boolean;
  rows?: number;
  className?: string;
}) {
  const id = `modele-${name}`;
  const shared =
    "w-full rounded-lg bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-brand disabled:opacity-60";
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium">
        {label}
        {changed ? (
          <span className="inline-flex items-center gap-0.5 rounded bg-brand/12 px-1 py-px text-[0.5625rem] font-bold tracking-wide text-brand uppercase">
            <CheckIcon className="size-2.5" />
            perso
          </span>
        ) : null}
      </label>
      {rows ? (
        <textarea
          id={id}
          name={name}
          rows={rows}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(shared, "resize-y py-2")}
        />
      ) : (
        <input
          id={id}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(shared, "h-9")}
        />
      )}
      {hint ? <p className="text-[0.625rem] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
