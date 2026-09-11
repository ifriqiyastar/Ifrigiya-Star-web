"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckIcon, MonitorSmartphoneIcon } from "lucide-react";

import {
  LOCALE_LABEL,
  LOCALE_SHORT,
  LOCALES,
  localePath,
  negotiateLocale,
  readLocaleCookie,
  stripLocale,
  writeLocaleCookie,
  type Locale,
} from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Le cookie de langue n'est pas un etat React : il vit dans le document et
 * change sous nos pieds. `useSyncExternalStore` est la primitive prevue pour
 * ca — elle evite le `setState` dans un `useEffect` (que le compilateur React
 * refuse) et gere l'hydratation en rendant d'abord l'instantane serveur.
 *
 * L'instantane serveur vaut `null` : le serveur **ne peut pas** savoir si
 * l'utilisateur est en automatique ou a choisi explicitement sa langue
 * courante — les deux produisent exactement la meme page.
 */
let listeners: Array<() => void> = [];

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notify() {
  for (const listener of listeners) listener();
}

const getSnapshot = (): Locale | "auto" => readLocaleCookie() ?? "auto";
const getServerSnapshot = (): Locale | "auto" | null => null;

/**
 * Le choix de langue de l'ecran Parametres — le pendant web de l'ecran
 * « Langue » de l'app mobile, avec la meme quatrieme option.
 *
 * « Automatique » n'est pas une langue : c'est **l'absence de cookie**. Tant
 * qu'il n'y en a pas, `proxy.ts` negocie `Accept-Language` a chaque requete,
 * donc la langue suit celle du navigateur ou du telephone. Le choisir
 * supprime donc le cookie au lieu d'en ecrire un.
 *
 * Deux corrections d'interface par rapport a la premiere version :
 *
 * - **on coche ce que l'utilisateur a choisi, pas ce qui en resulte.** Avant,
 *   quelqu'un en automatique voyait « Francais » coche : impossible de savoir
 *   si le reglage suivait son telephone ou s'il avait fige la langue. Les
 *   deux etats sont maintenant distincts ;
 * - **« Automatique » annonce ce qu'il donne en ce moment.** Une option qui
 *   delegue le choix doit dire ce que la delegation produit, sinon elle
 *   demande un acte de foi.
 */
export function LanguageChoice() {
  const { dict } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Ce que l'automatique donnerait maintenant, d'apres le navigateur — la
  // meme negociation que celle du proxy, sur les memes langues declarees.
  const resolvedAuto =
    typeof navigator === "undefined"
      ? null
      : negotiateLocale(navigator.languages.join(","));

  function apply(next: Locale | "auto") {
    writeLocaleCookie(next === "auto" ? null : next);
    notify();
    const target = next === "auto" ? (resolvedAuto ?? "fr") : next;
    router.push(localePath(target, stripLocale(pathname)));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4" role="radiogroup" aria-label={dict.language.choose}>
      <Option
        checked={preference === "auto"}
        onSelect={() => apply("auto")}
        title={dict.language.auto}
        subtitle={dict.language.autoHint}
        badge={
          resolvedAuto
            ? dict.language.autoResolved.replace("{language}", LOCALE_LABEL[resolvedAuto])
            : null
        }
        icon={<MonitorSmartphoneIcon className="size-4" aria-hidden />}
      />

      {/* Les langues explicites sont une autre nature de choix que
          « Automatique » : le trait les separe plutot que de les aligner
          comme quatre options equivalentes. */}
      <div className="border-t border-border" />

      <div className="flex flex-col gap-2">
        {LOCALES.map((locale) => (
          <Option
            key={locale}
            checked={preference === locale}
            onSelect={() => apply(locale)}
            title={LOCALE_LABEL[locale]}
            subtitle={LOCALE_SHORT[locale]}
            lang={locale}
          />
        ))}
      </div>
    </div>
  );
}

function Option({
  checked,
  onSelect,
  title,
  subtitle,
  badge,
  icon,
  lang,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  badge?: string | null;
  icon?: React.ReactNode;
  lang?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      lang={lang}
      onClick={onSelect}
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-start transition-colors",
        checked
          ? "border-brand/50 bg-brand/5"
          : "border-border hover:border-brand/30 hover:bg-muted/40",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        {icon ? (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              checked ? "bg-brand/15 text-brand" : "bg-muted text-muted-foreground",
            )}
          >
            {icon}
          </span>
        ) : null}
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{title}</span>
          {subtitle ? (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          ) : null}
          {badge ? <span className="text-xs font-medium text-brand">{badge}</span> : null}
        </span>
      </span>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          checked ? "border-brand bg-brand text-background" : "border-border",
        )}
      >
        {checked ? <CheckIcon className="size-3" aria-hidden /> : null}
      </span>
    </button>
  );
}
