import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon, ShieldCheckIcon } from "lucide-react";

import { SignInForm } from "./sign-in-form";
import { getAdminDict, getAdminLocale } from "@/lib/i18n/admin";
import { localePath } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAdminDict();
  return { title: dict.signIn.metaTitle };
}

/**
 * L'ecran de connexion suit la langue du **back-office**, pas celle du site
 * public : c'est sa porte d'entree, il n'est atteignable que depuis la garde
 * `requireAdmin()` ou la deconnexion, et `isAdminPath()` le fait donc traiter
 * comme `/admin` par le proxy — francais ou anglais, jamais arabe.
 */
export default async function ConnexionPage({
  searchParams,
}: PageProps<"/[locale]/connexion">) {
  const { erreur } = await searchParams;
  const [locale, dict] = await Promise.all([getAdminLocale(), getAdminDict()]);
  const d = dict.signIn;

  // Les trois causes de renvoi vers cet ecran, dites du point de vue de
  // l'utilisateur : aucune ne nomme de table ni de colonne, contrairement a
  // la premiere version.
  const errors: Record<string, string> = {
    "acces-refuse": d.errorAccessDenied,
    "compte-introuvable": d.errorNoProfile,
    "compte-desactive": d.errorDeactivated,
  };
  const message = typeof erreur === "string" ? errors[erreur] : undefined;

  return (
    <main className="relative isolate flex min-h-dvh flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <Image
          src="/images/connexion-scout-day-ai.webp"
          alt=""
          fill
          sizes="100vw"
          preload
          className="object-cover object-[35%_center] lg:object-center"
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/15 to-black/40" />
        <div className="absolute inset-0 hidden bg-linear-to-r from-transparent via-transparent to-background/80 lg:block" />
      </div>

      <header className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-6 sm:px-10 lg:px-16 lg:py-9">
        <Link
          href={localePath(locale, "/")}
          className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Image src="/brand/ifriqiya-star.svg" alt="" width={44} height={44} />
          <span className="font-heading text-lg font-extrabold tracking-wide text-white">IFRIQIYA SOCCER STAR</span>
        </Link>
        <Link
          href={localePath(locale, "/")}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-white/80 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          {d.backToSite}
        </Link>
      </header>

      <div className="mx-auto grid w-full max-w-[1440px] flex-1 items-center gap-12 px-6 py-8 sm:px-10 sm:py-12 lg:grid-cols-[1fr_460px] lg:gap-20 lg:px-16">
        <div className="hidden max-w-lg self-end pb-12 lg:block">
          <div className="mb-5 flex items-center gap-3 text-sm font-medium tracking-[0.18em] text-brand uppercase">
            <ShieldCheckIcon className="size-5 shrink-0" aria-hidden="true" />
            {d.heroKicker}
          </div>
          <h2 className="text-balance font-heading text-5xl leading-[1.08] font-extrabold tracking-tight xl:text-6xl">
            {d.heroTitle}
            <span className="mt-1 block text-brand">{d.heroAccent}</span>
          </h2>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-white/75">{d.heroDescription}</p>
        </div>

        <section aria-labelledby="sign-in-title" className="mx-auto w-full max-w-[460px] rounded-3xl border border-white/12 bg-background/90 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
          <div className="mb-8">
            <div className="mb-7 flex size-12 items-center justify-center rounded-2xl border border-brand/20 bg-brand/10 text-brand">
              <ShieldCheckIcon className="size-6" aria-hidden="true" />
            </div>
            <p className="mb-3 text-xs font-semibold tracking-[0.16em] text-brand uppercase">{d.kicker}</p>
            <h1 id="sign-in-title" className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{d.title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-white/60">{d.description}</p>
          </div>

          <SignInForm
            initialError={message}
            adminHref={localePath(locale, "/admin")}
            labels={{
              email: d.email,
              password: d.password,
              submit: d.submit,
              pending: d.pending,
              invalid: d.invalid,
              showPassword: d.showPassword,
              hidePassword: d.hidePassword,
            }}
          />

          <div className="mt-7 flex items-start gap-2.5 border-t border-white/10 pt-6 text-xs leading-relaxed text-white/55">
            <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-brand/80" aria-hidden="true" />
            <p>{d.footer}</p>
          </div>
        </section>
      </div>
      <footer className="mx-auto w-full max-w-[1440px] px-6 py-6 text-xs tracking-wide text-white/50 sm:px-10 lg:px-16">
        IFRIQIYA SOCCER STAR <span className="mx-2 text-brand" aria-hidden="true">/</span> {d.kicker}
      </footer>
    </main>
  );
}
