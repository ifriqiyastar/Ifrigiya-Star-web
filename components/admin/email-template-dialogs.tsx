"use client";

import * as React from "react";
import { Loader2Icon, PencilLineIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/actions/result";
import { useAdminI18n, useAdminTranslations } from "@/lib/i18n/admin-client";

/**
 * Creation d'un modele : un nom, une description facultative.
 *
 * Le modele nait **vide** — il part des textes livres et se personnalise
 * ensuite, langue par langue. Demander les treize champs d'entree ferait
 * d'une creation un formulaire, alors que c'est un geste.
 */
export function NewTemplateDialog({
  action,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const i18n = useAdminTranslations();
  const { dict } = useAdminI18n();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    start(async () => {
      const result = await action(formData);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-bold text-brand-foreground transition-[filter] hover:brightness-110"
      >
        <PlusIcon className="size-4" />
        {i18n.t("Nouveau modele")}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{i18n.t("Nouveau modele")}</DialogTitle>
              <DialogDescription>
                {i18n.t("Il part des textes livres. Vous le personnaliserez ensuite, langue par langue.")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <label htmlFor="tpl-name" className="block text-xs font-medium">
                  {i18n.t("Nom")}
                </label>
                <input
                  id="tpl-name"
                  name="name"
                  required
                  maxLength={80}
                  autoFocus
                  placeholder={i18n.t("Ex : annonce Scout Day")}
                  className="h-9 w-full rounded-lg bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-brand"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="tpl-desc" className="block text-xs font-medium">
                  {i18n.t("A quoi il sert")}
                </label>
                <input
                  id="tpl-desc"
                  name="description"
                  maxLength={160}
                  placeholder={i18n.t("Note interne, jamais envoyee")}
                  className="h-9 w-full rounded-lg bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-accent px-3 text-sm font-semibold hover:bg-accent/70"
              >
                {dict.common.cancel}
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-bold text-brand-foreground disabled:opacity-60"
              >
                {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {i18n.t("Creer")}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}


/**
 * Renommer un modele, depuis sa carte.
 *
 * Le meme formulaire que la creation, prerempli : un modele mal nomme se
 * corrige la ou on le lit, pas en ouvrant son editeur.
 */
export function RenameTemplateDialog({
  action,
  name,
  description,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  name: string;
  description: string | null;
}) {
  const i18n = useAdminTranslations();
  const { dict } = useAdminI18n();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    start(async () => {
      const result = await action(formData);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <PencilLineIcon className="size-3.5" />
        {i18n.t("Renommer")}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {/* `key` sur le nom : rouvrir apres un renommage doit repartir de
              la valeur enregistree, pas de celle qu'on avait tapee. */}
          <form key={name} onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{i18n.t("Renommer le modele")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <label htmlFor="rename-name" className="block text-xs font-medium">
                  {i18n.t("Nom du modele")}
                </label>
                <input
                  id="rename-name"
                  name="name"
                  required
                  maxLength={80}
                  autoFocus
                  defaultValue={name}
                  className="h-9 w-full rounded-lg bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="rename-desc" className="block text-xs font-medium">
                  {i18n.t("A quoi il sert")}
                </label>
                <input
                  id="rename-desc"
                  name="description"
                  maxLength={160}
                  defaultValue={description ?? ""}
                  placeholder={i18n.t("Note interne, jamais envoyee")}
                  className="h-9 w-full rounded-lg bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-accent px-3 text-sm font-semibold hover:bg-accent/70"
              >
                {dict.common.cancel}
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-bold text-brand-foreground disabled:opacity-60"
              >
                {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {i18n.t("Enregistrer")}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
