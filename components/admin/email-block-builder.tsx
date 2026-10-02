"use client";

import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Columns2Icon,
  GripVerticalIcon,
  HandIcon,
  ImageIcon,
  Loader2Icon,
  MailIcon,
  MinusIcon,
  MousePointerClickIcon,
  MoveVerticalIcon,
  PenLineIcon,
  SaveIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ImageUploadButton } from "@/components/admin/email-image-upload";
import { NAME_TOKEN } from "@/emails/copy";
import type { EmailBlock, LocalizedText } from "@/lib/email/blocks";
import type { ActionResult } from "@/lib/actions/result";
import { useAdminTranslations } from "@/lib/i18n/admin-client";
import { cn } from "@/lib/utils";

type Locale = "fr" | "en" | "ar";

/** Les blocs qui portent du texte — les seuls a traduire. */
const TRANSLATABLE = new Set<EmailBlock["type"]>([
  "greeting", "signature", "text", "image", "button", "columns",
]);

/** Les champs traduisibles de chaque type, pour mesurer la completude. */
const TEXT_FIELDS: Partial<Record<EmailBlock["type"], readonly string[]>> = {
  greeting: ["named", "plain"],
  signature: ["text"],
  text: ["text"],
  image: ["alt"],
  button: ["label"],
  columns: ["left", "right"],
};

/**
 * Ce bloc porte-t-il un texte dans cette langue ?
 *
 * ⚠️ « Rempli » veut dire **tous** ses champs traduisibles, pas un seul : un
 * bloc « deux colonnes » dont une seule moitie est traduite rendrait une
 * colonne vide, et une pastille verte le cacherait.
 */
function hasTextIn(block: EmailBlock, locale: Locale): boolean {
  const fields = TEXT_FIELDS[block.type];
  if (!fields?.length) return true;
  const source = block as unknown as Record<string, Record<string, string> | undefined>;
  return fields.every((field) => Boolean(source[field]?.[locale]?.trim()));
}

/**
 * Le compositeur du corps d'un modele.
 *
 * ⚠️ **Une palette fermee, pas une toile.** Le super administrateur choisit
 * l'ordre des blocs, pas leur rendu : chaque type est un composant React
 * Email, donc tout agencement reste lisible chez Outlook, se replie sur un
 * telephone et suit la charte. C'est ce qui permet de donner le
 * glisser-deposer a quelqu'un qui ne pourra pas verifier le resultat dans
 * dix clients de messagerie.
 *
 * ⚠️ **Le bloc « message » est l'emplacement du texte de la campagne** — il
 * ne se supprime pas et n'existe qu'en un exemplaire. Sans lui, ce que
 * l'administrateur ecrit au moment de l'envoi n'aurait nulle part ou aller.
 *
 * Les textes sont ranges par langue **dans** chaque bloc : on compose une
 * fois, on traduit trois fois. L'onglet de langue actif ne change que ce
 * qu'on edite, jamais la mise en page.
 */
export function EmailBlockBuilder({
  initial,
  locale,
  locales,
  onPickLocale,
  action,
  disabled,
}: {
  initial: EmailBlock[];
  /** La langue editee, choisie par les onglets de la page. */
  locale: Locale;
  locales: readonly Locale[];
  /** Permet de changer de langue depuis un bloc, sans remonter aux onglets. */
  onPickLocale: (locale: Locale) => void;
  action: (blocks: EmailBlock[]) => Promise<ActionResult>;
  disabled: boolean;
}) {
  const i18n = useAdminTranslations();
  const [blocks, setBlocks] = React.useState<EmailBlock[]>(initial);
  const [pending, start] = React.useTransition();
  const [dirty, setDirty] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // ⚠️ Le clavier aussi : un compositeur qui ne se pilote qu'a la souris
    // exclut une partie des utilisateurs de la seule facon de changer
    // l'ordre des blocs.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const update = (next: EmailBlock[]) => {
    setBlocks(next);
    setDirty(true);
  };

  /**
   * ⚠️ L'identifiant est **derive de la liste**, pas tire au hasard.
   * `Date.now()` et `Math.random()` sont des appels impurs que le
   * compilateur React refuse dans du code de rendu — et un compteur qui
   * evite les identifiants deja pris est de toute facon plus sûr : il ne
   * peut pas percuter un bloc enregistre.
   */
  const freshId = (list: EmailBlock[]) => {
    const used = new Set(list.map((item) => item.id));
    let index = 1;
    while (used.has(`b${index}`)) index += 1;
    return `b${index}`;
  };

  const add = (type: EmailBlock["type"]) => {
    const id = freshId(blocks);
    const created: Record<string, EmailBlock> = {
      message: { id, type: "message" },
      greeting: { id, type: "greeting", named: {}, plain: {} },
      signature: { id, type: "signature", text: {} },
      text: { id, type: "text", text: {} },
      image: { id, type: "image", src: "", alt: {}, href: null, width: "full" },
      button: { id, type: "button", label: {}, href: "" },
      columns: { id, type: "columns", left: {}, right: {} },
      divider: { id, type: "divider" },
      spacer: { id, type: "spacer", size: "m" },
    };
    update([...blocks, created[type]]);
  };

  const patch = (id: string, changes: Partial<EmailBlock>) =>
    update(blocks.map((block) => (block.id === id ? ({ ...block, ...changes } as EmailBlock) : block)));

  const remove = (id: string) => update(blocks.filter((block) => block.id !== id));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = blocks.findIndex((block) => block.id === active.id);
    const to = blocks.findIndex((block) => block.id === over.id);
    if (from < 0 || to < 0) return;
    update(arrayMove(blocks, from, to));
  };

  const save = () =>
    start(async () => {
      const result = await action(blocks);
      if (result.ok) {
        toast.success(result.message);
        setDirty(false);
      } else {
        toast.error(result.message);
      }
    });

  const hasMessage = blocks.some((block) => block.type === "message");

  const PALETTE = [
    { type: "greeting" as const, icon: HandIcon, label: i18n.t("Formule d'accueil") },
    { type: "text" as const, icon: TypeIcon, label: i18n.t("Texte") },
    { type: "image" as const, icon: ImageIcon, label: i18n.t("Image") },
    { type: "button" as const, icon: MousePointerClickIcon, label: i18n.t("Bouton") },
    { type: "columns" as const, icon: Columns2Icon, label: i18n.t("Deux colonnes") },
    { type: "divider" as const, icon: MinusIcon, label: i18n.t("Trait") },
    { type: "signature" as const, icon: PenLineIcon, label: i18n.t("Signature") },
    { type: "spacer" as const, icon: MoveVerticalIcon, label: i18n.t("Espace") },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted p-1.5">
        <span className="micro-label pr-1 pl-1.5 text-muted-foreground">{i18n.t("Ajouter")}</span>
        {PALETTE.map((item) => (
          <button
            key={item.type}
            type="button"
            disabled={disabled}
            onClick={() => add(item.type)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-background px-2 text-[0.6875rem] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <item.icon className="size-3.5" />
            {item.label}
          </button>
        ))}
        {!hasMessage ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => add("message")}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-warning/15 px-2 text-[0.6875rem] font-semibold text-warning disabled:opacity-40"
          >
            <MailIcon className="size-3.5" />
            {i18n.t("Emplacement du message")}
          </button>
        ) : null}
      </div>

      {!hasMessage ? (
        <p className="border-b border-border bg-warning/10 px-4 py-2 text-[0.6875rem] leading-relaxed text-warning">
          {i18n.t("Ce modele n'a pas d'emplacement pour le message : il sera ajoute a la fin a l'envoi, pour ne pas le perdre.")}
        </p>
      ) : null}

      {/* ⚠️ **`id` fixe, et ce n'est pas cosmetique.** dnd-kit derive le
          `aria-describedby` de chaque poignee d'un **compteur de module**
          (`useUniqueId`) : il repart de zero dans le navigateur mais pas sur
          le serveur, donc le HTML rendu et le HTML hydrate portaient des
          numeros differents — React signalait une divergence d'hydratation a
          chaque ouverture de l'ecran. Passer un `id` court-circuite le
          compteur : `useUniqueId(prefix, value)` rend `value` telle quelle
          des qu'elle est fournie. */}
      <DndContext
        id="email-blocks"
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 p-3">
            {blocks.map((block) => (
              <SortableBlock
                key={block.id}
                block={block}
                locale={locale}
                locales={locales}
                onPickLocale={onPickLocale}
                disabled={disabled}
                onPatch={patch}
                onRemove={remove}
              />
            ))}
            {!blocks.length ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {i18n.t("Aucun bloc : ajoutez-en depuis la barre ci-dessus.")}
              </p>
            ) : null}
          </div>
        </SortableContext>
      </DndContext>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
          {dirty
            ? i18n.t("Modifications non enregistrees.")
            : i18n.t("La mise en page est commune aux trois langues ; seuls les textes changent.")}
        </p>
        <button
          type="button"
          disabled={disabled || pending || !dirty}
          onClick={save}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-bold text-brand-foreground transition-[filter] hover:brightness-110 disabled:opacity-60"
        >
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
          {i18n.t("Enregistrer la mise en page")}
        </button>
      </div>
    </div>
  );
}

function SortableBlock({
  block,
  locale,
  locales,
  onPickLocale,
  disabled,
  onPatch,
  onRemove,
}: {
  block: EmailBlock;
  locale: Locale;
  locales: readonly Locale[];
  onPickLocale: (locale: Locale) => void;
  disabled: boolean;
  onPatch: (id: string, changes: Partial<EmailBlock>) => void;
  onRemove: (id: string) => void;
}) {
  const i18n = useAdminTranslations();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled,
  });

  const LABEL: Record<EmailBlock["type"], string> = {
    greeting: i18n.t("Formule d'accueil"),
    signature: i18n.t("Signature"),
    message: i18n.t("Message de la campagne"),
    text: i18n.t("Texte"),
    image: i18n.t("Image"),
    button: i18n.t("Bouton"),
    columns: i18n.t("Deux colonnes"),
    divider: i18n.t("Trait"),
    spacer: i18n.t("Espace"),
  };

  /** Ecrit une valeur dans la langue editee, sans toucher aux autres. */
  const setText = (field: "text" | "alt" | "label" | "left" | "right" | "named" | "plain", value: string) => {
    const current = (block as unknown as Record<string, LocalizedText>)[field] ?? {};
    onPatch(block.id, { [field]: { ...current, [locale]: value } } as Partial<EmailBlock>);
  };
  const getText = (field: "text" | "alt" | "label" | "left" | "right" | "named" | "plain") =>
    ((block as unknown as Record<string, LocalizedText>)[field] ?? {})[locale] ?? "";

  const input =
    "w-full rounded-lg bg-background px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-brand disabled:opacity-60";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-lg border border-border bg-background/50",
        isDragging && "z-10 opacity-80 shadow-lg",
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-border/70 px-2 py-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={disabled}
          aria-label={i18n.t("Deplacer le bloc")}
          className="flex size-6 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <GripVerticalIcon className="size-3.5" />
        </button>
        <span className="micro-label min-w-0 flex-1 truncate">{LABEL[block.type]}</span>
        {/* ⚠️ **L'etat de traduction, bloc par bloc.** Un onglet de langue en
            haut de page dit quelle langue on edite, jamais lesquelles sont
            remplies : on decouvrait un bloc vide en arabe en basculant
            dessus, c'est-a-dire trop tard. Chaque pastille dit si ce bloc
            porte un texte dans cette langue, et y emmene d'un clic. */}
        {TRANSLATABLE.has(block.type) ? (
          <span className="flex shrink-0 items-center gap-0.5">
            {locales.map((value) => {
              const filled = hasTextIn(block, value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onPickLocale(value)}
                  aria-current={value === locale}
                  title={
                    filled
                      ? i18n.t("Texte renseigne dans cette langue")
                      : i18n.t("Aucun texte dans cette langue")
                  }
                  className={cn(
                    "rounded px-1 py-px text-[0.5625rem] font-bold uppercase transition-colors",
                    filled ? "text-brand" : "text-muted-foreground/50",
                    value === locale && "bg-accent",
                  )}
                >
                  {value}
                </button>
              );
            })}
          </span>
        ) : null}
        {/* ⚠️ Le bloc « message » ne se supprime pas : il est l'endroit ou
            atterrit ce que l'administrateur ecrit a l'envoi. */}
        {block.type !== "message" ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemove(block.id)}
            aria-label={i18n.t("Supprimer le bloc")}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:opacity-40"
          >
            <Trash2Icon className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="space-y-2 p-2.5">
        {block.type === "message" ? (
          <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
            {i18n.t("Le titre et le texte ecrits au moment de l'envoi se placent ici.")}
          </p>
        ) : null}

        {block.type === "greeting" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <input
                value={getText("named")}
                disabled={disabled}
                onChange={(event) => setText("named", event.target.value)}
                placeholder={`Bonjour ${NAME_TOKEN},`}
                className={input}
              />
              <p className="text-[0.625rem] text-muted-foreground">
                {i18n.t("Doit contenir {0}, remplace par le nom du compte.", { "0": NAME_TOKEN })}
              </p>
            </div>
            <div className="space-y-1">
              <input
                value={getText("plain")}
                disabled={disabled}
                onChange={(event) => setText("plain", event.target.value)}
                placeholder="Bonjour,"
                className={input}
              />
              <p className="text-[0.625rem] text-muted-foreground">
                {i18n.t("Utilise quand le compte n'a pas de nom renseigne.")}
              </p>
            </div>
          </div>
        ) : null}

        {block.type === "signature" ? (
          <textarea
            rows={2}
            value={getText("text")}
            disabled={disabled}
            onChange={(event) => setText("text", event.target.value)}
            placeholder={i18n.t("Signature")}
            className={cn(input, "resize-y")}
          />
        ) : null}

        {block.type === "text" ? (
          <textarea
            rows={3}
            value={getText("text")}
            disabled={disabled}
            onChange={(event) => setText("text", event.target.value)}
            placeholder={i18n.t("Texte affiche dans le courriel")}
            className={cn(input, "resize-y")}
          />
        ) : null}

        {block.type === "columns" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <textarea
              rows={3}
              value={getText("left")}
              disabled={disabled}
              onChange={(event) => setText("left", event.target.value)}
              placeholder={i18n.t("Colonne de debut")}
              className={cn(input, "resize-y")}
            />
            <textarea
              rows={3}
              value={getText("right")}
              disabled={disabled}
              onChange={(event) => setText("right", event.target.value)}
              placeholder={i18n.t("Colonne de fin")}
              className={cn(input, "resize-y")}
            />
          </div>
        ) : null}

        {block.type === "image" ? (
          <>
            {block.src ? (
              // Une vignette, pas `next/image` : l'adresse est publique et
              // hors des hotes declares dans `next.config.ts`.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={block.src}
                alt=""
                className="max-h-28 w-full rounded border border-border object-cover"
              />
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <ImageUploadButton
                disabled={disabled}
                onUploaded={(url) => onPatch(block.id, { src: url } as Partial<EmailBlock>)}
              />
              <input
                value={block.src}
                disabled={disabled}
                onChange={(event) => onPatch(block.id, { src: event.target.value } as Partial<EmailBlock>)}
                placeholder="https://…"
                className={cn(input, "min-w-0 flex-1")}
              />
            </div>
            <input
              value={getText("alt")}
              disabled={disabled}
              onChange={(event) => setText("alt", event.target.value)}
              placeholder={i18n.t("Description de l'image (lue si elle ne s'affiche pas)")}
              className={input}
            />
            <input
              value={block.href ?? ""}
              disabled={disabled}
              onChange={(event) => onPatch(block.id, { href: event.target.value || null } as Partial<EmailBlock>)}
              placeholder={i18n.t("Lien au clic (facultatif)")}
              className={input}
            />
            <div className="flex items-center gap-1">
              {(["full", "auto"] as const).map((width) => (
                <button
                  key={width}
                  type="button"
                  disabled={disabled}
                  aria-pressed={block.width === width}
                  onClick={() => onPatch(block.id, { width } as Partial<EmailBlock>)}
                  className={cn(
                    "h-7 rounded-md px-3 text-[0.6875rem] font-semibold",
                    block.width === width
                      ? "bg-accent text-brand"
                      : "text-muted-foreground hover:bg-accent/50",
                  )}
                >
                  {width === "full" ? i18n.t("Pleine largeur") : i18n.t("Taille d'origine")}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {block.type === "button" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={getText("label")}
              disabled={disabled}
              onChange={(event) => setText("label", event.target.value)}
              placeholder={i18n.t("Libelle")}
              className={input}
            />
            <input
              value={block.href}
              disabled={disabled}
              onChange={(event) => onPatch(block.id, { href: event.target.value } as Partial<EmailBlock>)}
              placeholder="https://…"
              className={input}
            />
          </div>
        ) : null}

        {block.type === "spacer" ? (
          <div className="flex items-center gap-1">
            {(["s", "m", "l"] as const).map((size) => (
              <button
                key={size}
                type="button"
                disabled={disabled}
                aria-pressed={block.size === size}
                onClick={() => onPatch(block.id, { size } as Partial<EmailBlock>)}
                className={cn(
                  "h-7 rounded-md px-3 text-[0.6875rem] font-semibold",
                  block.size === size
                    ? "bg-accent text-brand"
                    : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                {size === "s" ? i18n.t("Petit") : size === "l" ? i18n.t("Grand") : i18n.t("Espace moyen")}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
