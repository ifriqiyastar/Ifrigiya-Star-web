import { AppSidebar } from "@/components/app-sidebar";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { AdminQueueProvider } from "@/components/admin/queue-live";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getAdminAccess, requireAdmin } from "@/lib/auth";
import { AdminI18nProvider } from "@/lib/i18n/admin-client";
import { getAdminDict, getAdminLocale } from "@/lib/i18n/admin";
import { fetchAdminQueue, hasQueueAccess } from "@/lib/queries/admin-queue";
import { fetchDiagnostics } from "@/lib/queries/diagnostics";

/**
 * Toutes les pages du back-office passent par ici, donc par `requireAdmin()`.
 * Ce n'est pas la seule barriere : chaque Server Action refait le controle, et
 * le RLS Postgres (`public.is_admin()`) reste le dernier mot.
 */
export default async function AdminLayout({
  children,
}: LayoutProps<"/[locale]/admin">) {
  const admin = await requireAdmin();
  // La langue et le dictionnaire du back-office sont lus une fois ici : les
  // requetes qui rendent du texte (files d'attente, diagnostics, libelle de
  // role) les recoivent, et les composants client les retrouvent dans
  // `AdminI18nProvider` plutot que de les traverser en props.
  const [locale, dict] = await Promise.all([getAdminLocale(), getAdminDict()]);
  const access = await getAdminAccess(admin.userId, dict);

  // Une seule lecture des files d'attente : elle alimente a la fois les
  // pastilles de la navigation et la cloche du bandeau, qui ne peuvent donc
  // plus annoncer deux chiffres differents. Elle est filtree par les
  // permissions de l'administrateur connecte.
  const [{ tasks, badges }, diagnostics] = await Promise.all([
    fetchAdminQueue(access.permissions, dict),
    fetchDiagnostics(access.permissions, dict),
  ]);

  return (
    // Une seule source vivante pour la cloche et les pastilles : la lecture
    // serveur ci-dessus amorce l'affichage, le fournisseur la reactualise
    // ensuite sans rejouer la page.
    <AdminI18nProvider locale={locale} dict={dict}>
      <AdminQueueProvider initial={{ tasks, badges }}>
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
              name: admin.fullName ?? dict.roles.fallback,
              email: admin.email ?? "",
              roleLabel: access.roleLabel,
            }}
            permissions={access.permissions}
            diagnostics={diagnostics}
          />
          <SidebarInset>
            <SiteHeader
              user={{
                name: admin.fullName ?? dict.roles.fallback,
                email: admin.email ?? "",
                roleLabel: access.roleLabel,
              }}
              permissions={access.permissions}
              showBell={hasQueueAccess(access.permissions)}
            />
            {/* La cloche se met a jour toute seule, mais l'ecran sous elle restait
            celui du rendu initial : un signalement compte dans la pastille sans
            apparaitre dans la liste, et il fallait recharger. `AutoRefresh`
            rejoue le Server Component de la page courante — donc ses requetes —
            sans rechargement ni perte de l'etat client. */}
            <AutoRefresh intervalMs={30_000} />
            <div className="@container/main flex flex-1 flex-col">
              <main className="admin-content flex flex-1 flex-col gap-4 p-3 sm:p-4 lg:gap-5 lg:p-5">
                {children}
              </main>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </AdminQueueProvider>
    </AdminI18nProvider>
  );
}
