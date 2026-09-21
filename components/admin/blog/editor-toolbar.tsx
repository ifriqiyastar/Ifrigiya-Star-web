"use client";

import type { Editor } from "@tiptap/react";
import {
  BoldIcon,
  Heading2Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  RedoIcon,
  UndoIcon,
} from "lucide-react";

import { ImageUploadButton } from "@/components/admin/blog/image-upload-button";
import { useAdminTranslations } from "@/lib/i18n/admin-client";
import { cn } from "@/lib/utils";

function ToolbarButton({
  active,
  disabled,
  onClick,
  children,
  label,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        active && "bg-brand/12 text-brand hover:bg-brand/16 hover:text-brand",
      )}
    >
      {children}
    </button>
  );
}

/** Barre d'outils Tiptap : mise en forme courante d'un article de blog, rien de plus. */
export function EditorToolbar({ editor }: { editor: Editor | null }) {
  const i18n = useAdminTranslations();
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
      <ToolbarButton
        label={i18n.t("Gras")}
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={i18n.t("Italique")}
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={i18n.t("Titre de section")}
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2Icon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={i18n.t("Liste a puces")}
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <ListIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={i18n.t("Liste numerotee")}
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrderedIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={i18n.t("Citation")}
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <QuoteIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={i18n.t("Lien")}
        active={editor.isActive("link")}
        onClick={() => {
          const url = window.prompt(i18n.t("Adresse du lien"));
          if (url) editor.chain().focus().setLink({ href: url }).run();
          else editor.chain().focus().unsetLink().run();
        }}
      >
        <LinkIcon className="size-4" />
      </ToolbarButton>

      <ImageUploadButton
        label={i18n.t("Image")}
        onUploaded={(url) => editor.chain().focus().setImage({ src: url }).run()}
      />

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />

      <ToolbarButton
        label={i18n.t("Annuler")}
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <UndoIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label={i18n.t("Retablir")}
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <RedoIcon className="size-4" />
      </ToolbarButton>
    </div>
  );
}
