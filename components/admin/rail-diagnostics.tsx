import { TriangleAlertIcon } from "lucide-react";

import type { Diagnostic } from "@/lib/queries/diagnostics";
import { cn } from "@/lib/utils";

/**
 * Bloc de diagnostic du rail, entre la navigation et le compte connecte.
 *
 * Il ne se dessine **que** s'il y a quelque chose a signaler : quand
 * l'installation est complete, l'espace reste vide, ce qui est le cas normal
 * et le seul etat que la plupart des administrateurs verront.
 */
export function RailDiagnostics({ issues }: { issues: Diagnostic[] }) {
  if (!issues.length) return null;

  return (
    <section className="mx-1 space-y-1.5" aria-label="Etat de la configuration">
      <p className="micro-label px-2 text-muted-foreground/80">A verifier</p>
      {issues.map((issue) => (
        <article
          key={issue.id}
          className={cn(
            "rounded-lg border p-2.5",
            issue.tone === "danger"
              ? "border-destructive/30 bg-destructive/10"
              : "border-warning/25 bg-warning/10",
          )}
        >
          <h3
            className={cn(
              "flex items-start gap-1.5 text-[0.6875rem] leading-snug font-bold",
              issue.tone === "danger" ? "text-destructive" : "text-warning",
            )}
          >
            <TriangleAlertIcon className="mt-0.5 size-3 shrink-0" />
            {issue.title}
          </h3>
          <p className="mt-1 text-[0.625rem] leading-relaxed text-muted-foreground">
            {issue.detail}
          </p>
          {issue.hint ? (
            <p className="mt-1 truncate font-mono text-[0.5625rem] text-muted-foreground/70">
              {issue.hint}
            </p>
          ) : null}
        </article>
      ))}
    </section>
  );
}
