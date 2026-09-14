"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/actions/result";
import { useAdminI18n } from "@/lib/i18n/admin-client";

const INITIAL: ActionResult = { ok: true, message: "" };

export function ServerForm({
  action,
  children,
  submitLabel,
  className,
  onSuccess,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  onSuccess?: () => void;
}) {
  const { dict } = useAdminI18n();
  const [state, formAction, pending] = useActionState(
    async (_previous: ActionResult, formData: FormData) => action(formData),
    INITIAL,
  );

  React.useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      onSuccess?.();
    }
    else toast.error(state.message);
  }, [state, onSuccess]);

  return (
    <form action={formAction} className={className}>
      {children}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        {submitLabel ?? dict.common.save}
      </Button>
    </form>
  );
}
