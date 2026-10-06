"use client"

import Link from "next/link"
import { BrandMark } from "@/components/admin/brand-mark"
import { useRouter } from "next/navigation"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { EllipsisVerticalIcon, ShieldCheckIcon, BellIcon, LogOutIcon, UserRoundIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useAdminI18n } from "@/lib/i18n/admin-client"
import type { AdminPermission } from "@/lib/auth"
import { cn } from "@/lib/utils"

/**
 * L'icone d'une entree du menu, dans une pastille. Au survol la ligne passe au
 * vert de la marque : la pastille s'assombrit alors legerement plutot que de
 * rester grise sur le vert.
 */
function MenuIcon({
  icon: Icon,
  destructive = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  destructive?: boolean
}) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md",
        destructive
          ? "bg-destructive/12"
          : "bg-secondary group-focus/dropdown-menu-item:bg-black/15",
      )}
    >
      <Icon className="size-3.5" />
    </span>
  )
}

export function NavUser({
  user,
  permissions,
}: {
  user: {
    name: string
    email: string
    /** Role RBAC affiche sous l'adresse, comme dans les maquettes. */
    roleLabel?: string
    avatar?: string
  }
  /** Memes permissions que `AppSidebar` : ces raccourcis menent aux memes
   * ecrans que le rail, donc suivent la meme garde — sans quoi un compte
   * sans `verifications.review` (un editeur, par ex.) voyait quand meme
   * « Validations » ici et tombait sur l'ecran de refus en cliquant. */
  permissions: AdminPermission[]
}) {
  const { isMobile } = useSidebar()
  const { dict } = useAdminI18n()
  const router = useRouter()
  async function signOut() {
    await createClient().auth.signOut()
    router.replace("/connexion")
    router.refresh()
  }
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="h-12 cursor-pointer rounded-lg border border-sidebar-border bg-secondary/40 px-2 text-sidebar-foreground hover:bg-secondary aria-expanded:bg-secondary"
              />
            }
          >
            {/* LE LOGO PLUTOT QUE DES INITIALES.
                `app/[locale]/admin/layout.tsx` ne passe aucun `avatar` — la
                photo d'un administrateur n'existe nulle part dans le schema —
                donc ce repli est ce qui s'affiche **toujours**, et il
                affichait une lettre seule dans un carre lime : `initials()`
                ne garde que les deux premiers mots, et une adresse e-mail
                n'en a qu'un. `AvatarImage` reste au-dessus pour qu'une photo,
                le jour ou il y en aurait une, l'emporte encore. */}
            <Avatar className="size-8 rounded-lg">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-lg bg-transparent">
                <BrandMark size={32} className="size-full" />
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left leading-tight">
              <span className="truncate text-[0.6875rem] font-medium text-sidebar-foreground/80">
                {user.email}
              </span>
              <span className="micro-label truncate text-brand">
                {user.roleLabel ?? user.name}
              </span>
            </div>
            <EllipsisVerticalIcon className="ml-auto size-3.5 text-sidebar-foreground/50" />
          </DropdownMenuTrigger>
          {/* `--popover` a `#000000` : rendu dans un portail hors de
              `.admin-dashboard-shell`, le menu prenait le gris general
              (`#1B1B1D`) — meme correction que la cloche et le menu de
              langue. */}
          <DropdownMenuContent
            className="min-w-64 p-0 [--popover:#000000]"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-3 border-b border-border px-3.5 py-3.5 text-left">
                  <Avatar className="size-10 rounded-xl">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-xl bg-transparent">
                      <BrandMark size={40} className="size-full" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0 flex-1 gap-0.5 leading-tight">
                    <span className="truncate font-heading text-sm font-bold text-foreground">{user.name}</span>
                    {/* Un compte sans nom affiche son adresse comme nom : la
                        repeter dessous ferait deux lignes identiques. */}
                    {user.email !== user.name ? (
                      <span className="truncate text-[0.6875rem] text-muted-foreground">{user.email}</span>
                    ) : null}
                    {user.roleLabel ? (
                      <span className="mt-1 w-fit rounded-full bg-brand/12 px-2 py-0.5 text-[0.625rem] font-semibold text-brand ring-1 ring-brand/25">
                        {user.roleLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            {/* Son propre profil : ouvert a tout administrateur, sans
                permission — c'est son compte, pas un ecran de gestion. Les
                raccourcis suivent, gardes comme le rail. */}
            <DropdownMenuGroup className="border-b border-border p-1.5">
              <DropdownMenuItem className="py-2" render={<Link href="/admin/profil" />}>
                <MenuIcon icon={UserRoundIcon} />
                {dict.userMenu.profile}
              </DropdownMenuItem>
                {permissions.includes("verifications.review") ? (
                  <DropdownMenuItem className="py-2" render={<Link href="/admin/validations/joueurs" />}>
                    <MenuIcon icon={ShieldCheckIcon} />
                    {dict.userMenu.validations}
                  </DropdownMenuItem>
                ) : null}
                {/* Le lien manquait : l'entree n'etait cliquable que pour ne
                    rien faire. */}
                {permissions.includes("notifications.manage") ? (
                  <DropdownMenuItem className="py-2" render={<Link href="/admin/notifications" />}>
                    <MenuIcon icon={BellIcon} />
                    {dict.userMenu.notifications}
                  </DropdownMenuItem>
                ) : null}
            </DropdownMenuGroup>
            <div className="p-1.5">
              {/* Rouge : c'est le seul geste du menu qui met fin a quelque
                  chose. */}
              <DropdownMenuItem variant="destructive" className="py-2" onClick={signOut}>
                <MenuIcon icon={LogOutIcon} destructive />
                {dict.userMenu.signOut}
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
