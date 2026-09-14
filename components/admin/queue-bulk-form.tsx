"use client";

import { useAdminTranslations } from "@/lib/i18n/admin-client";


import * as React from "react";
import { CheckCheckIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Enveloppe la file de validation dans un formulaire : les cases a cocher des
 * lignes (`name="ids"`) sont lues telles quelles par le Server Action, et le
 * bouton « Validation groupee » affiche le nombre reellement selectionne.
 *
 * Les lignes restent rendues **cote serveur** : ce composant ne connait pas les
 * dossiers, il compte les cases via `FormData` a chaque changement. C'est ce
 * qui permet d'avoir une selection interactive sans transformer la file en
 * composant client.
 *
 * La case « tout selectionner » porte `data-select-all` ; elle est traitee ici
 * plutot que par un etat partage, pour la meme raison.
 */
export function QueueBulkForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const i18n = useAdminTranslations();

  const formRef = React.useRef<HTMLFormElement>(null);
  const [count, setCount] = React.useState(0);
  const [pending, startTransition] = React.useTransition();

  function recount() {
    const form = formRef.current;
    if (form) setCount(new FormData(form).getAll("ids").filter(Boolean).length);
  }

  function onChange(event: React.ChangeEvent<HTMLFormElement>) {
    // L'evenement remonte de la case cochee (delegation) : `currentTarget` est
    // le formulaire, `target` la case.
    const target = event.target as unknown as HTMLInputElement;
    if (target.dataset.selectAll !== undefined) {
      formRef.current
        ?.querySelectorAll<HTMLInputElement>('input[name="ids"]')
        .forEach((input) => {
          input.checked = target.checked;
        });
    }
    recount();
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        toast.success(result.message);
        form.reset();
        setCount(0);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <form ref={formRef} onChange={onChange} onSubmit={submit} className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <p className="micro-label text-muted-foreground">
          {count > 0 ? i18n.t("{0} dossier(s) selectionne(s)", { "0": count }) : i18n.t("Selection multiple")}
        </p>
        <button
          type="submit"
          disabled={pending || count === 0}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors",
            count > 0
              ? "bg-accent text-foreground hover:bg-accent/70"
              : "cursor-not-allowed bg-secondary text-muted-foreground",
          )}
        >
          {pending ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <CheckCheckIcon className="size-3.5 text-brand" />
          )}
          {i18n.t("Validation groupee")}{count > 0 ? ` (${count})` : ""}
        </button>
      </div>
      {children}
    </form>
  );
}
