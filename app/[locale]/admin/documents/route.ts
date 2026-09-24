import { getRequestAdminI18n } from "@/lib/i18n/admin";
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
// Les buckets prives du projet. `player-photos` et `player-cv` en font partie
// — verifie contre `storage.buckets` — alors qu'ils etaient traites comme
// publics ailleurs dans le code.
const ALLOWED_BUCKETS = new Set([
  "identity-documents",
  "professional-documents",
  "guardian-documents",
  "player-photos",
  "player-cv",
  // ⚠️ Ajoutes le 2026-09-24 : ces trois-la etaient traites comme **publics**
  // partout dans le back-office alors que la migration mobile 0051 les a
  // rendus prives. Sonde du jour sur le projet live : `/object/public/...`
  // rend NoSuchBucket, `/object/sign/...` rend une erreur Postgres — donc ils
  // existent et sont prives. Consequence directe : ni la photo d'un joueur,
  // ni celle d'un professionnel, ni le media d'une publication ne
  // s'affichaient. `blog-media` reste absent de cette liste : il est
  // reellement public et n'a rien a signer.
  "avatars",
  "post-media",
  "player-videos",
]);

const EXPIRY_SECONDS = 60 * 5;

export async function GET(request: NextRequest) {
  const i18n = await getRequestAdminI18n();

  await requireAdmin();

  const bucket = request.nextUrl.searchParams.get("bucket");
  const path = request.nextUrl.searchParams.get("path");

  if (!bucket || !path) {
    return NextResponse.json({ error: i18n.t("Parametres bucket et path requis.") }, { status: 400 });
  }
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: i18n.t("Bucket non autorise.") }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, EXPIRY_SECONDS);

  if (error || !data?.signedUrl) {
    // Deux causes tres differentes, et le message brut ne les distingue pas :
    // le **bucket** peut ne pas exister du tout — l'`insert into
    // storage.buckets` de la migration 0012 n'a jamais pris sur ce projet, la
    // table appartenant a `supabase_storage_admin` et le `on conflict do
    // nothing` ayant masque l'echec — ou le bucket existe et c'est le
    // **chemin** qui ne pointe sur rien. On nomme la premiere, qui se corrige
    // en une minute depuis le dashboard.
    const bucketMissing = /bucket.*not found|does not exist/i.test(error?.message ?? "");
    return NextResponse.json(
      {
        error: bucketMissing
          ? i18n.t("Le bucket « {0} » n'existe pas sur ce projet Supabase. Creez-le depuis Storage → New bucket, en le laissant **prive**, puis reessayez. (Verification : select id, public from storage.buckets;)", { "0": bucket })
          : (error?.message ??
            i18n.t("Document introuvable dans le stockage. Le chemin enregistre en base ne correspond peut-etre a aucun fichier.")),
      },
      { status: 404 },
    );
  }

  return NextResponse.redirect(data.signedUrl);
}
