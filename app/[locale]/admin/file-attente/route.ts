import { NextResponse } from "next/server";

import { getAdminAccess, requireAdmin } from "@/lib/auth";
import { fetchAdminQueue } from "@/lib/queries/admin-queue";

/**
 * Les files d'attente de l'administration en JSON, pour la cloche du bandeau
 * et les pastilles du rail (`AdminQueueProvider`).
 *
 * Meme lecture et meme filtrage par permissions que le layout : les deux ne
 * peuvent donc pas annoncer deux chiffres differents. `requireAdmin()` est
 * refait ici, comme dans chaque Server Action — une route est joignable par un
 * GET direct.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  const access = await getAdminAccess(admin.userId);
  const { tasks, badges } = await fetchAdminQueue(access.permissions);

  return NextResponse.json({ tasks, badges }, { headers: { "cache-control": "no-store" } });
}
