"use client";

import * as React from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import TiptapPlaceholder from "@tiptap/extension-placeholder";
import {
  BoldIcon,
  Heading2Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  RedoIcon,
  StrikethroughIcon,
  UndoIcon,
  UnlinkIcon,
} from "lucide-react";

import { DEFAULT_COLORS } from "@/emails/copy";
import { RICH_TEXT_EXTENSIONS } from "@/lib/rich-text/extensions";
import { useAdminTranslations } from "@/lib/i18n/admin-client";
import { cn } from "@/lib/utils";

/**
 * L'editeur du message d'une campagne — le meme Tiptap que le blog, reduit
 * a ce qu'un courriel sait rendre.
 *
 * ⚠️ Il **remonte deux valeurs**, et c'est le fond du sujet : le HTML mis en
 * forme pour le courriel, et le texte brut pour la notification in-app et le
 * push. Un ecran verrouille ne rend pas `<strong>`. Le texte brut est
 * **derive** de la saisie, jamais tape a part, pour que les deux ne puissent
 * pas raconter deux choses differentes.
 *
 * ⚠️ Le HTML remonte est reanalyse cote serveur contre le meme schema
 * (`parseRichText`) : ce composant est une commodite de saisie, pas une
 * garantie. Un POST direct passe par la meme liste blanche.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  /** `(html, texte brut)` — les deux representations du meme message. */
  onChange: (html: string, text: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const i18n = useAdminTranslations();

  const editor = useEditor({
    // Le rendu serveur est desactive : l'editeur n'existe que dans le
    // navigateur, et Tiptap previent sinon d'un decalage d'hydratation.
    immediatelyRender: false,
    editable: !disabled,
    extensions: [...RICH_TEXT_EXTENSIONS, TiptapPlaceholder.configure({ placeholder })],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose-none min-h-32 w-full px-3 py-2 text-sm outline-none [&_a]:underline [&_h2]:text-base [&_h2]:font-bold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5",
      },
    },
    onUpdate: ({ editor: instance }) => {
      // `getText` avec un separateur de bloc : sans lui, deux paragraphes se
      // collent en une phrase dans la notification.
      onChange(instance.getHTML(), instance.getText({ blockSeparator: "\n" }).trim());
    },
  });

  // Le composeur vide le champ apres un envoi reussi : l'editeur doit
  // suivre. Compare avant d'ecrire, sinon chaque frappe se replacerait.
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "<p></p>";
    if (current !== next && (value === "" || !editor.isFocused)) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <div className="overflow-hidden rounded-lg bg-background focus-within:ring-1 focus-within:ring-brand">
      <Toolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} />
      <p className="px-3 pb-2 text-[0.625rem] leading-relaxed text-muted-foreground">
        {i18n.t("La mise en forme n'apparait que dans l'e-mail. La notification et le push reprennent le meme texte, sans mise en forme.")}
      </p>
    </div>
  );
}

function Toolbar({ editor, disabled }: { editor: Editor | null; disabled?: boolean }) {
  const i18n = useAdminTranslations();
  if (!editor) return null;

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(i18n.t("Adresse du lien"), previous ?? "https://");
    if (url === null) return;
    const clean = url.trim();
    if (!clean) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    // ⚠️ Meme garde que le serveur : `javascript:` n'entre pas dans un
    // courriel. Le schema le refuserait aussi, mais le dire ici evite a
    // l'administrateur de croire que son lien est pose.
    if (!/^(https?:\/\/|mailto:)/i.test(clean)) {
      window.alert(i18n.t("Un lien doit commencer par http://, https:// ou mailto:."));
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: clean }).run();
  };

  /**
   * ⚠️ **Une barre d'outils se parcourt aux fleches, pas a la tabulation.**
   * Quinze boutons places dans l'ordre de tabulation obligeraient un
   * utilisateur au clavier a les traverser un par un pour atteindre le
   * champ de saisie. Le motif ARIA veut un seul arret de tabulation pour
   * toute la barre, et les fleches a l'interieur.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
    );
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : event.key === "ArrowLeft"
            ? (current - 1 + buttons.length) % buttons.length
            : (current + 1) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <div
      role="toolbar"
      aria-label={i18n.t("Mise en forme du message")}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className="flex flex-wrap items-center gap-0.5 border-b border-border/70 px-1.5 py-1"
    >
      <Btn first label={i18n.t("Gras")} active={editor.isActive("bold")} disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}>
        <BoldIcon className="size-3.5" />
      </Btn>
      <Btn label={i18n.t("Italique")} active={editor.isActive("italic")} disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}>
        <ItalicIcon className="size-3.5" />
      </Btn>
      <Btn label={i18n.t("Barre")} active={editor.isActive("strike")} disabled={disabled}
        onClick={() => editor.chain().focus().toggleStrike().run()}>
        <StrikethroughIcon className="size-3.5" />
      </Btn>
      <Separator />
      <Btn label={i18n.t("Intertitre")} active={editor.isActive("heading", { level: 2 })} disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2Icon className="size-3.5" />
      </Btn>
      <Btn label={i18n.t("Liste a puces")} active={editor.isActive("bulletList")} disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <ListIcon className="size-3.5" />
      </Btn>
      <Btn label={i18n.t("Liste numerotee")} active={editor.isActive("orderedList")} disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrderedIcon className="size-3.5" />
      </Btn>
      <Separator />
      <Btn label={i18n.t("Poser un lien")} active={editor.isActive("link")} disabled={disabled} onClick={setLink}>
        <LinkIcon className="size-3.5" />
      </Btn>
      <Btn label={i18n.t("Retirer le lien")} disabled={disabled || !editor.isActive("link")}
        onClick={() => editor.chain().focus().unsetLink().run()}>
        <UnlinkIcon className="size-3.5" />
      </Btn>
      <Separator />
      {/* ⚠️ Pas les quatre couleurs de la charte ici, mais les seules qui se
          lisent **en texte** : le blanc disparait sur un fond clair et le
          gris `#cccccc` y est illisible. Les proposer parce qu'elles sont
          dans la charte serait offrir deux facons de rendre un message
          invisible. Un nuancier complet, lui, inviterait a ecrire un
          courriel en six teintes. */}
      {TEXT_SWATCHES.map((color) => (
        <button
          key={color}
          type="button"
          disabled={disabled}
          title={color}
          aria-label={i18n.t("Couleur du texte")}
          tabIndex={-1}
          onClick={() => editor.chain().focus().setColor(color).run()}
          className="size-5 shrink-0 rounded border border-border disabled:opacity-40"
          style={{ backgroundColor: color }}
        />
      ))}
      <Btn label={i18n.t("Couleur par defaut")} disabled={disabled}
        onClick={() => editor.chain().focus().unsetColor().run()}>
        <span className="text-[0.625rem] font-bold">A</span>
      </Btn>
      <span className="ml-auto flex items-center gap-0.5">
        <Btn label={i18n.t("Annuler")} disabled={disabled || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}>
          <UndoIcon className="size-3.5" />
        </Btn>
        <Btn label={i18n.t("Retablir")} disabled={disabled || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}>
          <RedoIcon className="size-3.5" />
        </Btn>
      </span>
    </div>
  );
}

/** Les teintes proposees pour le texte : la marque, le corps, l'attenue. */
const TEXT_SWATCHES = [DEFAULT_COLORS.buttonBg, DEFAULT_COLORS.text, "#6b6b6b"] as const;

const Separator = () => <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />;

function Btn({
  label,
  active,
  disabled,
  onClick,
  children,
  first,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** Le seul bouton atteignable a la tabulation ; les fleches font le reste. */
  first?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      tabIndex={first ? 0 : -1}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        active && "bg-brand/12 text-brand hover:bg-brand/16 hover:text-brand",
      )}
    >
      {children}
    </button>
  );
}
