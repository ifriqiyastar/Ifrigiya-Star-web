import { axesOf, type ScoredRow } from "@/lib/evaluation-axes";
import { getAdminI18n } from "@/lib/i18n/admin";
import { cn } from "@/lib/utils";

/**
 * Le detail des notes d'une evaluation — six axes ou quatre, selon ce que la
 * ligne porte reellement.
 *
 * ⚠️ **C'EST LA CORRECTION D'UN CHIFFRE FAUX, pas un habillage.** Les deux
 * ecrans qui affichent des notes lisaient les quatre colonnes de 0030 sans
 * condition. Sur une evaluation a six axes ces colonnes valent `null`, et
 * `Number(null)` vaut **0** : la liste des evaluations affichait
 * « TEC 0 PHY 0 TAC 0 MEN 0 » et la fiche d'un Scout Day quatre colonnes de
 * zeros, pour chaque rapport saisi depuis l'application mobile — un joueur nul
 * partout, pendant que ses six vraies notes dormaient dans les colonnes d'a
 * cote.
 *
 * Une ligne sans aucune note ne rend rien plutot qu'une grille a zero, qui
 * mentirait de la meme facon.
 */
export async function AxisScores({ row, className }: { row: ScoredRow; className?: string }) {
  const i18n = await getAdminI18n();
  const axes = axesOf(row);

  if (!axes.length) {
    return <span className="text-xs text-muted-foreground">{i18n.t("Notes absentes")}</span>;
  }

  return (
    <div
      // Trois colonnes pour les six axes, quatre pour les anciennes : dans les
      // deux cas la grille tient dans la meme largeur de cellule.
      className={cn("grid w-fit gap-1", axes.length > 4 ? "grid-cols-3" : "grid-cols-4", className)}
      aria-label={i18n.t("Detail des notes")}
    >
      {axes.map(({ spec, value }) => (
        <span
          key={spec.key}
          title={i18n.t(spec.label)}
          className="flex w-8 flex-col items-center rounded bg-secondary px-1.5 py-1"
        >
          <span className="text-[0.5rem] text-muted-foreground">{i18n.t(spec.code)}</span>
          <span className="text-[0.6875rem] font-semibold tabular-nums">{value}</span>
        </span>
      ))}
    </div>
  );
}
