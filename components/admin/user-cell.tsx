import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { getAdminDict } from "@/lib/i18n/admin";
import { cn } from "@/lib/utils";

/** Identite compacte pour les cellules de tableau : avatar + nom + sous-ligne. */
export async function UserCell({
  name,
  secondary,
  avatarUrl,
  href,
  className,
}: {
  name: string | null | undefined;
  secondary?: string | null;
  avatarUrl?: string | null;
  href?: string;
  className?: string;
}) {
  const dict = await getAdminDict();
  const displayName = name?.trim() || dict.common.noName;
  const body = (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar className="size-9 shrink-0 rounded-full">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="rounded-full bg-accent text-[0.625rem] font-semibold tracking-wider">
          {initials(displayName)}
        </AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
        {secondary ? (
          <span className="truncate text-xs text-muted-foreground">{secondary}</span>
        ) : null}
      </span>
    </span>
  );

  if (!href) return <span className={cn("flex", className)}>{body}</span>;

  return (
    <Link
      href={href}
      className={cn(
        "flex rounded-md outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      {body}
    </Link>
  );
}
