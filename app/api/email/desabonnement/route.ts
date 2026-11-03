import type { NextRequest } from "next/server";

import { EMAIL_COPY, emailLocale } from "@/emails/copy";
import {
  normalizeEmail,
  verifyEmailUnsubscribeToken,
  verifyUnsubscribeToken,
} from "@/lib/email/campaign";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Desabonnement des campagnes email, depuis le lien du courriel.
 *
 * ⚠️ **Route publique, et elle doit l'etre** : elle est appelee depuis une
 * boite mail, ou il n'y a aucune session Supabase. Ce qui autorise l'ecriture
 * n'est donc pas une session mais la **signature** du lien
 * (`verifyUnsubscribeToken`) : sans elle, `?c=<identifiant>` permettrait de
 * desabonner n'importe qui.
 *
 * ⚠️ **Deux verbes, et le POST n'est pas decoratif.** La RFC 8058 (« one-click »)
 * veut que Gmail et Yahoo puissent desabonner **sans ouvrir de page**, par un
 * POST declenche depuis leur propre interface — c'est l'en-tete
 * `List-Unsubscribe-Post`. Le GET sert au clic humain sur le lien du pied de
 * page et rend une confirmation lisible.
 *
 * ⚠️ **L'ecriture passe par `service_role`, et c'est le seul moyen.** La table
 * n'a qu'une policy de lecture (voir `202609300001`) : l'appelant n'est
 * personne, il n'a pas de `auth.uid()`, et aucune policy ne pourrait
 * l'identifier. Le geste est neanmoins borne a une seule ligne, dont
 * l'identifiant est signe.
 */

/**
 * Le desabonnement d'une **adresse saisie**, qui n'a pas de compte.
 *
 * ⚠️ Le jeton couvre un autre message que celui d'un compte
 * (`unsubscribe-email:` contre `unsubscribe:`) : un lien emis pour l'un ne
 * peut pas servir pour l'autre, meme si les deux valeurs se ressemblaient.
 *
 * ⚠️ La ligne est posee **sans `profile_id`**. Si l'adresse appartient par
 * ailleurs a un compte, elle le couvre quand meme : `admin_broadcast_recipients()`
 * ecarte sur `profile_id = ... or lower(email) = ...`. Un desabonnement suit
 * la boite mail, pas le compte qui la declarait.
 */
async function unsubscribeEmail(raw: string, token: string) {
  const email = normalizeEmail(raw);
  if (!email || !token || !verifyEmailUnsubscribeToken(email, token)) {
    return { ok: false as const, status: 403 };
  }

  const supabase = createServiceClient();
  if (!supabase) return { ok: false as const, status: 503 };

  const { error } = await supabase
    .from("admin_email_optouts")
    .upsert({ email, source: "lien_email" }, { onConflict: "email" });

  // ⚠️ La langue du destinataire est inconnue — il n'a pas de profil ou la
  // lire. Le francais est la langue par defaut du produit ; deviner d'apres
  // l'en-tete du navigateur donnerait celle de l'appareil, pas celle dans
  // laquelle le courriel a ete redige.
  return error
    ? { ok: false as const, status: 500, locale: "fr" }
    : { ok: true as const, status: 200, locale: "fr" };
}

async function unsubscribe(profileId: string, token: string) {
  if (!profileId || !token || !verifyUnsubscribeToken(profileId, token)) {
    return { ok: false as const, status: 403 };
  }

  const supabase = createServiceClient();
  if (!supabase) return { ok: false as const, status: 503 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, locale")
    .eq("id", profileId)
    .maybeSingle();
  // Un compte supprime n'a plus rien a desabonner. On repond quand meme
  // « c'est fait » : dire « ce compte n'existe pas » ferait de cette route un
  // moyen de tester l'existence d'un identifiant.
  if (!profile?.email) return { ok: true as const, locale: "fr", status: 200 };

  const { error } = await supabase
    .from("admin_email_optouts")
    // ⚠️ Le conflit se joue desormais sur l'**adresse**, pas sur le compte :
    // c'est elle qui porte l'unicite depuis `202611020001`, et c'est la bonne
    // cle — la meme boite mail ne doit pas se retrouver desabonnee deux fois
    // parce qu'elle a aussi recu un envoi a la main.
    .upsert(
      {
        profile_id: profile.id,
        email: normalizeEmail(profile.email),
        source: "lien_email",
      },
      { onConflict: "email" },
    );

  return error
    ? { ok: false as const, status: 500, locale: profile.locale as string | null }
    : { ok: true as const, status: 200, locale: profile.locale as string | null };
}

/** `?c=` designe un compte, `?e=` une adresse saisie. Jamais les deux. */
function resolve(params: URLSearchParams) {
  const token = params.get("t") ?? "";
  const email = params.get("e");
  return email ? unsubscribeEmail(email, token) : unsubscribe(params.get("c") ?? "", token);
}

export async function POST(request: NextRequest) {
  const result = await resolve(request.nextUrl.searchParams);
  // Le client de messagerie n'affiche rien : il attend un code, pas une page.
  return new Response(null, { status: result.ok ? 200 : result.status });
}

export async function GET(request: NextRequest) {
  const result = await resolve(request.nextUrl.searchParams);
  const locale = emailLocale("locale" in result ? result.locale : "fr");
  const copy = EMAIL_COPY[locale];

  const message = result.ok
    ? {
        fr: ["C'est fait.", "Vous ne recevrez plus les annonces par e-mail."],
        en: ["Done.", "You will no longer receive announcement emails."],
        ar: ["تم.", "لن تصلك بعد الآن رسائل الإعلانات."],
      }[locale]
    : {
        fr: ["Lien invalide.", "Ce lien de desabonnement n'est plus valide."],
        en: ["Invalid link.", "This unsubscribe link is no longer valid."],
        ar: ["رابط غير صالح.", "لم يعد رابط إلغاء الاشتراك هذا صالحا."],
      }[locale];

  const escape = (value: string) =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  // Page autonome, sans le layout du site : la route vit sous `/api`, et un
  // desabonnement n'a pas besoin de la navigation ni des polices du site.
  const page = `<!doctype html>
<html lang="${locale}" dir="${copy.dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${escape(message[0])}</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#000;color:#fff;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  main{max-width:34rem;padding:2rem;text-align:center}
  h1{font-size:1.5rem;margin:0 0 .5rem}
  p{margin:0 0 1.5rem;color:#ccc}
  a{color:#aff70f}
</style></head>
<body><main>
  <h1>${escape(message[0])}</h1>
  <p>${escape(message[1])}</p>
  ${result.ok ? `<p style="font-size:.875rem">${escape(copy.unsubscribeHint)}</p>` : ""}
  <a href="/${locale === "fr" ? "" : locale}">${escape(copy.rights)}</a>
</main></body></html>`;

  return new Response(page, {
    status: result.ok ? 200 : result.status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
