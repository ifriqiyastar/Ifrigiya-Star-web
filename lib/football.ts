/**
 * Postes de football, **repris a l'identique** de
 * `~/ifriqiyastar/src/constants/positions.ts`.
 *
 * Ces libelles ne sont pas de l'affichage : ils sont **stockes tels quels**
 * dans `player_profiles.main_position` et dans
 * `scout_days.eligibility_criteria.positions`, et le controle d'eligibilite
 * (§8.2) les compare par egalite de chaine. Une reformulation ici — un accent
 * en moins, un tiret en plus — rendrait un critere incapable de matcher qui
 * que ce soit, sans la moindre erreur.
 */
export const FOOTBALL_POSITIONS = [
  "Gardien de but",
  "Défenseur central",
  "Latéral droit",
  "Latéral gauche",
  "Milieu défensif",
  "Milieu central",
  "Milieu offensif",
  "Ailier droit",
  "Ailier gauche",
  "Attaquant de soutien",
  "Avant-centre",
] as const;

/**
 * Forme de `scout_days.eligibility_criteria`, identique a
 * `EligibilityCriteria` cote mobile et au commentaire de colonne de la
 * migration 0028. Toute cle absente = critere non filtrant.
 */
export type EligibilityCriteria = {
  age_min?: number;
  age_max?: number;
  positions?: string[];
  levels?: string[];
  countries?: string[];
  cities?: string[];
  free_agent_only?: boolean;
  other?: string;
};

/**
 * Retire les criteres vides avant stockage.
 *
 * Pendant de `cleanCriteria()` cote mobile, et pour la meme raison : un
 * `{"age_min": null}` se lirait comme « un critere existe » pour le controle
 * d'eligibilite. Un champ non renseigne doit etre **absent**, pas nul.
 */
export function cleanCriteria(criteria: EligibilityCriteria): EligibilityCriteria {
  const out: EligibilityCriteria = {};
  if (criteria.age_min != null && Number.isFinite(criteria.age_min)) out.age_min = criteria.age_min;
  if (criteria.age_max != null && Number.isFinite(criteria.age_max)) out.age_max = criteria.age_max;
  if (criteria.positions?.length) out.positions = criteria.positions;
  if (criteria.levels?.length) out.levels = criteria.levels;
  if (criteria.countries?.length) out.countries = criteria.countries;
  if (criteria.cities?.length) out.cities = criteria.cities;
  if (criteria.free_agent_only) out.free_agent_only = true;
  if (criteria.other?.trim()) out.other = criteria.other.trim();
  return out;
}
