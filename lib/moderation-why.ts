import { CheckIcon, EyeOffIcon, FlagIcon, XIcon } from "lucide-react";

/**
 * Ce qui met un contenu en cause — signalement, refus motive, trace de
 * validation, masquage a la main.
 *
 * ⚠️ **Le type et ses deux tables vivent dans un module neutre**, qui n'importe
 * ni `server-only` ni `"use client"`. La ligne de liste est rendue sur le
 * serveur (`ContentWhy`), la popup dans le navigateur
 * (`PostPreviewDialog`) : sans ce module il faudrait ecrire deux fois la
 * correspondance sorte → icone → couleur, et la deuxieme finirait par diverger
 * de la premiere. Une valeur importee d'un module `"use client"` par un
 * composant serveur n'est pas la valeur mais une reference client, donc la
 * dependance ne peut pas aller dans ce sens-la.
 *
 * Les lignes elles-memes sont construites par `whyLines()`
 * (`components/admin/moderation/pieces.tsx`), qui a besoin du dictionnaire, et
 * voyagent **serialisees** jusqu'a la popup : une icone est un composant, elle
 * ne traverse pas la frontiere — d'ou `kind`.
 */
export type WhyLine = {
  key: string;
  kind: "report" | "refus" | "validation" | "masque";
  label: string;
  detail: string;
  href?: string;
};

export const WHY_ICON: Record<WhyLine["kind"], React.ComponentType<{ className?: string }>> = {
  report: FlagIcon,
  refus: XIcon,
  validation: CheckIcon,
  masque: EyeOffIcon,
};

export const WHY_TONE: Record<WhyLine["kind"], string> = {
  report: "text-destructive",
  refus: "text-warning",
  validation: "text-success",
  masque: "text-warning",
};
