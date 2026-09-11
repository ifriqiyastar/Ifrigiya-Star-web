import Image from "next/image";
import Link from "next/link";


/** Le logo, en vectoriel — voir `components/site/site-nav.tsx` pour le detail. */
function Logo({ size = 32 }: { size?: number }) {
  return (
    <Image src="/brand/ifriqiya-star.svg" alt="Ifriqiya Star" width={size} height={size} />
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-(--site-line) py-14">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="font-heading text-base font-extrabold">Ifriqiya Star</span>
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-(--site-muted)">
            L&apos;excellence footballistique au service de la jeunesse et de la performance.
          </p>
        </div>

        <FooterColumn
          titre="L'academie"
          liens={[
            { href: "/#academie", label: "Qui sommes-nous" },
            { href: "/#comment", label: "Comment ca marche" },
            { href: "/#scout-days-videos", label: "Scout Days en vidéo" },
            { href: "/#fonctionnalites", label: "L'application" },
            { href: "/#valeurs", label: "Nos valeurs" },
          ]}
        />

        <FooterColumn
          titre="Ressources"
          liens={[
            { href: "/#faq", label: "Questions frequentes" },
            { href: "/#temoignages", label: "Témoignages illustratifs" },
            { href: "/contact", label: "Contactez-nous" },
            { href: "/#telecharger", label: "Telecharger l'app" },
            { href: "/admin", label: "Espace administration" },
          ]}
        />

        <div className="flex flex-col gap-3">
          <p className="font-heading text-sm font-bold tracking-wide uppercase">Nous ecrire</p>
          <p className="text-sm leading-relaxed text-(--site-muted)">
            Une question sur l&apos;academie, une detection ou un partenariat ? Notre equipe repond.
          </p>
          <a
            href="mailto:contact@ifriqiyastar.com"
            className="w-fit text-sm font-semibold text-(--site-accent) hover:underline"
          >
            contact@ifriqiyastar.com
          </a>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-2 border-t border-(--site-line) px-5 pt-6 text-xs text-(--site-muted) sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} Ifriqiya Star. Tous droits reserves.</p>
        <p>Detection · Progression · Excellence</p>
      </div>
    </footer>
  );
}

function FooterColumn({
  titre,
  liens,
}: {
  titre: string;
  liens: { href: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-heading text-sm font-bold tracking-wide uppercase">{titre}</p>
      <ul className="flex flex-col gap-2">
        {liens.map((lien) => (
          <li key={lien.href}>
            <Link
              href={lien.href}
              className="text-sm text-(--site-muted) transition-colors hover:text-(--site-accent)"
            >
              {lien.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
