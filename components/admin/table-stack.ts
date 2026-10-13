/**
 * La forme que prend une file du back-office sur telephone.
 *
 * Sous `md`, la table cesse d'etre une table : l'en-tete disparait (il n'y a
 * plus de colonnes a nommer) et chaque ligne devient une **rangee compacte** —
 * l'identite seule sur la premiere ligne, les qualifications et le geste sur
 * la seconde :
 *
 *     ┌───────────────────────────────────────┐
 *     │ (av) Ahmed Ben Ali                    │   <- 1re cellule, pleine largeur
 *     │      ahmed@example.com                │
 *     │ [Joueur] [Valide]          [actions]  │   <- le reste en ligne, geste a la fin
 *     └───────────────────────────────────────┘
 *
 * C'est la disposition « rangees compactes » plutot qu'une carte par ligne :
 * une carte consomme plus de hauteur et rend une longue liste plus difficile a
 * parcourir, ce qui est precisement le travail d'une file d'administration.
 * Rien n'est duplique en JSX — ce sont les memes cellules, re-disposees — donc
 * une colonne ajoutee demain apparait dans la rangee sans second rendu a
 * tenir a jour.
 *
 * Les cellules qui ne portent que du contexte gardent leur `max-lg:hidden`
 * posee sur la cellule : elles restent masquees ici, et la fiche de detail les
 * porte deja. Celles qui qualifient la ligne (role, statut, montant) n'ont
 * plus besoin d'etre masquees — la rangee leur fait une place.
 *
 * ⚠️ Une chaine **litterale**, et non construite : l'analyseur de Tailwind lit
 * les sources pour decider quelles classes emettre, et ne voit pas une classe
 * assemblee a l'execution. C'est aussi pourquoi elle vit dans une constante
 * partagee plutot que recopiee sur vingt-deux tables.
 *
 * ⚠️ `ms-auto` et non `ml-auto` : le back-office se rend aussi en arabe, ou le
 * geste doit rester du cote de la fin de ligne, pas a droite.
 *
 * Les deux regles de `globals.css` qui figeaient la premiere colonne et
 * reduisaient les paddings sous 768 px ont ete retirees avec ce changement :
 * elles rendaient tolerable un defilement horizontal qui n'existe plus, et
 * leur specificite (`.admin-content [data-slot=…]`) passait devant ces
 * utilitaires.
 */
export const STACKED_ON_MOBILE =
  "max-md:block " +
  "max-md:[&_thead]:hidden " +
  "max-md:[&_tbody]:block " +
  "max-md:[&_tr]:flex max-md:[&_tr]:flex-wrap max-md:[&_tr]:items-center " +
  "max-md:[&_tr]:gap-x-2 max-md:[&_tr]:gap-y-2 max-md:[&_tr]:px-4 max-md:[&_tr]:py-3.5 " +
  "max-md:[&_td]:whitespace-normal max-md:[&_td]:p-0 " +
  "max-md:[&_td:first-child]:w-full " +
  "max-md:[&_td:last-child]:ms-auto";
