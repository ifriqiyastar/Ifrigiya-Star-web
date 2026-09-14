"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  CircleAlertIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  LockKeyholeIcon,
  MailIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export type SignInLabels = {
  email: string;
  password: string;
  submit: string;
  pending: string;
  invalid: string;
  showPassword: string;
  hidePassword: string;
};

export function SignInForm({
  initialError,
  adminHref,
  labels,
}: {
  initialError?: string;
  /** Destination apres connexion, deja prefixee de la langue. */
  adminHref: string;
  labels: SignInLabels;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | undefined>(initialError);
  const [pending, setPending] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError || !data.user) {
      setPending(false);
      // Supabase repond en anglais : seul le cas courant est reecrit, les
      // autres messages sont passes tels quels plutot que traduits a
      // l'aveugle.
      setError(
        signInError?.message === "Invalid login credentials"
          ? labels.invalid
          : (signInError?.message ?? labels.invalid),
      );
      return;
    }

    // Le controle du role est fait cote serveur par requireAdmin() : on se
    // contente de naviguer, la garde redirigera un non-admin ici avec un
    // message. `refresh()` fait relire les cookies fraichement poses.
    router.replace(adminHref);
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-5"
      aria-busy={pending}
    >
      <div className="space-y-2">
        <Label htmlFor="email">{labels.email}</Label>
        <div className="relative">
          <MailIcon className="pointer-events-none absolute start-4 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@ifriqiyastar.com"
            className="h-12 rounded-xl border-white/10 bg-white/5 ps-11 text-base placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-brand/15"
            aria-describedby={error ? "sign-in-error" : undefined}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{labels.password}</Label>
        <div className="relative">
          <LockKeyholeIcon className="pointer-events-none absolute start-4 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 rounded-xl border-white/10 bg-white/5 ps-11 pe-12 text-base focus-visible:ring-2 focus-visible:ring-brand/15"
            aria-describedby={error ? "sign-in-error" : undefined}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute end-1 top-1 size-10 rounded-lg text-muted-foreground hover:text-white"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? labels.hidePassword : labels.showPassword}
            aria-controls="password"
          >
            {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </Button>
        </div>
      </div>

      {error ? (
        <p id="sign-in-error" role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm leading-relaxed text-destructive">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}

      <Button type="submit" className="mt-2 h-12 w-full gap-3 rounded-xl text-sm shadow-lg shadow-brand/10" disabled={pending}>
        {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? labels.pending : labels.submit}
        {!pending ? <ArrowRightIcon className="size-4" aria-hidden="true" /> : null}
      </Button>
    </form>
  );
}
