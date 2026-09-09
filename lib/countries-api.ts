import isoCountries from "i18n-iso-countries";
import isoCountriesFr from "i18n-iso-countries/langs/fr.json";

/**
 * Client de countriesnow.space (gratuit, sans cle), **le meme service que
 * l'application mobile** (`~/ifriqiyastar/src/lib/countries-api.ts`). Les deux
 * cotes doivent proposer les memes libelles : `player_profiles.country` et
 * `scout_days.eligibility_criteria.countries` stockent le **nom francais**, et
 * le controle d'eligibilite (§8.2) les compare par egalite de chaine — deux
 * referentiels differents ne se rencontreraient jamais.
 *
 * ⚠️ DEUX PIEGES REPRIS DU MOBILE, tous deux payes une fois la-bas :
 *
 *  1. L'endpoint documente pour les villes est `POST /countries/cities` avec
 *     un corps `{ country }`. Il repond aujourd'hui un **301**, et un POST
 *     redirige est rejoue en GET — le corps est perdu, donc le filtre pays
 *     disparait *en silence* et l'API renvoie tout. On appelle donc
 *     directement la variante GET.
 *  2. L'endpoint des villes ne connait que ses propres noms **anglais**. Le
 *     nom francais sert a l'affichage et au stockage, l'anglais a l'appel :
 *     `Country` porte les deux, et les confondre renvoie une liste vide.
 *
 * ⚠️ Ce module est appele **cote serveur** (Server Component et route
 * handler), pas depuis le navigateur : le back-office est un site web, et un
 * `fetch` direct dependrait du CORS d'un tiers qu'on ne controle pas.
 */

isoCountries.registerLocale(isoCountriesFr);

const BASE_URL = "https://countriesnow.space/api/v0.1";

export type Country = {
  /** Nom anglais — ce que l'endpoint des villes attend. */
  name: string;
  /** Nom francais — ce qui est affiche **et stocke**. */
  nameFr: string;
  iso2: string;
  /** Drapeau emoji, derive du code ISO. Decoratif : jamais stocke. */
  flag: string;
};

/**
 * Code ISO 3166-1 alpha-2 -> drapeau emoji, en mappant chaque lettre sur son
 * « regional indicator symbol » (U+1F1E6..U+1F1FF). Repris a l'identique du
 * mobile : aucune API ni image de drapeau, c'est ainsi que font la plupart des
 * selecteurs de pays.
 *
 * ⚠️ Le rendu depend de la police du systeme. Sous Linux/Chrome, faute de
 * glyphes de drapeaux, les deux lettres regionales s'affichent (« TN ») au
 * lieu de l'embleme — degradation acceptable, le nom du pays est a cote.
 */
export function getFlagEmoji(iso2: string): string {
  if (!/^[A-Za-z]{2}$/.test(iso2)) return "🏳️";
  return String.fromCodePoint(
    ...iso2
      .toUpperCase()
      .split("")
      .map((char) => 0x1f1e6 + (char.charCodeAt(0) - 65)),
  );
}

/** Nom francais d'un code ISO 3166-1 alpha-2, depuis le jeu de donnees local. */
const frenchName = (iso2: string, fallback: string) =>
  isoCountries.getName(iso2, "fr") ?? fallback;

let countriesCache: Country[] | null = null;

/** La liste des pays, triee par nom francais. Mise en cache pour le process. */
export async function fetchCountries(): Promise<Country[]> {
  if (countriesCache) return countriesCache;

  try {
    const response = await fetch(`${BASE_URL}/countries/positions`, {
      // La liste ne bouge pas d'une semaine a l'autre.
      next: { revalidate: 60 * 60 * 24 },
    });
    const json = await response.json();
    if (json.error) throw new Error(json.msg ?? "Liste des pays indisponible.");

    const countries: Country[] = (json.data ?? [])
      .map((row: { name: string; iso2: string }) => ({
        name: row.name,
        nameFr: frenchName(row.iso2, row.name),
        iso2: row.iso2,
        flag: getFlagEmoji(row.iso2),
      }))
      .sort((a: Country, b: Country) => a.nameFr.localeCompare(b.nameFr));

    countriesCache = countries;
    return countries;
  } catch {
    // Un service tiers indisponible ne doit pas empecher de creer un Scout Day :
    // l'appelant retombe sur une saisie libre.
    return [];
  }
}

const citiesCache = new Map<string, string[]>();

/** Les villes d'un pays, par son nom **anglais**. Triees, mises en cache. */
export async function fetchCities(country: string): Promise<string[]> {
  const cached = citiesCache.get(country);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${BASE_URL}/countries/cities/q?country=${encodeURIComponent(country)}`,
      { next: { revalidate: 60 * 60 * 24 } },
    );
    const json = await response.json();
    if (json.error) throw new Error(json.msg ?? "Liste des villes indisponible.");

    const cities: string[] = (json.data ?? [])
      .slice()
      .sort((a: string, b: string) => a.localeCompare(b));
    citiesCache.set(country, cities);
    return cities;
  } catch {
    return [];
  }
}
