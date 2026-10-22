/**
 * Le CSV des exports du back-office. **Un seul endroit**, parce que les six
 * exports (annuaire, files de validation, Scout Days, signalements, campagnes,
 * paiements) doivent se comporter pareil : meme echappement, meme BOM, et
 * surtout **le meme aveu quand le fichier est tronque**.
 *
 * ⚠️ AUCUN EXPORT NE DOIT SE TAIRE SUR CE QU'IL LAISSE. Chacun s'arrete a un
 * plafond (1 000 a 10 000 lignes selon l'ecran) pour ne pas transformer un
 * telechargement de navigateur en extraction de base. Jusqu'ici aucun ne le
 * disait : un fichier arrete a la 1 000e ligne sur 3 000 se lit comme le
 * registre complet, et c'est exactement le genre d'affirmation que le reste du
 * depot s'interdit. La derniere ligne du fichier le dit maintenant, en toutes
 * lettres et avec les deux nombres.
 *
 * Ce module n'importe rien : il est appele depuis des Route Handlers, et la
 * phrase d'avertissement lui est passee deja traduite.
 */

/** Une valeur, entre guillemets, les guillemets internes doubles. */
export const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function csvDocument({
  columns,
  rows,
  notice,
}: {
  columns: readonly string[];
  /** Une ligne = une liste de cellules **deja echappees** par `csvCell`. */
  rows: string[][];
  /** L'aveu de troncature, pose en derniere ligne quand il y en a une. */
  notice?: string | null;
}) {
  const lines = [columns.join(","), ...rows.map((cells) => cells.join(","))];
  // En derniere ligne et non en premiere : la premiere est l'en-tete, et un
  // tableur qui trie la feuille garde l'avertissement visible en bas.
  if (notice) lines.push(csvCell(notice));
  // BOM en tete : sans lui, Excel lit l'UTF-8 comme du Latin-1 et casse les
  // accents des noms.
  return `﻿${lines.join("\n")}`;
}

/** La reponse HTTP d'un export, avec son nom de fichier date. */
export function csvResponse(content: string, filename: string) {
  return new Response(content, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ifriqiya-${filename}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
