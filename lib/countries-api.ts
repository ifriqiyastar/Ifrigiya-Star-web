import isoCountries from "i18n-iso-countries";
import isoCountriesEn from "i18n-iso-countries/langs/en.json";
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
// L'anglais aussi : la colonne stocke le nom **francais**, mais une saisie
// libre (le repli quand le service tiers est muet) ou une ligne ecrite par une
// version anterieure de l'application mobile peut porter le nom anglais. Le
// jeu de donnees est local, l'enregistrer ne coute aucune requete.
isoCountries.registerLocale(isoCountriesEn);

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

/**
 * Forme comparable d'un nom de pays : sans accents, sans casse, sans
 * ponctuation ni espaces.
 *
 * ⚠️ C'EST CE QUI FAIT LA DIFFERENCE ENTRE UN DRAPEAU ET RIEN.
 * `getAlpha2Code()` compare les chaines a l'identique : mesure faite,
 * « Algérie » rend `DZ` et « Algerie » rend `undefined`. Or ce depot ecrit le
 * francais **sans accents** dans tout son code, et une saisie libre en porte
 * rarement. Normaliser des deux cotes rattrape « cote d ivoire »,
 * « Côte-d'Ivoire » et « COTE D'IVOIRE » sur la meme entree.
 */
const comparableName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

let flagByName: Map<string, string> | null = null;

/**
 * Le drapeau d'un pays designe par son **nom** — ce que la base stocke.
 *
 * `player_profiles.country` et `professional_profiles.country` sont du texte,
 * pas un code ISO (voir l'en-tete de ce module) : il faut donc remonter au
 * code pour deriver l'embleme. L'index est bati une fois par process a partir
 * du jeu de donnees **local** des deux langues — aucune requete, aucun appel
 * au service tiers, contrairement a `fetchCountries()`.
 *
 * Rend `null` pour un pays non reconnu plutot qu'un drapeau blanc : l'appelant
 * affiche alors le nom seul, ce qui vaut mieux qu'un embleme faux.
 *
 * ⚠️ L'embleme reste un **emoji**, comme dans le selecteur de pays
 * (`CountryCitySelect`), et non un SVG comme `LocaleFlag` : celui-la ne dessine
 * que trois drapeaux de langues, ici il en faudrait deux cent cinquante. Sur un
 * systeme sans glyphes de drapeaux (Windows), les deux lettres regionales
 * s'affichent a la place — degradation acceptable, le nom du pays est juste a
 * cote.
 */
export function countryFlag(name: string | null | undefined): string | null {
  const needle = name?.trim();
  if (!needle) return null;

  if (!flagByName) {
    flagByName = new Map();
    for (const locale of ["fr", "en"] as const) {
      for (const [iso2, value] of Object.entries(isoCountries.getNames(locale))) {
        // Le jeu de donnees rend parfois plusieurs libelles pour un meme pays.
        for (const label of Array.isArray(value) ? value : [value]) {
          const key = comparableName(label);
          if (key && !flagByName.has(key)) flagByName.set(key, getFlagEmoji(iso2));
        }
      }
    }
  }

  return flagByName.get(comparableName(needle)) ?? null;
}

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
