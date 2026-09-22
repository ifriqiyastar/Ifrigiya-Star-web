"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "react-qr-code";
import { ArrowUpRightIcon, MenuIcon, XIcon } from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n/client";
import { useDeviceOs } from "@/lib/use-device-os";
import { QR_REDIRECT_PARAM } from "@/lib/store-urls";

/**
 * L'entete du site public et son tiroir de navigation.
 *
 * C'est le **seul composant client** de la page : tout le reste est rendu par
 * le serveur. Il l'est parce qu'un tiroir a besoin d'un etat, et que les deux
 * solutions sans JavaScript sont moins bonnes ici — un `<details>` reste
 * ouvert apres un clic sur une ancre, et une case a cocher masquee ment aux
 * technologies d'assistance.
 *
 * ⚠️ DEUX PIEGES DE POSITIONNEMENT, et le premier n'est pas evident.
 *
 * 1. Le tiroir est un **frere** de `<header>`, pas son enfant. L'entete porte
 *    `backdrop-blur`, donc un `backdrop-filter`, et un `backdrop-filter` cree
 *    un bloc conteneur pour les descendants en `position: fixed` : un tiroir
 *    place a l'interieur se serait positionne par rapport a l'entete de 64 px
 *    de haut, pas par rapport a la fenetre.
 *
 * 2. Les deux elements restent **dans** `.site-shell`, et non portes dans
 *    `document.body` comme le ferait un `Dialog` : les variables
 *    `--site-*` sont declarees sur `.site-shell`, elles ne se resolvent pas
 *    en dehors. C'est aussi pourquoi ce tiroir n'utilise pas le `Sheet` de
 *    `components/ui`, qui, lui, est porte.
 *
 * Le panneau reste monte pour pouvoir glisser ; `inert` le retire du parcours
 * clavier et de l'arbre d'accessibilite tant qu'il est ferme.
 *
 * La popup de QR code (telechargement depuis un ordinateur) est batie sur le
 * meme modele que le tiroir — voile + panneau, freres de `<header>`, jamais
 * portes — et pour la meme raison : `components/ui/dialog.tsx` porte dans
 * `document.body` et son bouton de fermeture lit `useAdminTranslations()`,
 * le dictionnaire de l'admin, pas celui du site.
 */
/**
 * Les ancres restent en francais dans l'URL (`#academie`, `#fonctionnalites`)
 * quelle que soit la langue : ce sont des identifiants de sections, pas du
 * texte affiche. Les traduire casserait les liens deja partages et obligerait
 * a renommer les `id` de `app/[locale]/page.tsx` dans chaque langue.
 */
export function SiteNav() {
  const { dict, locale } = useI18n();
  const nav = dict.nav;
  // Le prefixe de langue : `/` en francais, `/en` et `/ar` sinon. Les liens
  // internes de l'entete doivent le porter, sinon un clic depuis `/ar`
  // renverrait le visiteur en francais.
  const prefix = locale === "fr" ? "" : `/${locale}`;

  const [open, setOpen] = React.useState(false);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const burgerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);

    // Le fond ne defile plus derriere le tiroir, et le focus entre dedans.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    // Capture pendant l'effet : au nettoyage, `burgerRef.current` peut deja
    // pointer ailleurs, et le focus atterrirait sur le mauvais element.
    const burger = burgerRef.current;

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      // Le focus revient d'ou il venait, et non en haut du document.
      burger?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);

  // Sur telephone (iOS/Android detecte), le bouton reste un lien direct vers
  // la section : le visiteur peut deja installer depuis cet appareil. Sur un
  // ordinateur — ou tant que le systeme n'est pas encore connu, cote serveur
  // — un clic ouvre plutot la popup de QR code ci-dessous.
  const os = useDeviceOs();
  const [qrOpen, setQrOpen] = React.useState(false);
  const [qrUrl, setQrUrl] = React.useState("");
  const qrCloseRef = React.useRef<HTMLButtonElement>(null);
  const qrTriggerRef = React.useRef<HTMLButtonElement>(null);

  const openQr = () => {
    // Le lien de la page elle-meme : une fois les fiches App Store / Google
    // Play publiees, `StoreButtons` n'affichera plus qu'un seul bouton actif
    // sur le telephone qui a scanne — ce QR n'aura jamais besoin d'etre
    // regenere. Le parametre `?qr=1` (avant le `#`) est ce que
    // `QrStoreRedirect` lit pour distinguer ce flux d'un visiteur qui
    // atteint la meme section en faisant simplement defiler la page.
    setQrUrl(`${window.location.origin}${prefix}/?${QR_REDIRECT_PARAM}=1#telecharger`);
    setQrOpen(true);
  };
  const closeQr = () => setQrOpen(false);

  React.useEffect(() => {
    if (!qrOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQrOpen(false);
    };
    document.addEventListener("keydown", onKey);

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    qrCloseRef.current?.focus();

    const trigger = qrTriggerRef.current;

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, [qrOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--site-line)] bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-5 sm:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" onClick={close}>
            <Image src="/brand/ifriqiya-star.svg" alt="Ifriqiya Soccer Star" width={34} height={34} priority />
            <span className="font-heading text-[0.9375rem] font-extrabold tracking-tight sm:text-base">
              Ifriqiya Soccer Star
            </span>
          </Link>

          <div className="ms-auto flex items-center gap-4">
            {/* Le selecteur de langue, en haut de page comme demande. Il est
                visible des le mobile — c'est le premier reglage qu'un
                visiteur arabophone cherche, et l'enfouir dans le tiroir le
                rendrait introuvable. */}
            <LanguageSwitcher />
            {os === "ios" || os === "android" ? (
              <Link
                href={`${prefix}/#telecharger`}
                className="hidden rounded-full border border-[var(--site-accent)] bg-[var(--site-accent)] px-5 py-2 text-sm font-semibold whitespace-nowrap text-[var(--site-ink)] transition-colors hover:bg-transparent hover:text-[var(--site-accent)] sm:inline-flex"
              >
                {nav.download}
              </Link>
            ) : (
              <button
                ref={qrTriggerRef}
                type="button"
                onClick={openQr}
                className="hidden rounded-full border border-[var(--site-accent)] bg-[var(--site-accent)] px-5 py-2 text-sm font-semibold whitespace-nowrap text-[var(--site-ink)] transition-colors hover:bg-transparent hover:text-[var(--site-accent)] sm:inline-flex"
              >
                {nav.download}
              </button>
            )}
            <Link
              href={`${prefix}/contact`}
              className="hidden rounded-full border border-[var(--site-line-strong)] px-5 py-2 text-sm whitespace-nowrap text-[var(--site-muted)] transition-colors hover:border-[var(--site-accent)] hover:text-[var(--site-fg)] lg:inline-flex"
            >
              {nav.contact}
            </Link>

            <button
              ref={burgerRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="tiroir-navigation"
              aria-label={nav.openMenu}
              className="flex size-10 items-center justify-center rounded-full border border-[var(--site-line-strong)] text-[var(--site-fg)] transition-colors hover:border-[var(--site-accent)] hover:text-[var(--site-accent)] lg:hidden"
            >
              <MenuIcon className="size-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Voile. Il s'efface plutot que de disparaitre d'un coup, au meme
          rythme que le tiroir, sinon le fond revient avant le panneau. */}
      <div
        onClick={close}
        aria-hidden
        className={`fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="tiroir-navigation"
        aria-label={nav.drawerLabel}
        inert={!open}
        // `end-0` et `border-s` : en arabe le tiroir s'ouvre a gauche, et sa
        // bordure reste du cote du contenu. La translation de fermeture doit
        // suivre le meme axe, d'ou la variante `rtl:`.
        className={`fixed top-0 end-0 z-[70] flex h-dvh w-[86%] max-w-sm flex-col border-s border-[var(--site-line-strong)] bg-[var(--site-bg)] shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          open ? "translate-x-0" : "translate-x-full rtl:-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--site-line)] px-5">
          <span className="flex items-center gap-2.5">
            <Image src="/brand/ifriqiya-star.svg" alt="" width={30} height={30} />
            <span className="font-heading text-[0.9375rem] font-extrabold">Ifriqiya Soccer Star</span>
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label={nav.closeMenu}
            className="flex size-10 items-center justify-center rounded-full border border-[var(--site-line-strong)] text-[var(--site-fg)] transition-colors hover:border-[var(--site-accent)] hover:text-[var(--site-accent)]"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="flex-1" />

        <div className="shrink-0 space-y-3 border-t border-[var(--site-line)] px-4 py-5">
          <Link
            href={`${prefix}/#telecharger`}
            onClick={close}
            className="block rounded-full bg-[var(--site-accent)] px-5 py-3.5 text-center text-sm font-semibold text-[var(--site-ink)]"
          >
            {nav.download}
          </Link>
          <Link
            href={`${prefix}/contact`}
            onClick={close}
            className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium text-[var(--site-fg)] transition-colors hover:bg-white/5 hover:text-[var(--site-accent)]"
          >
            {nav.contact}
            <ArrowUpRightIcon className="size-4 text-[var(--site-muted)] rtl:-scale-x-100" />
          </Link>
          <p className="pt-1 text-center text-xs text-[var(--site-muted)]">{nav.slogan}</p>
        </div>
      </aside>

      {/* Popup de QR code. Meme construction que le tiroir juste au-dessus —
          voile + panneau freres de `<header>` — et pour la meme raison :
          voir le commentaire de tete de fichier. */}
      <div
        onClick={closeQr}
        aria-hidden
        className={`fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          qrOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={nav.qr.title}
        inert={!qrOpen}
        className={`fixed inset-0 z-[90] flex items-center justify-center p-5 transition-opacity duration-300 ${
          qrOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="w-full max-w-xs rounded-3xl border border-[var(--site-line-strong)] bg-[var(--site-bg)] p-6 text-center shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-heading text-start text-lg font-extrabold text-[var(--site-fg)]">{nav.qr.title}</h2>
            <button
              ref={qrCloseRef}
              type="button"
              onClick={closeQr}
              aria-label={nav.qr.close}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--site-line-strong)] text-[var(--site-fg)] transition-colors hover:border-[var(--site-accent)] hover:text-[var(--site-accent)]"
            >
              <XIcon className="size-4" />
            </button>
          </div>
          <p className="mt-2 text-start text-sm text-[var(--site-muted)]">{nav.qr.description}</p>
          <div className="mt-5 flex items-center justify-center rounded-2xl bg-white p-4">
            {/* Genere seulement une fois l'origine connue (cote client) :
                un rendu serveur ne peut pas deviner le domaine du visiteur. */}
            {qrUrl ? <QRCode value={qrUrl} size={176} /> : <div className="size-[176px]" />}
          </div>
        </div>
      </div>
    </>
  );
}
