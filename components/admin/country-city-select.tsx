"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";

import { Field } from "@/components/admin/forms/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { Country } from "@/lib/countries-api";

/**
 * Pays puis ville, deux listes dependantes — le meme couple que le formulaire
 * de l'application mobile, alimente par le meme service.
 *
 * ⚠️ **La valeur postee est le nom FRANCAIS du pays**, parce que c'est ce que
 * `player_profiles.country` stocke : le controle d'eligibilite (§8.2) compare
 * les chaines, donc un critere en anglais ne matcherait aucun joueur. Le nom
 * anglais ne sert qu'a interroger l'API des villes, qui ne connait que le sien.
 *
 * Repli assume : si le service tiers ne repond pas, les deux champs
 * redeviennent de la saisie libre plutot que de bloquer la creation d'un
 * evenement sur une dependance externe.
 */
export function CountryCitySelect({
  countries,
  defaultCountry,
  defaultCity,
}: {
  countries: Country[];
  defaultCountry?: string;
  defaultCity?: string;
}) {
  const [country, setCountry] = React.useState(defaultCountry ?? "");
  // Les villes sont retenues **avec le pays qui les a produites** : on derive
  // la liste affichee au lieu de la remettre a zero dans l'effet, ce qui
  // enchainerait un rendu de plus a chaque changement de pays.
  const [loaded, setLoaded] = React.useState<{ country: string; list: string[] }>({
    country: "",
    list: [],
  });
  const [loading, setLoading] = React.useState(false);
  const cities = loaded.country === country ? loaded.list : [];

  // Nom francais -> nom anglais, seul accepte par l'endpoint des villes.
  const englishByFrench = React.useMemo(
    () => new Map(countries.map((row) => [row.nameFr, row.name])),
    [countries],
  );

  /**
   * Le chargement est declenche par le **geste** (choix d'un pays), pas par une
   * synchronisation d'etat : c'est ce que React 19 attend d'un effet, et
   * `react-hooks/set-state-in-effect` le refuse autrement.
   */
  const loadCities = React.useCallback(
    async (nextCountry: string) => {
      const english = englishByFrench.get(nextCountry);
      if (!english) return;
      setLoading(true);
      try {
        const response = await fetch(`/admin/geo/cities?pays=${encodeURIComponent(english)}`);
        const json = await response.json();
        setLoaded({ country: nextCountry, list: json.cities ?? [] });
      } catch {
        setLoaded({ country: nextCountry, list: [] });
      } finally {
        setLoading(false);
      }
    },
    [englishByFrench],
  );

  // Aucun effet : les deux moments ou la liste doit exister sont des gestes —
  // choisir un pays, ou ouvrir le champ ville d'un evenement qu'on modifie
  // (le pays arrive alors deja rempli).

  if (!countries.length) {
    // Service indisponible : saisie libre, en le disant.
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pays" htmlFor="country" hint="Liste indisponible, saisie libre.">
          <Input id="country" name="country" defaultValue={defaultCountry ?? ""} />
        </Field>
        <Field label="Ville" htmlFor="city">
          <Input id="city" name="city" defaultValue={defaultCity ?? ""} />
        </Field>
      </div>
    );
  }

  // Une ville deja enregistree qui ne figure pas dans la liste doit rester
  // selectionnable : meme regle que `positionOptions()` cote mobile.
  const cityOptions =
    defaultCity && !cities.includes(defaultCity) ? [defaultCity, ...cities] : cities;

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Pays" htmlFor="country">
        <NativeSelect
          id="country"
          name="country"
          value={country}
          onChange={(event) => {
            setCountry(event.target.value);
            void loadCities(event.target.value);
          }}
        >
          <option value="">Tous les pays</option>
          {countries.map((row) => (
            // ⚠️ La `value` reste le nom francais **nu** : c'est elle qui est
            // stockee et comparee par le controle d'eligibilite. Le drapeau
            // n'orne que le libelle.
            <option key={row.iso2} value={row.nameFr}>
              {row.flag} {row.nameFr}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field
        label="Ville"
        htmlFor="city"
        hint={loading ? undefined : country ? undefined : "Choisissez d'abord un pays."}
      >
        <div className="relative">
          <NativeSelect
            id="city"
            name="city"
            defaultValue={defaultCity ?? ""}
            disabled={!country || loading}
            onFocus={() => {
              if (country && cities.length === 0) void loadCities(country);
            }}
          >
            <option value="">Toutes les villes</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </NativeSelect>
          {loading ? (
            <Loader2Icon className="absolute top-1/2 right-8 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
      </Field>
    </div>
  );
}
