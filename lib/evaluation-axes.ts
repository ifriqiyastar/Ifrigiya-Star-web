import {
  ActivityIcon,
  BrainIcon,
  CrosshairIcon,
  FlameIcon,
  HandIcon,
  Share2Icon,
  TargetIcon,
  WaypointsIcon,
  ZapIcon,
} from "lucide-react";

/**
 * Les axes d'une evaluation de Scout Day (§8.4), en UN SEUL ENDROIT.
 *
 * Port de `~/ifriqiyastar/src/lib/evaluation-axes.ts`, dont ce module doit
 * rester le miroir : c'est la meme table, lue par les deux applications.
 *
 * Decision client du 2026-09-24 (migration mobile **0091**) : six axes —
 * Vitesse · Finition · Precision · Passe · Defense · Cognitif. Ils remplacent
 * les quatre de 0030 (technique / physique / tactique / mental), qui etaient
 * des *categories de jugement* la ou ceux-ci sont des *phases de jeu et des
 * qualites mesurables*.
 *
 * ⚠️⚠️ **AUCUNE CONVERSION N'EST POSSIBLE ENTRE LES DEUX**, et aucune n'est
 * faite : personne ne peut deduire une « Precision » d'une « technique ». Les
 * evaluations ecrites avant 0091 gardent leurs quatre notes et continuent de
 * s'afficher avec leurs quatre axes ; `axesOf()` lit ce que la ligne porte
 * reellement. Un joueur evalue avant et apres a donc deux profils de formes
 * differentes dans son historique — c'est exact, et le masquer serait mentir.
 *
 * ⚠️ **C'est ce qui manquait ici, et cela se voyait.** Le back-office lisait
 * `Number(row.technical_score)` sur toutes les lignes ; sur une evaluation a
 * six axes ces colonnes sont `null`, et `Number(null)` vaut **0**. La liste
 * affichait donc « TEC 0 PHY 0 TAC 0 MEN 0 » pour chaque evaluation saisie
 * depuis l'application mobile : un joueur nul partout, alors que ses six notes
 * etaient enregistrees a cote.
 *
 * ⚠️ **Les cles sont les colonnes**, pas des libelles : `speed` -> `speed_score`.
 */
type AxisShape = {
  /** Le prefixe de la colonne : `speed` -> `speed_score`. */
  readonly key: string;
  /** Libelle complet, cle du dictionnaire du back-office. */
  readonly label: string;
  /** Le code de trois lettres des listes compactes. */
  readonly code: string;
  /** La phrase sous le libelle dans le formulaire. */
  readonly hint: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly tone: "brand" | "info" | "warning" | "success";
};

/** Les six axes de 0091, dans l'ordre de saisie et d'affichage. */
export const EVALUATION_AXES = [
  { key: "speed", label: "Vitesse", code: "VIT", hint: "Acceleration et vitesse de pointe", icon: ZapIcon, tone: "brand" },
  { key: "finishing", label: "Finition", code: "FIN", hint: "Efficacite devant le but", icon: FlameIcon, tone: "warning" },
  { key: "accuracy", label: "Precision", code: "PRE", hint: "Justesse du geste technique", icon: CrosshairIcon, tone: "info" },
  { key: "passing", label: "Passe", code: "PAS", hint: "Qualite et vision de la passe", icon: Share2Icon, tone: "success" },
  { key: "defending", label: "Defense", code: "DEF", hint: "Duels, interceptions et repli", icon: HandIcon, tone: "info" },
  { key: "cognitive", label: "Cognitif", code: "COG", hint: "Lecture du jeu et prise de decision", icon: BrainIcon, tone: "brand" },
] as const satisfies readonly AxisShape[];

/** Les quatre axes de 0030, gardes pour LIRE les evaluations anterieures. */
export const LEGACY_EVALUATION_AXES = [
  { key: "technical", label: "Technique", code: "TEC", hint: "Gestuelle et maitrise", icon: TargetIcon, tone: "brand" },
  { key: "physical", label: "Physique", code: "PHY", hint: "Intensite et endurance", icon: ActivityIcon, tone: "info" },
  { key: "tactical", label: "Tactique", code: "TAC", hint: "Lecture et placement", icon: WaypointsIcon, tone: "warning" },
  { key: "mental", label: "Mental", code: "MEN", hint: "Decision et resilience", icon: BrainIcon, tone: "success" },
] as const satisfies readonly AxisShape[];

/**
 * Un axe, **avec ses libelles litteraux**. Il est derive des deux tableaux et
 * non ecrit a la main : `i18n.t()` n'accepte que les cles reellement presentes
 * dans le dictionnaire, donc un `label: string` large ferait echouer la
 * compilation partout ou un axe est affiche — et c'est exactement le garde-fou
 * qu'on veut garder.
 */
export type AxisSpec =
  | (typeof EVALUATION_AXES)[number]
  | (typeof LEGACY_EVALUATION_AXES)[number];

/**
 * Les dix colonnes de notes, pour un `select` explicite.
 *
 * ⚠️ Demander `speed_score` a un projet ou 0091 n'est pas posee ferait
 * echouer **toute** la requete en `42703`. Verifie le 2026-09-29 contre le
 * projet partage, et la methode compte autant que le resultat : une sonde
 * anonyme repond `42501 permission denied for function is_admin` pour toute
 * colonne existante — c'est le temoin negatif, une colonne inventee, qui
 * repond `42703` et prouve que les six autres existent bel et bien.
 */
export const EVALUATION_SCORE_COLUMNS =
  "speed_score, finishing_score, accuracy_score, passing_score, defending_score, cognitive_score, technical_score, physical_score, tactical_score, mental_score";

/**
 * ⚠️ Ecrite en toutes lettres, et **pas** derivee des deux tableaux ci-dessus :
 * supabase-js analyse la chaine d'un `select` **au niveau des types**, donc un
 * `join()` produit un `string` large que son analyseur refuse. La divergence
 * est donc rattrapee par un test — `tests/evaluation-axes.test.cjs` transpile
 * ce fichier et compare les deux listes — et non par un controle de type, qui
 * ne pourrait ici qu'etre un cast, c'est-a-dire une verification qui
 * n'en est pas une.
 */

/** Une ligne d'evaluation, quel que soit son jeu d'axes. */
export type ScoredRow = Record<string, unknown>;

export type ResolvedAxis = {
  spec: AxisSpec;
  value: number;
};

/**
 * Les axes **reellement portes** par une ligne.
 *
 * Six si la ligne vient de 0091, quatre si elle est anterieure, rien si elle
 * n'a aucune note — auquel cas l'appelant n'affiche pas de grille plutot
 * qu'une grille a zero, qui se lirait « ce joueur vaut zero ».
 *
 * ⚠️ On exige le jeu **complet**. `chk_evaluation_axis_set` (0091) l'impose
 * deja cote Postgres, mais une ligne a moitie lue — colonnes non demandees
 * dans le `select` — rendrait sinon une grille amputee sans le dire.
 */
export function axesOf(row: ScoredRow | null | undefined): ResolvedAxis[] {
  if (!row) return [];
  for (const specs of [EVALUATION_AXES, LEGACY_EVALUATION_AXES]) {
    const values = specs.map((spec) => row[`${spec.key}_score`]);
    if (values.every((value) => value !== null && value !== undefined && Number.isFinite(Number(value)))) {
      return specs.map((spec, index) => ({ spec, value: Number(values[index]) }));
    }
  }
  return [];
}

/**
 * La moyenne equiponderee — le meme calcul que la colonne generee
 * `overall_score`. Sert quand la colonne n'a pas ete demandee, jamais a la
 * remplacer : c'est Postgres qui l'ecrit.
 */
export function averageOf(axes: ResolvedAxis[]): number | null {
  if (!axes.length) return null;
  return axes.reduce((sum, axis) => sum + axis.value, 0) / axes.length;
}
