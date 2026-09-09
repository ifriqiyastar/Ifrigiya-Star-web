import { cn } from "@/lib/utils";

export type Note = {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  body: React.ReactNode;
};

/**
 * Bande de rappels en bas d'ecran, comme les maquettes en posent sous chaque
 * grande file : la regle metier qui explique ce que le geste declenche
 * reellement, ecrite une fois, hors du tableau.
 *
 * C'est de la **documentation**, pas de la donnee : rien ici n'est chiffre, et
 * rien n'est cliquable. Les regles decrites doivent etre celles que Postgres
 * applique — un rappel qui ment est pire qu'un rappel absent.
 */
export function NoteCards({ notes, className }: { notes: Note[]; className?: string }) {
  return (
    <section className={cn("grid gap-3 md:grid-cols-2 xl:grid-cols-3", className)}>
      {notes.map((note) => (
        <article
          key={note.title}
          className="rounded-xl border border-border bg-card/60 p-4"
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {note.icon ? (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-brand/12 text-brand">
                <note.icon className="size-3.5" />
              </span>
            ) : null}
            {note.title}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{note.body}</p>
        </article>
      ))}
    </section>
  );
}
