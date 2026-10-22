/**
 * L'echappement des recherches texte du back-office. **Un seul endroit.**
 *
 * Ce module n'importe rien : il est appele depuis des pages serveur, des
 * Route Handlers et des tests, et une dependance vers `lib/i18n/admin.ts` ou
 * vers le client Supabase le rendrait inimportable depuis l'un des trois.
 *
 * Il existe parce que le depot a longtemps porte quatre echappements
 * differents pour la meme question — deux corrects (le journal des campagnes,
 * la moderation), deux qui **effacaient** les caracteres genants au lieu de
 * les echapper (`replace(/[%,()]/g, " ")`, sur l'annuaire, le blog et deux
 * files de validation). Les consequences de la seconde forme :
 *
 *  * `_` n'etait pas traite du tout, donc chercher « Jean_Pierre » ramenait
 *    aussi « JeanXPierre » — `_` est le joker « un caractere quelconque » ;
 *  * `%` etait remplace par une espace, donc la recherche ne trouvait jamais
 *    un libelle qui en contient vraiment, sans rien dire a l'administrateur ;
 *  * `\` passait tel quel, et c'est lui qui echappe les autres.
 */

/**
 * Le texte tape par l'administrateur, rendu inoffensif comme motif `ilike`
 * **pose seul** (`query.ilike(colonne, …)`).
 *
 * `%` et `_` sont les jokers de Postgres : sans echappement, chercher
 * « 100% » ramene tout ce qui commence par « 100 ». Le `\` doit partir en
 * premier, sinon il echapperait les echappements ajoutes ensuite.
 */
export const likeTerm = (value: string) =>
  `%${value.replace(/\\/g, "\\\\").replace(/[%_]/g, (char) => `\\${char}`)}%`;

/**
 * Le meme texte, rendu inoffensif **a l'interieur d'un `or=(...)`
 * PostgREST** — deux echappements successifs, et l'ordre compte.
 *
 * 1. l'echappement `ilike` ci-dessus ;
 * 2. `or=(...)` reserve la virgule et les parentheses, donc la valeur doit
 *    etre entre guillemets — et PostgREST **deshabille un niveau de `\`** en
 *    sortant des guillemets, ce qui mangerait l'echappement de l'etape 1.
 *
 * Mesure contre le projet reel plutot que deduite : `title.ilike."%\%%"`
 * renvoie les 7 lignes de la table (l'echappement a ete perdu), tandis que
 * `title.ilike."%\\%%"` en renvoie 0 (le `%` est bien devenu litteral). Une
 * virgule, une parenthese ou un guillemet passent alors sans erreur
 * d'analyse.
 */
export function orLikeTerm(value: string) {
  return `"${likeTerm(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Le corps d'un `or=(...)` qui cherche le meme terme dans plusieurs colonnes.
 *
 * La liste de colonnes vit a cote de la requete qui l'emploie, et l'export
 * CSV de l'ecran reprend la meme : c'est ce qui garantit qu'un export « avec
 * les filtres de l'ecran » filtre reellement comme l'ecran.
 */
export const orSearchClause = (columns: readonly string[], value: string) => {
  const term = orLikeTerm(value);
  return columns.map((column) => `${column}.ilike.${term}`).join(",");
};

/**
 * Les colonnes ou la recherche de l'annuaire cherche le terme tape. Ici
 * plutot que dans `users.ts` : `listUsers()` sert la page **et** son export
 * CSV, et les deux doivent chercher au meme endroit.
 */
export const USER_SEARCH_COLUMNS = ["full_name", "email", "phone"] as const;

/**
 * Les colonnes interrogees quand un ecran cherche un COMPTE sans avoir le nom
 * dans sa propre table (paiements, abonnements) : nom et e-mail seulement, le
 * telephone n'etant pas annonce par ces deux recherches.
 */
export const PROFILE_NAME_COLUMNS = ["full_name", "email"] as const;
