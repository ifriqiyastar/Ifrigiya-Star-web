import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getAdminAccess, requireAdmin } from "@/lib/auth";
import { fetchAdminQueue, fetchNextAdminEvent } from "@/lib/queries/admin-queue";
import { fetchDiagnostics } from "@/lib/queries/diagnostics";

/**
 * Toutes les pages du back-office passent par ici, donc par `requireAdmin()`.
 * Ce n'est pas la seule barriere : chaque Server Action refait le controle, et
 * le RLS Postgres (`public.is_admin()`) reste le dernier mot.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  const access = await getAdminAccess(admin.userId);

  // Une seule lecture des files d'attente : elle alimente a la fois les
  // pastilles de la navigation et la cloche du bandeau, qui ne peuvent donc
  // plus annoncer deux chiffres differents. Elle est filtree par les
  // permissions de l'administrateur connecte.
  const [{ tasks, badges }, diagnostics, nextEvent] = await Promise.all([
    fetchAdminQueue(access.permissions),
    fetchDiagnostics(access.permissions),
    fetchNextAdminEvent(access.permissions),
  ]);

  return (
    <SidebarProvider
      className="admin-dashboard-shell"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 74)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="sidebar"
        user={{
          name: admin.fullName ?? "Administrateur",
          email: admin.email ?? "",
          roleLabel: access.roleLabel,
        }}
        badges={badges}
        permissions={access.permissions}
        diagnostics={diagnostics}
        tasks={tasks}
        nextEvent={nextEvent}
      />
      <SidebarInset>
        <SiteHeader
          user={{
            name: admin.fullName ?? "Administrateur",
            email: admin.email ?? "",
            roleLabel: access.roleLabel,
          }}
          tasks={tasks}
        />
        <div className="@container/main flex flex-1 flex-col">
          <main className="admin-content flex flex-1 flex-col gap-4 p-3 sm:p-4 lg:gap-5 lg:p-5">
            {children}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
