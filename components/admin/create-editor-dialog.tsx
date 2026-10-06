"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, MailCheckIcon, MailIcon, UserIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEditorAccount } from "@/lib/actions/admin-accounts";
import { useAdminI18n } from "@/lib/i18n/admin-client";

/**
 * Meme raison que `ReasonDialog` : Base UI compose le declencheur via
 * `render`, et fusionner deux `data-slot` differemment au rendu serveur et au
 * rendu client casse l'hydratation sur chaque dialogue rendu dans une page
 * serveur.
 */
function asTrigger(trigger: React.ReactNode): React.ReactElement {
  return React.isValidElement(trigger)
    ? React.cloneElement(trigger as React.ReactElement<Record<string, unknown>>, {
        "data-slot": "dialog-trigger",
      })
    : (trigger as unknown as React.ReactElement);
}

/**
 * Cree un compte reserve au role `editeur` (tableau de bord + blog
 * uniquement). Reserve au super administrateur cote serveur
 * (`createEditorAccount`) — le bouton reste visible a qui n'a pas ce droit,
 * le refus s'affiche alors en toast : coherent avec le reste du back-office,
 * ou seul le geste qui touche vraiment Postgres (publier un Scout Day,
 * valider un retrait) est masque a la source.
 */
export function CreateEditorDialog() {
  const { dict } = useAdminI18n();
  const d = dict.createEditor;
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("email", email.trim());
      formData.set("full_name", fullName.trim());
      const result = await createEditorAccount(formData);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        setEmail("");
        setFullName("");
        // Le nouveau compte doit apparaitre immediatement dans la liste
        // (role, colonne conformite) sans depasser une simple revalidation
        // cote serveur — voir le commentaire dans ActionButton.
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error(dict.common.actionFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={asTrigger(
          <Button variant="outline" size="sm">
            <UserPlusIcon />
            {d.trigger}
          </Button>,
        )}
      />
      {/* Meme ossature que la fenetre Scout Day : en-tete a pastille, corps,
          pied separe. `--popover` a `#000000` parce que le portail rend la
          fenetre hors de `.admin-dashboard-shell`, ou elle prenait le gris
          general (`#1B1B1D`). */}
      <DialogContent className="gap-0 overflow-hidden p-0 [--popover:#000000] sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col">
          <DialogHeader className="flex-row items-start gap-3 border-b border-border px-5 pt-5 pb-4 pr-16 sm:px-6">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand ring-1 ring-brand/25">
              <UserPlusIcon className="size-4.5" />
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="font-heading text-lg font-bold">{d.title}</DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">{d.description}</DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-4 px-5 py-5 sm:px-6">
            <div className="space-y-1.5">
              <Label htmlFor="editor-email">{d.emailLabel}</Label>
              <div className="relative">
                <MailIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="editor-email"
                  type="email"
                  required
                  autoComplete="off"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={d.emailPlaceholder}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editor-name">{d.nameLabel}</Label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="editor-name"
                  autoComplete="off"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder={d.namePlaceholder}
                  className="pl-9"
                />
              </div>
            </div>
            {/* Ce qui va se passer a l'envoi : un bandeau plutot qu'une ligne
                grise sous les champs, parce que c'est la consequence du geste
                — un e-mail part vers un tiers. */}
            <div className="flex items-start gap-3 rounded-lg border border-brand/25 bg-brand/8 px-3.5 py-3">
              <MailCheckIcon className="mt-0.5 size-4 shrink-0 text-brand" />
              <p className="text-xs leading-relaxed text-foreground/80">{d.hint}</p>
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 flex-row justify-end gap-2 rounded-none border-t border-border bg-popover px-5 py-4 sm:px-6">
            <DialogClose render={<Button type="button" variant="ghost" />}>
              {dict.common.cancel}
            </DialogClose>
            <Button type="submit" disabled={pending || !email.trim()}>
              {pending ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />}
              {d.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
