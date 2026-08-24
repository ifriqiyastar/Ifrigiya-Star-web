import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Ouverture d'une piece justificative stockee dans un bucket **prive**.
 *
 * Les buckets `identity-documents` et `professional-documents` n'ont pas de
 * lecture publique : seules les policies `*_admin_read` de `storage.objects`
 * autorisent l'administration. On ne peut donc pas construire une URL
 * publique — il faut une URL signee, generee ici avec la session admin, puis
 * une redirection.
 *
 * La liste blanche de buckets est volontaire : ce handler ne doit pas pouvoir
 * servir a lire un chemin arbitraire d'un autre bucket.
 */
const ALLOWED_BUCKETS = new Set(["identity-documents", "professional-documents", "guardian-documents"]);

const EXPIRY_SECONDS = 60 * 5;

export async function GET(request: NextRequest) {
  await requireAdmin();

  const bucket = request.nextUrl.searchParams.get("bucket");
  const path = request.nextUrl.searchParams.get("path");

  if (!bucket || !path) {
    return NextResponse.json({ error: "Parametres bucket et path requis." }, { status: 400 });
  }
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Bucket non autorise." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, EXPIRY_SECONDS);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      {
        error:
          error?.message ??
          "Document introuvable dans le stockage. Le chemin enregistre en base ne correspond peut-etre a aucun fichier.",
      },
      { status: 404 },
    );
  }

  return NextResponse.redirect(data.signedUrl);
}
