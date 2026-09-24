"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, UserPlusIcon } from "lucide-react";
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
      <DialogContent>
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>{d.title}</DialogTitle>
            <DialogDescription>{d.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editor-email">{d.emailLabel}</Label>
              <Input
                id="editor-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={d.emailPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editor-name">{d.nameLabel}</Label>
              <Input
                id="editor-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder={d.namePlaceholder}
              />
            </div>
            <p className="text-xs text-muted-foreground">{d.hint}</p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {dict.common.cancel}
            </DialogClose>
            <Button type="submit" disabled={pending || !email.trim()}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {d.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
