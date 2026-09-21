/**
 * Titre d'article -> identifiant d'URL. Pas de dependance ajoutee pour ca :
 * une fonction pure suffit, et le projet prefere ecrire ce genre d'utilitaire
 * plutot que d'ajouter un paquet pour quelques lignes (cf. `lib/utils.ts`).
 *
 * `normalize("NFD")` + suppression des marques diacritiques retire les
 * accents (« Ete » plutot que « t » pour « Été ») sans table de
 * correspondance a maintenir.
 */
export function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}
