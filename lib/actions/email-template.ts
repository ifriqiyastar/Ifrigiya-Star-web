"use server";

import { revalidatePath } from "next/cache";

import { EMAIL_COPY, NAME_TOKEN, isHexColor } from "@/emails/copy";
import { normalizeBlocks, type EmailBlock } from "@/lib/email/blocks";
import { makeErrors, fail, ok, type ActionResult } from "@/lib/actions/result";
import { isSuperAdmin, logAdminAction, requirePermission } from "@/lib/auth";
import { getRequestAdminI18n } from "@/lib/i18n/admin";
import { isLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

const text = (formData: FormData, name: string) => {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
};

/**
 * ⚠️ La garde de super administrateur est **doublee cote base** : les deux
 * tables portent `is_super_admin()` dans leur policy d'ecriture. Celle-ci
 * refuse plus tot et avec une phrase lisible, mais ce n'est pas elle qui
 * protege — un POST direct sur un Server Action contourne l'interface, pas
 * Postgres.
 */
async function guard() {
  await requirePermission("notifications.manage");
  return isSuperAdmin();
}

/** Cree un modele, vide : il part des textes livres et se personnalise ensuite. */
export async function createEmailTemplate(formData: FormData): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();
  if (!(await guard())) {
    return fail(i18n.t("Seul un super administrateur peut modifier le modele d'e-mail."));
  }

  const name = text(formData, "name");
  if (!name) return fail(i18n.t("Donnez un nom a ce modele."));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_email_templates")
    .insert({ name, description: text(formData, "description") })
    .select("id")
    .single();
  if (error) return fail(makeErrors(i18n.locale).describeError(error));

  await logAdminAction("create_email_template", "email_template", data.id, { name });
  revalidatePath("/[locale]/admin", "layout");
  return ok(i18n.t("Modele cree."));
}

/** Renomme un modele. Ses textes ne bougent pas. */
export async function renameEmailTemplate(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();
  if (!(await guard())) {
    return fail(i18n.t("Seul un super administrateur peut modifier le modele d'e-mail."));
  }

  const name = text(formData, "name");
  if (!name) return fail(i18n.t("Donnez un nom a ce modele."));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_email_templates")
    .update({ name, description: text(formData, "description") })
    .eq("id", id)
    .select("id");
  if (error) return fail(makeErrors(i18n.locale).describeError(error));
  if (!data?.length) return fail(i18n.t("Enregistrement refuse par la base de donnees."));

  await logAdminAction("rename_email_template", "email_template", id, { name });
  revalidatePath("/[locale]/admin", "layout");
  return ok(i18n.t("Modele renomme."));
}

/**
 * Copie un modele **et ses textes**.
 *
 * C'est le geste qui rend le catalogue utilisable : on part d'un habillage
 * qui marche pour en essayer une variante, sans risquer celui qui sert.
 */
export async function duplicateEmailTemplate(id: string): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();
  if (!(await guard())) {
    return fail(i18n.t("Seul un super administrateur peut modifier le modele d'e-mail."));
  }

  const supabase = await createClient();
  const { data: source } = await supabase
    .from("admin_email_templates")
    .select("name, description")
    .eq("id", id)
    .maybeSingle();
  if (!source) return fail(i18n.t("Modele introuvable."));

  const { data: created, error } = await supabase
    .from("admin_email_templates")
    // La copie n'est jamais le defaut : deux defauts sont refuses par la base,
    // et surtout dupliquer n'est pas basculer.
    .insert({ name: `${source.name} (copie)`, description: source.description })
    .select("id")
    .single();
  if (error) return fail(makeErrors(i18n.locale).describeError(error));

  const { data: texts } = await supabase
    .from("admin_email_template")
    .select("*")
    .eq("template_id", id);
  const rows = (texts ?? []).map((row) => {
    // L'horodatage et l'auteur appartiennent a la copie, pas a l'original :
    // le trigger les reposera.
    const { updated_at: _at, updated_by: _by, ...rest } = row as Record<string, unknown>;
    void _at;
    void _by;
    return { ...rest, template_id: created.id };
  });
  if (rows.length) {
    const { error: copyError } = await supabase.from("admin_email_template").insert(rows);
    // Le modele existe deja : on le signale plutot que de laisser croire a un
    // echec total, sinon l'utilisateur recommence et en cree un troisieme.
    if (copyError) {
      return fail(i18n.t("Modele copie, mais ses textes n'ont pas suivi : {0}", {
        "0": makeErrors(i18n.locale).describeError(copyError),
      }));
    }
  }

  await logAdminAction("duplicate_email_template", "email_template", created.id, { from: id });
  revalidatePath("/[locale]/admin", "layout");
  return ok(i18n.t("Modele duplique."));
}

/**
 * Designe le modele par defaut.
 *
 * ⚠️ En deux temps, et l'ordre compte : l'index unique partiel de la base
 * refuse deux defauts, donc l'ancien est retire **avant** que le nouveau ne
 * soit pose. L'inverse echouerait systematiquement.
 */
export async function setDefaultEmailTemplate(id: string): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();
  if (!(await guard())) {
    return fail(i18n.t("Seul un super administrateur peut modifier le modele d'e-mail."));
  }

  const supabase = await createClient();
  // ⚠️ SANS `.select("id")`, ET C'EST VOULU — la seule exception du depot. Cet
  // `update` retire le drapeau aux AUTRES modeles : zero ligne touchee est le
  // cas normal quand aucun autre modele ne le portait. C'est l'ecriture
  // suivante, celle qui pose le drapeau, qui doit etre controlee — elle l'est.
  const { error: clearError } = await supabase
    .from("admin_email_templates")
    .update({ is_default: false })
    .eq("is_default", true)
    .neq("id", id);
  if (clearError) return fail(makeErrors(i18n.locale).describeError(clearError));

  const { data, error } = await supabase
    .from("admin_email_templates")
    .update({ is_default: true })
    .eq("id", id)
    .select("id");
  if (error) return fail(makeErrors(i18n.locale).describeError(error));
  if (!data?.length) return fail(i18n.t("Enregistrement refuse par la base de donnees."));

  await logAdminAction("default_email_template", "email_template", id, {});
  revalidatePath("/[locale]/admin", "layout");
  return ok(i18n.t("Modele par defaut mis a jour."));
}

/** Supprime un modele et ses textes. Le dernier est refuse par la base. */
export async function deleteEmailTemplate(id: string): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();
  if (!(await guard())) {
    return fail(i18n.t("Seul un super administrateur peut modifier le modele d'e-mail."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_email_templates")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return fail(makeErrors(i18n.locale).describeError(error));
  if (!data?.length) return fail(i18n.t("Enregistrement refuse par la base de donnees."));

  await logAdminAction("delete_email_template", "email_template", id, {});
  revalidatePath("/[locale]/admin", "layout");
  return ok(i18n.t("Modele supprime."));
}

/**
 * Vrai quand la mise en page du modele porte son propre bloc d'accueil : les
 * deux champs d'accueil de l'habillage ne sont alors pas rendus du tout
 * (`hasBlockGreeting` dans `emails/campaign-email.tsx`).
 *
 * ⚠️ **Degrade ferme, a l'inverse du reste du depot** : si la lecture echoue
 * ou si le modele n'a pas de ligne, on repond « pas de bloc » et la regle
 * s'applique. Une lecture ratee n'a pas a ouvrir une validation — ici,
 * degrader a l'ouverture laisserait passer l'accueil muet que la regle est
 * faite pour attraper.
 */
async function layoutCarriesGreeting(templateId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_email_templates")
    .select("blocks")
    .eq("id", templateId)
    .maybeSingle();
  if (error || !data) return false;
  // La meme liste blanche que partout : ce qui est lu en base n'est pas plus
  // sur que ce qui arrive du navigateur.
  return normalizeBlocks(data.blocks).some((block) => block.type === "greeting");
}

/**
 * Enregistre les textes d'un modele, pour une langue.
 *
 * ⚠️ **Rien n'est interprete comme du HTML.** Les valeurs partent en texte et
 * sont echappees au rendu ; c'est pour cela que l'ecran offre des champs
 * nommes plutot qu'un editeur libre. Ne pas « ameliorer » cela en acceptant
 * du balisage : le courriel part chez des milliers de personnes, et une
 * balise mal fermee casse la mise en page chez Outlook.
 */
export async function saveEmailTemplate(
  templateId: string,
  formData: FormData,
): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();
  if (!(await guard())) {
    return fail(i18n.t("Seul un super administrateur peut modifier le modele d'e-mail."));
  }

  const locale = String(formData.get("locale") ?? "");
  if (!isLocale(locale)) return fail(i18n.t("Langue inconnue."));

  const greetingNamed = text(formData, "greeting_named");
  const greetingPlain = text(formData, "greeting_plain");
  // Decoche : aucune ligne d'accueil ne sort. Les deux textes restent en
  // base — recocher les retrouve — donc rien n'est perdu a l'essai.
  const showGreeting = formData.get("show_greeting") === "on";
  // ⚠️⚠️ **La regle visait la faute silencieuse, elle attrapait aussi un choix
  // deliberé.** Un accueil « avec nom » sans le jeton ne montrera jamais de
  // nom : si l'accueil sans nom dit autre chose, c'est un oubli, et le refus
  // tient. Mais quand les deux lignes disent **mot pour mot la meme chose**,
  // rien n'est perdu en silence — l'administrateur a ecrit « pas de nom, nulle
  // part », ce qui est le cas d'un modele adresse a des gens qui n'ont pas de
  // compte, donc pas de nom. Le modele des beta testeurs est seme ainsi
  // (`202611020002`), et la regle rendait ce modele entierement
  // inenregistrable : changer une couleur ou l'adresse de reponse etait refuse
  // au nom d'un accueil que personne ne lira jamais.
  // Sans accueil affiche, il n'y a plus de faute silencieuse a attraper :
  // la regle ne s'applique qu'a un texte que quelqu'un va lire.
  if (showGreeting && greetingNamed && !greetingNamed.includes(NAME_TOKEN)) {
    // Un champ vide reprend le texte livre : c'est lui qu'il faut comparer,
    // pas la chaine vide.
    const plain = greetingPlain || EMAIL_COPY[locale].greetingPlain;
    const sameAsPlain = greetingNamed.trim() === plain.trim();
    // Second echappement : la mise en page peut porter son propre bloc
    // d'accueil, auquel cas ces deux champs ne partent pas du tout et l'ecran
    // le dit deja. L'aller-retour n'est paye que dans la branche qui refuse.
    if (!sameAsPlain && !(await layoutCarriesGreeting(templateId))) {
      return fail(
        i18n.t(
          "L'accueil personnalise doit contenir {0}, ou reprendre mot pour mot l'accueil sans nom.",
          { "0": NAME_TOKEN },
        ),
      );
    }
  }

  const ctaUrl = text(formData, "cta_url");
  if (ctaUrl && !/^https?:\/\/\S+$/i.test(ctaUrl)) {
    return fail(i18n.t("L'adresse du bouton doit commencer par http:// ou https://."));
  }

  const replyTo = text(formData, "reply_to");
  if (replyTo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(replyTo)) {
    return fail(i18n.t("L'adresse de reponse n'est pas une adresse valide."));
  }

  // ⚠️ Une couleur part dans un attribut `style` de courriel : seule la
  // forme `#rrggbb` est acceptee. Postgres pose la meme contrainte — celle-ci
  // refuse plus tot, avec une phrase qui nomme le champ.
  const colors: Record<string, string | null> = {};
  for (const field of [
    "color_header_bg",
    "color_body_bg",
    "color_text",
    "color_button_bg",
    "color_button_text",
  ]) {
    const value = text(formData, field);
    if (value && !isHexColor(value)) {
      return fail(i18n.t("Couleur invalide : {0}. Attendu : #rrggbb.", { "0": value }));
    }
    colors[field] = value ? value.toLowerCase() : null;
  }

  const supabase = await createClient();
  const fields = {
    template_id: templateId,
    locale,
    sender_name: text(formData, "sender_name"),
    reply_to: replyTo,
    greeting_named: greetingNamed,
    greeting_plain: greetingPlain,
    show_cta: formData.get("show_cta") === "on",
    cta_label: text(formData, "cta_label"),
    cta_url: ctaUrl,
    signature: text(formData, "signature"),
    footer_why: text(formData, "footer_why"),
    unsubscribe_label: text(formData, "unsubscribe_label"),
    unsubscribe_hint: text(formData, "unsubscribe_hint"),
    rights: text(formData, "rights"),
    ...colors,
  };

  // ⚠️ `.select()` apres l'ecriture, toujours : PostgREST ne signale pas une
  // ligne filtree par la RLS — l'upsert toucherait zero ligne et repondrait
  // « enregistre » sans rien avoir change.
  const write = (payload: Record<string, unknown>) =>
    supabase
      .from("admin_email_template")
      .upsert(payload, { onConflict: "template_id,locale" })
      .select("locale");

  let { data, error } = await write({ ...fields, show_greeting: showGreeting });
  // ⚠️ Degrade a l'ouverture, comme partout ici : sur un projet ou
  // `202611030001` n'est pas passe, la colonne n'existe pas (`42703`) et tout
  // le reste de la page serait refuse avec elle. On reecrit sans elle et on
  // le dit — plutot que de laisser croire que l'accueil a ete retire.
  const missingColumn = error?.code === "42703" && /show_greeting/.test(error.message);
  if (missingColumn) ({ data, error } = await write(fields));

  if (error) return fail(makeErrors(i18n.locale).describeError(error));
  if (!data?.length) return fail(i18n.t("Enregistrement refuse par la base de donnees."));

  await logAdminAction("update_email_template", "email_template", templateId, { locale });
  revalidatePath("/[locale]/admin", "layout");
  return ok(
    missingColumn
      ? i18n.t("Modele enregistre, sauf le choix d'afficher ou non la formule d'accueil : la base de donnees n'a pas encore ete mise a jour.")
      : i18n.t("Modele d'e-mail enregistre."),
  );
}

/** Rend a une langue d'un modele les textes livres avec l'application. */
export async function resetEmailTemplate(
  templateId: string,
  locale: string,
): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();
  if (!(await guard())) {
    return fail(i18n.t("Seul un super administrateur peut modifier le modele d'e-mail."));
  }
  if (!isLocale(locale)) return fail(i18n.t("Langue inconnue."));

  const supabase = await createClient();
  // Supprimer la ligne plutot que la vider : l'absence **est** le defaut, et
  // une ligne de chaines vides demanderait de savoir les distinguer.
  const { data, error } = await supabase
    .from("admin_email_template")
    .delete()
    .eq("template_id", templateId)
    .eq("locale", locale)
    .select("locale");
  if (error) return fail(makeErrors(i18n.locale).describeError(error));

  await logAdminAction("reset_email_template", "email_template", templateId, { locale });
  revalidatePath("/[locale]/admin", "layout");
  return data?.length
    ? ok(i18n.t("Textes d'origine retablis."))
    : ok(i18n.t("Cette langue utilisait deja les textes d'origine."));
}

/**
 * Enregistre la mise en page d'un modele.
 *
 * ⚠️ **`normalizeBlocks()` est applique cote serveur, toujours.** Ce que le
 * navigateur envoie est du JSON libre : la liste est reconstruite bloc par
 * bloc contre la liste blanche — un type inconnu, une cle en trop ou une
 * adresse qui n'est pas http/https/mailto n'y survivent pas. Le compositeur
 * est une commodite de saisie, pas une garantie.
 *
 * La mise en page est **commune aux trois langues** : elle vit sur le modele,
 * pas sur ses lignes de texte. On compose une fois, on traduit trois fois.
 */
export async function saveEmailBlocks(
  templateId: string,
  blocks: EmailBlock[],
): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();
  if (!(await guard())) {
    return fail(i18n.t("Seul un super administrateur peut modifier le modele d'e-mail."));
  }

  const clean = normalizeBlocks(blocks);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_email_templates")
    .update({ blocks: clean })
    .eq("id", templateId)
    .select("id");
  if (error) return fail(makeErrors(i18n.locale).describeError(error));
  if (!data?.length) return fail(i18n.t("Enregistrement refuse par la base de donnees."));

  await logAdminAction("update_email_blocks", "email_template", templateId, {
    blocks: clean.length,
  });
  revalidatePath("/[locale]/admin", "layout");
  return ok(i18n.t("Mise en page enregistree."));
}
