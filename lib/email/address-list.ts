/**
 * Les adresses saisies a la main pour une diffusion.
 *
 * ⚠️ **Ce module n'importe rien**, et c'est la condition pour qu'il serve.
 * Le composeur est un composant client ; il ne peut emprunter ni
 * `lib/actions/*` ni quoi que ce soit qui tire `server-only`. Or le decompte
 * affiche a l'ecran et la liste reellement envoyee doivent sortir de la
 * **meme** fonction : deux analyses du meme texte finiraient par ne pas
 * compter pareil, et l'ecran annoncerait un nombre que l'envoi dementirait.
 */

/**
 * Le plafond d'une saisie manuelle.
 *
 * ⚠️ Il est volontairement **bien plus bas** que `MAX_EMAIL_RECIPIENTS`
 * (2 000), qui borne une diffusion vers des comptes. Ce champ ne sert pas a
 * televerser un fichier de prospection : il sert a joindre quelques dizaines
 * de personnes qui attendent le message. Un plafond haut inviterait a coller
 * une liste achetee, que le domaine d'envoi paierait en reputation — le meme
 * domaine qui porte les notifications reelles du produit.
 */
export const MAX_TYPED_ADDRESSES = 200;

/** Ce qu'une saisie a donne, une fois lue. */
export type AddressList = {
  /** Les adresses retenues, minuscules et dedoublonnees. */
  emails: string[];
  /** Les fragments illisibles, dans l'ordre de saisie, pour les montrer. */
  invalid: string[];
  /** Combien de doublons ont ete retires. */
  duplicates: number;
  /** Combien d'adresses valides ont ete laissees de cote par le plafond. */
  overflow: number;
};

/**
 * ⚠️ Volontairement permissive : la seule validation qui tranche est celle
 * du fournisseur d'envoi, et le lot part en `batchValidation: "permissive"`
 * pour qu'une faute de frappe soit nommee sans faire tomber les autres. Ce
 * motif ecarte ce qui ne peut pas etre une adresse, pas ce qui serait
 * inhabituel : un domaine en `.photography` ou un `+` dans la partie locale
 * sont valides et circulent.
 */
const SHAPE = /^[^\s@,;]+@[^\s@,;.]+(\.[^\s@,;.]+)+$/;

/**
 * Lit un texte libre et en tire des adresses.
 *
 * Separateurs acceptes : retour a la ligne, virgule, point-virgule, tabulation.
 * La forme « Nom <adresse> », qui est ce que rend un copier-coller depuis un
 * tableur ou un client de messagerie, est reconnue.
 */
export function parseAddressList(raw: string): AddressList {
  const emails: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let overflow = 0;

  for (const piece of raw.split(/[\n,;\t]+/)) {
    const value = piece.trim();
    if (!value) continue;
    const address = (value.match(/<([^>]+)>/)?.[1] ?? value).trim().toLowerCase();
    if (!SHAPE.test(address)) {
      // Une seule mention par fragment fautif : repeter trente fois la meme
      // faute de frappe remplirait l'ecran sans rien apprendre de plus.
      if (!invalid.includes(value)) invalid.push(value);
      continue;
    }
    if (seen.has(address)) {
      duplicates += 1;
      continue;
    }
    seen.add(address);
    // ⚠️ Le surplus est **compte**, jamais coupe en silence : un fichier
    // tronque a la deux centieme ligne se lit comme un envoi complet.
    if (emails.length >= MAX_TYPED_ADDRESSES) {
      overflow += 1;
      continue;
    }
    emails.push(address);
  }

  return { emails, invalid, duplicates, overflow };
}
