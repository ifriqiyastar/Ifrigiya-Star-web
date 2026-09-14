import { getAdminI18n } from "@/lib/i18n/admin";
import {
  GaugeIcon,
  GlobeIcon,
  HourglassIcon,
  InfoIcon,
  MapPinIcon,
  ShirtIcon,
  TagIcon,
  UserCheckIcon,
} from "lucide-react";

import { PLAYER_LEVEL } from "@/lib/labels";

/**
 * Rendu des `scout_days.eligibility_criteria`.
 *
 * La colonne est un `jsonb`, mais **sa forme est connue** : elle est figee a
 * l'identique dans la migration 0028 (commentaire de colonne) et dans
 * `src/lib/scout-days.ts` cote application mobile, parce que le controle
 * d'eligibilite du §8.2 doit lire exactement ces cles. Afficher le JSON brut
 * revenait donc a renoncer a une structure qu'on connait — et a montrer
 * `["Houmt El Souk"]` la ou l'administrateur attend « Houmt El Souk ».
 *
 * Une cle absente n'est pas un critere vide : c'est un critere **non
 * filtrant**. Les sections sans valeur ne sont donc pas rendues du tout,
 * plutot qu'affichees avec un tiret.
 *
 * Les cles inconnues sont conservees en fin de liste : le formulaire du
 * back-office ecrit encore `{ description: "..." }`, et une valeur qu'on ne
 * sait pas nommer doit rester visible plutot que disparaitre.
 */

const KNOWN_KEYS = [
  "age_min",
  "age_max",
  "positions",
  "levels",
  "countries",
  "cities",
  "free_agent_only",
  "other",
] as const;

type Criteria = Record<string, unknown>;

type Section = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Valeurs courtes affichees en pastilles ; sinon `text` prend le relais. */
  chips?: string[];
  text?: string;
};

const asList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).filter(Boolean) : [];

const asNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function EligibilityCriteria({ criteria }: { criteria: Criteria }) {
  const i18n = await getAdminI18n();

  const ageMin = asNumber(criteria.age_min);
  const ageMax = asNumber(criteria.age_max);
  const positions = asList(criteria.positions);
  const levels = asList(criteria.levels);
  const countries = asList(criteria.countries);
  const cities = asList(criteria.cities);
  const freeAgentOnly = criteria.free_agent_only === true;
  const other = typeof criteria.other === "string" ? criteria.other.trim() : "";

  const extras = Object.entries(criteria).filter(
    ([key, value]) =>
      !(KNOWN_KEYS as readonly string[]).includes(key) &&
      value !== null &&
      value !== "" &&
      !(Array.isArray(value) && !value.length),
  );

  const age =
    ageMin !== null && ageMax !== null
      ? i18n.t("{0} a {1} ans", { "0": ageMin, "1": ageMax })
      : ageMin !== null
        ? i18n.t("{0} ans et plus", { "0": ageMin })
        : ageMax !== null
          ? i18n.t("{0} ans au maximum", { "0": ageMax })
          : null;

  const sections: Section[] = [
    age ? { title: i18n.t("Tranche d'age"), icon: HourglassIcon, text: age } : null,
    positions.length
      ? { title: i18n.t("Postes recherches"), icon: ShirtIcon, chips: positions.map(i18n.labels.position) }
      : null,
    levels.length
      ? {
          title: i18n.t("Niveaux"),
          icon: GaugeIcon,
          chips: levels.map((level) => i18n.labels.label(PLAYER_LEVEL, level)),
        }
      : null,
    // Pays et villes restent deux lignes : fondus dans une seule liste de
    // pastilles, « Tunisie » et « Houmt El Souk » ne se distinguent plus.
    countries.length ? { title: i18n.t("Pays"), icon: GlobeIcon, chips: countries } : null,
    cities.length ? { title: i18n.t("Villes"), icon: MapPinIcon, chips: cities } : null,
    freeAgentOnly
      ? { title: i18n.t("Situation"), icon: UserCheckIcon, text: i18n.t("Joueurs sans club uniquement") }
      : null,
    other ? { title: i18n.t("Autres exigences"), icon: InfoIcon, text: other } : null,
    ...extras.map(([key, value]) => ({
      title: key.replace(/_/g, " "),
      icon: TagIcon,
      text: typeof value === "object" ? JSON.stringify(value) : String(value),
    })),
  ].filter(Boolean) as Section[];

  if (!sections.length) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-secondary/60 px-4 py-3">
        <UserCheckIcon className="size-4 shrink-0 text-foreground/70" />
        <p className="text-sm text-muted-foreground">
          {i18n.t("Ouvert a tous les profils — aucun critere ne restreint l'inscription.")}</p>
      </div>
    );
  }

  return (
    <dl className="divide-y divide-border/60">
      {sections.map((section) => (
        <div
          key={section.title}
          className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
        >
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
            <section.icon className="size-4 text-foreground/70" />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <dt className="text-[0.625rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              {section.title}
            </dt>
            <dd>
              {section.chips ? (
                <ul className="flex flex-wrap gap-1.5">
                  {section.chips.map((item) => (
                    <li
                      key={item}
                      className="rounded-full bg-secondary px-2.5 py-1 text-xs leading-none text-foreground/90"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-relaxed break-words whitespace-pre-line">
                  {section.text}
                </p>
              )}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
