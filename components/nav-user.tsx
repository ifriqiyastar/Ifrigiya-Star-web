"use client"

import Link from "next/link"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { EllipsisVerticalIcon, ShieldCheckIcon, BellIcon, LogOutIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { initials } from "@/lib/format"
import { useAdminI18n } from "@/lib/i18n/admin-client"
import type { AdminPermission } from "@/lib/auth"

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
                className="h-12 rounded-lg border border-sidebar-border bg-secondary/40 px-2 text-sidebar-foreground hover:bg-secondary aria-expanded:bg-secondary"
              />
            }
          >
            <Avatar className="size-8 rounded-lg">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-lg bg-primary font-semibold text-black">
                {initials(user.name || user.email)}
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
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg">{initials(user.name || user.email)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {permissions.includes("verifications.review") || permissions.includes("notifications.manage") ? (
              <>
                <DropdownMenuGroup>
                  {permissions.includes("verifications.review") ? (
                    <DropdownMenuItem render={<Link href="/admin/validations" />}>
                      <ShieldCheckIcon />
                      {dict.userMenu.validations}
                    </DropdownMenuItem>
                  ) : null}
                  {/* Le lien manquait : l'entree n'etait cliquable que pour ne
                      rien faire. */}
                  {permissions.includes("notifications.manage") ? (
                    <DropdownMenuItem render={<Link href="/admin/notifications" />}>
                      <BellIcon />
                      {dict.userMenu.notifications}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem onClick={signOut}>
              <LogOutIcon />
              {dict.userMenu.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
