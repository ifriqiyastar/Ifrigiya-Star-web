"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleAlertIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function SignInForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | undefined>(initialError);
  const [pending, setPending] = React.useState(false);

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
      setError(
        signInError?.message === "Invalid login credentials"
          ? "Identifiants incorrects."
          : (signInError?.message ?? "Connexion impossible."),
      );
      return;
    }

    // Le controle du role est fait cote serveur par requireAdmin() : on se
    // contente de naviguer, la garde redirigera un non-admin ici avec un
    // message. `refresh()` fait relire les cookies fraichement poses.
    router.replace("/admin");
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="space-y-2">
        <Label htmlFor="email">Adresse email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@ifriqiyastar.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {error ? (
        <p className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
          <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        Se connecter
      </Button>
    </form>
  );
}
