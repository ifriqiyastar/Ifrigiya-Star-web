import type { Metadata } from "next";
import Link from "next/link";

import {
  LegalList,
  LegalRows,
  LegalSection,
  LegalShell,
  LegalSteps,
  LegalTodo,
} from "@/components/site/legal";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { LOCALES, localePath, ogImagePath } from "@/lib/i18n/config";

/**
 * `/suppression-compte` — l'URL que Google Play exige dans la fiche Store,
 * a cote du bouton de l'application (Play Console, « Securite des donnees »).
 *
 * ⚠️ Le bouton dans l'app ne suffit PAS : Google demande une page accessible
 * SANS installer l'application, et la soumet a trois exigences explicites —
 * nommer l'appli ou l'editeur de la fiche, afficher distinctement la
 * procedure, et preciser les donnees effacees, celles conservees et toute
 * duree de conservation supplementaire. Les trois sections correspondantes
 * sont ci-dessous ; ne pas en retirer une sans relire cette regle.
 *
 * ⚠️ TOUT CE QUI EST AFFIRME ICI VIENT DE LA MIGRATION MOBILE `0102`
 * (`~/ifriqiyastar/0102_account_deletion.sql`) ET DE L'ECRAN QUI L'APPELLE
 * (`~/ifriqiyastar/src/app/delete-account.tsx`) : les trente jours sont
 * `profiles.deletion_due_at`, la liste des effacements est le corps de
 * `purge_account()`, et les trois elements conserves sont ceux que la purge
 * laisse volontairement debout (Scout Days organises, evaluations redigees,
 * signalements en cours). Une page de suppression qui promet plus que ce que
 * la base fait est une declaration fausse, pas une imprecision : toute
 * retouche ici se verifie d'abord dans `0102`.
 */

/**
 * La meme adresse que le pied de page et `/contact` — ecrite en toutes
 * lettres comme la-bas plutot qu'extraite dans une constante partagee, pour
 * ne pas inventer une abstraction sur la troisieme occurrence.
 */
const CONTACT_EMAIL = "ifriqiya.star@gmail.com";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary();
  const { metaTitle: title, metaDescription: description } = dict.deletionPage;
  const images = [ogImagePath(locale)];
  return {
    title,
    description,
    alternates: {
      canonical: localePath(locale, "/suppression-compte"),
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, localePath(l, "/suppression-compte")]),
      ),
    },
    // Meme raison que sur `/confidentialite` : la fusion de metadonnees est
    // superficielle, `siteName`/`type` doivent etre repetes ici.
    openGraph: { title, description, siteName: "Ifriqiya Soccer Star", type: "website", images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function AccountDeletionPage() {
  const dict = await getDictionary();
  const t = dict.deletionPage;
  const locale = await getLocale();
  const prefix = locale === "fr" ? "" : `/${locale}`;

  return (
    <LegalShell
      prefix={prefix}
      back={t.back}
      pill={t.pill}
      title={t.title}
      titleAccent={t.titleAccent}
      updated={t.updated}
      lead={t.lead}
    >
      <LegalSection title={t.appTitle}>
        <p>{t.appIntro}</p>
        <LegalSteps items={t.appSteps} />
        <p>{t.appAfter}</p>
      </LegalSection>

      <LegalSection title={t.mailTitle}>
        <p>{t.mailBody1}</p>
        <p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t.pill)}`}
            className="font-semibold break-all text-(--site-accent) hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
        <p>{t.mailBody2}</p>
      </LegalSection>

      <LegalSection title={t.graceTitle}>
        <p>{t.graceBody1}</p>
        <p>{t.graceBody2}</p>
      </LegalSection>

      <LegalSection title={t.erasedTitle}>
        <p>{t.erasedIntro}</p>
        <LegalList items={t.erasedItems} />
      </LegalSection>

      <LegalSection title={t.keptTitle}>
        <p>{t.keptIntro}</p>
        <LegalRows rows={t.keptRows} />
        <p>{t.keptNote}</p>
      </LegalSection>

      <LegalSection title={t.partialTitle}>
        <p>{t.partialIntro}</p>
        <LegalList items={t.partialItems} />
        <p>{t.partialNote}</p>
      </LegalSection>

      <LegalSection title={t.retentionTitle}>
        <p>{t.retentionBody}</p>
        <LegalTodo label={t.todoLabel}>{t.retentionTodo}</LegalTodo>
      </LegalSection>

      <LegalSection title={t.contactTitle}>
        <p>{t.contactBody}</p>
        <p className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-semibold break-all text-(--site-accent) hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          <Link
            href={`${prefix}/confidentialite`}
            className="font-semibold text-(--site-accent) hover:underline"
          >
            {t.contactLink}
          </Link>
        </p>
      </LegalSection>
    </LegalShell>
  );
}
