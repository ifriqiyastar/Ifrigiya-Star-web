import { NextResponse } from "next/server";

import { getAdminAccess, requireAdmin } from "@/lib/auth";
import { getRequestAdminDict } from "@/lib/i18n/admin";
import { fetchAdminQueue } from "@/lib/queries/admin-queue";

/**
 * Les files d'attente de l'administration en JSON, pour la cloche du bandeau
 * et les pastilles du rail (`AdminQueueProvider`).
 *
 * Meme lecture et meme filtrage par permissions que le layout : les deux ne
 * peuvent donc pas annoncer deux chiffres differents. `requireAdmin()` est
 * refait ici, comme dans chaque Server Action — une route est joignable par un
 * GET direct.
 *
 * La langue vient de la requete (cookie de preference, puis `Accept-Language`)
 * et non du segment `[locale]` : `next/root-params` est interdit dans un Route
 * Handler. Sans quoi la cloche, rafraichie toutes les dix secondes, remplacerait
 * ses lignes anglaises par des lignes francaises au premier sondage.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  const [access, dict] = await Promise.all([
    getAdminAccess(admin.userId),
    getRequestAdminDict(),
  ]);
  const { tasks, badges } = await fetchAdminQueue(access.permissions, dict);

  return NextResponse.json({ tasks, badges }, { headers: { "cache-control": "no-store" } });
}
