import { fetchCities } from "@/lib/countries-api";
import { requireAdmin } from "@/lib/auth";

/**
 * Les villes d'un pays, pour le select dependant du formulaire Scout Day.
 *
 * Un proxy plutot qu'un `fetch` direct depuis le navigateur : le back-office
 * est un site web, donc un appel client dependrait du CORS de
 * countriesnow.space — un tiers qu'on ne controle pas, et qui n'a aucune
 * raison de garantir un en-tete pour notre domaine. Cote serveur, la question
 * ne se pose pas, et la reponse est mise en cache par `fetchCities()`.
 *
 * `requireAdmin()` malgre l'anodin de la donnee : toute route sous `/admin`
 * doit etre fermee, sans quoi elle devient un proxy ouvert.
 */
export async function GET(request: Request) {
  await requireAdmin();

  const country = new URL(request.url).searchParams.get("pays")?.trim();
  if (!country) return Response.json({ cities: [] });

  return Response.json({ cities: await fetchCities(country) });
}
