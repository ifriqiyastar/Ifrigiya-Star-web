import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-14 text-center", className)}>
      {Icon ? (
        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-muted-foreground">
          <Icon className="size-5" />
        </span>
      ) : null}
      <p className="font-heading text-sm font-bold tracking-wider uppercase">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
