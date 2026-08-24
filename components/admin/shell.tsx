"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BellIcon,
  ChevronRightIcon,
  LogOutIcon,
  MenuIcon,
  SearchIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react";

import { NAV_ITEMS, type NavBadges } from "@/components/admin/nav-items";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

type ShellProps = {
  // `profiles` n'a pas de colonne photo sur ce projet : la carte de compte
  // affiche donc toujours les initiales.
  user: { fullName: string | null; email: string | null };
  badges: NavBadges;
  children: React.ReactNode;
};

/**
 * Chrome du back-office, calque sur la maquette de reference : rail lateral de
 * pastilles pleine-largeur (l'element actif en degrade lime), barre superieure
 * avec recherche globale, et contenu sur fond noir.
 *
 * Sous `lg` le rail sort du flux et devient un tiroir : les tableaux du
 * back-office ont besoin de toute la largeur sur un telephone.
 */
export function AdminShell({ user, badges, children }: ShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const nav = (
    // Le tiroir se referme au clic sur un lien plutot que dans un effet
    // declenche par le changement de `pathname` : un `setState` synchrone dans
    // un effet provoque un rendu en cascade a chaque navigation.
    <nav className="flex flex-col gap-1.5" onClick={() => setDrawerOpen(false)}>
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const count = item.badge ? badges[item.badge] : 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-full px-3.5 py-2.5 text-sm transition-colors",
              active
                ? "bg-brand-gradient font-semibold text-brand-foreground"
                : "bg-sidebar-pill text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {count > 0 ? (
              <span
                className={cn(
                  "flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold tabular-nums",
                  active ? "bg-black/15 text-brand-foreground" : "bg-brand text-brand-foreground",
                )}
              >
                {count > 99 ? "99+" : count}
              </span>
            ) : (
              <ChevronRightIcon
                className={cn(
                  "size-3.5 shrink-0",
                  active ? "text-brand-foreground/60" : "text-muted-foreground/50",
                )}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <Link href="/admin" className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-gradient font-heading text-sm font-extrabold text-brand-foreground">
        IS
      </span>
      <span className="font-heading text-sm font-extrabold tracking-wide">IFRIQIYA STAR</span>
    </Link>
  );

  const sidebarFooter = (
    <div className="space-y-3">
      <QueueCard badges={badges} onNavigate={() => setDrawerOpen(false)} />
      <AccountCard user={user} />
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Rail lateral — desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-sidebar px-3 py-4 lg:flex">
        <div className="px-1.5 pb-6">{brand}</div>
        {nav}
        <div className="mt-auto pt-6">{sidebarFooter}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barre superieure */}
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-background/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="Ouvrir le menu"
            className="lg:hidden"
            onClick={() => setDrawerOpen(true)}
          >
            <MenuIcon />
          </Button>
          <div className="lg:hidden">{brand}</div>

          <GlobalSearch className="hidden flex-1 sm:block lg:max-w-md" />

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/admin/validations"
              className="hidden items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:flex"
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  badges.validations > 0 ? "bg-brand" : "bg-muted-foreground",
                )}
              />
              {badges.validations > 0
                ? `${badges.validations} a valider`
                : "Rien a valider"}
            </Link>
            <Link
              href="/admin/moderation"
              aria-label="Signalements"
              className="relative flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
            >
              <BellIcon className="size-4" />
              {badges.signalements > 0 ? (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-background" />
              ) : null}
            </Link>
            <Avatar className="size-9 rounded-full">
              <AvatarFallback className="rounded-full bg-brand-gradient text-[0.625rem] font-bold text-brand-foreground">
                {initials(user.fullName ?? user.email)}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <div className="px-4 pb-2 sm:hidden">
          <GlobalSearch />
        </div>

        <main className="min-w-0 flex-1 px-4 pt-2 pb-8 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px] space-y-5">{children}</div>
        </main>
      </div>

      {/* Tiroir — mobile / tablette */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-black/70"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar px-3 py-4">
            <div className="flex items-center justify-between px-1.5 pb-6">
              {brand}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Fermer le menu"
                onClick={() => setDrawerOpen(false)}
              >
                <XIcon />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>
            <div className="pt-4">{sidebarFooter}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Recherche globale de la barre superieure. La maquette y cherche « content,
 * matches, users » ; ici la seule recherche transverse qui existe cote base est
 * celle des comptes, donc elle mene a l'annuaire filtre plutot que de promettre
 * une recherche qu'aucune requete ne sait faire.
 */
function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [term, setTerm] = React.useState("");

  return (
    <form
      className={cn("relative", className)}
      onSubmit={(event) => {
        event.preventDefault();
        const value = term.trim();
        router.push(value ? `/admin/utilisateurs?q=${encodeURIComponent(value)}` : "/admin/utilisateurs");
      }}
    >
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Rechercher un joueur, un professionnel, un email…"
        aria-label="Rechercher un compte"
        className="rounded-full border-transparent pl-10"
      />
    </form>
  );
}

/**
 * Bloc bas du rail. La maquette place ici un assistant conversationnel ; le
 * back-office n'en a pas, donc ce meme emplacement — et le meme halo — porte le
 * resume des files d'attente, qui est l'information dont l'administrateur a
 * reellement besoin en permanence.
 */
function QueueCard({
  badges,
  onNavigate,
}: {
  badges: NavBadges;
  onNavigate: () => void;
}) {
  const total = badges.validations + badges.signalements;

  return (
    <Link
      href="/admin/validations"
      onClick={onNavigate}
      className="relative block overflow-hidden rounded-2xl bg-card p-4 ring-1 ring-white/5 transition-colors hover:ring-brand/30"
    >
      <span aria-hidden className="glow-lime pointer-events-none absolute inset-0" />
      <div className="relative space-y-2.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-brand-gradient text-brand-foreground">
          <ShieldCheckIcon className="size-4" />
        </span>
        <p className="font-heading text-2xl leading-none font-extrabold tabular-nums">{total}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {total === 0
            ? "Aucun dossier en attente."
            : `${badges.validations} validation(s) · ${badges.signalements} signalement(s)`}
        </p>
      </div>
    </Link>
  );
}

function AccountCard({ user }: { user: ShellProps["user"] }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // `refresh()` refait tourner les Server Components sans la session : la
    // garde `requireAdmin()` renvoie alors vers /connexion d'elle-meme, et le
    // cache RSC de l'ancienne session est invalide.
    router.replace("/connexion");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2.5 rounded-full bg-sidebar-pill p-2 pr-1">
      <Avatar className="size-8 shrink-0 rounded-full">
        <AvatarFallback className="rounded-full bg-accent text-[0.625rem] font-semibold">
          {initials(user.fullName ?? user.email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{user.fullName ?? "Administrateur"}</p>
        <p className="truncate text-[0.6875rem] text-muted-foreground">{user.email}</p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Se deconnecter"
        disabled={signingOut}
        onClick={signOut}
      >
        <LogOutIcon />
      </Button>
    </div>
  );
}
