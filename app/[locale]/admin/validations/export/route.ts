import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth";
import { csvCell, csvDocument, csvResponse } from "@/lib/csv";
import { getRequestAdminI18n } from "@/lib/i18n/admin";
import { fetchProfilesByIds } from "@/lib/queries/profiles";
import { orSearchClause } from "@/lib/queries/search-term";
import {
  PLAYER_SEARCH_COLUMNS,
  PRO_SEARCH_COLUMNS,
  validationStatus,
  type ValidationScope,
} from "@/lib/queries/validations-shared";
import { createClient } from "@/lib/supabase/server";

/**
 * Les quatre files de validation en CSV, **avec les filtres de l'ecran**.
 *
 * Les quatre autres listes du back-office (annuaire, signalements, campagnes,
 * finances) s'exportaient deja ; ces quatre-la, non, alors que ce sont les
 * seules dont le client ait a rendre compte — une file de validation est un
 * registre de decisions.
 *
 * ⚠️ MEME ETAT, MEMES COLONNES DE RECHERCHE QUE LA PAGE. L'etat passe par
 * `validationStatus()`, la recherche par les memes listes de colonnes, et les
 * deux vivent dans `lib/queries/validations-shared.ts` precisement pour que
 * l'ecran et son export ne puissent pas filtrer differemment : un export
 * annonce « avec les filtres de l'ecran » qui filtre autrement est un piege.
 *
 * `file` designe la file ; une valeur inconnue est refusee plutot que ramenee
 * a une file par defaut — un export silencieusement different de ce qui est
 * affiche est exactement ce que cette route evite.
 */
const QUEUES = {
  joueurs: {
    table: "player_profiles",
    scope: "profile" as ValidationScope,
    owner: "id",
    orderBy: "updated_at",
    search: PLAYER_SEARCH_COLUMNS,
    columns: [
      "id",
      "first_name",
      "last_name",
      "birth_date",
      "nationality",
      "country",
      "city",
      "main_position",
      "level",
      "current_club",
      "is_visible",
      "status",
      "status_reason",
      "created_at",
      "updated_at",
    ],
    filename: "profils-joueurs",
  },
  professionnels: {
    table: "professional_profiles",
    scope: "profile" as ValidationScope,
    owner: "id",
    orderBy: "updated_at",
    search: PRO_SEARCH_COLUMNS,
    columns: [
      "id",
      "professional_type",
      "organization_name",
      "contact_full_name",
      "position_title",
      "country",
      "city",
      "status",
      "status_reason",
      "created_at",
      "updated_at",
    ],
    filename: "comptes-professionnels",
  },
  justificatifs: {
    table: "professional_documents",
    scope: "document" as ValidationScope,
    owner: "professional_id",
    orderBy: "created_at",
    search: null,
    columns: ["id", "professional_id", "document_label", "status", "created_at"],
    filename: "justificatifs-pro",
  },
  identite: {
    table: "identity_verifications",
    scope: "document" as ValidationScope,
    owner: "player_id",
    orderBy: "created_at",
    search: null,
    columns: [
      "id",
      "player_id",
      "document_type",
      "status",
      "facial_check_provider",
      "facial_check_passed",
      "rejection_reason",
      "created_at",
    ],
    filename: "pieces-identite",
  },
} as const;

/** 1 000 lignes au plus, comme l'export de l'annuaire : au-dela, c'est une
 *  extraction SQL qu'il faut, pas un telechargement de navigateur. */
const EXPORT_LIMIT = 1_000;

export async function GET(request: NextRequest) {
  await requirePermission("verifications.review");
  const i18n = await getRequestAdminI18n();
  const params = request.nextUrl.searchParams;

  const key = params.get("file") ?? "";
  if (!(key in QUEUES)) {
    return Response.json({ error: "File inconnue." }, { status: 400 });
  }
  const queue = QUEUES[key as keyof typeof QUEUES];

  const supabase = await createClient();
  let query = supabase
    .from(queue.table)
    // `count` : le fichier doit pouvoir dire ce que le plafond laisse dehors.
    .select(queue.columns.join(","), { count: "exact" })
    .eq("status", validationStatus(queue.scope, params.get("etat") ?? undefined))
    .order(queue.orderBy, { ascending: false })
    .limit(EXPORT_LIMIT);

  const search = params.get("q")?.trim();
  if (search && queue.search) query = query.or(orSearchClause(queue.search, search));

  const { data, error, count } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Le compte proprietaire de la ligne : la liste a l'ecran affiche son nom et
  // son e-mail (`UserCell`), un export qui ne rendrait que des identifiants
  // obligerait a les recoller a la main. Les vignettes, elles, ne sont pas
  // signees — un CSV n'affiche pas d'image.
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const profiles = await fetchProfilesByIds(
    rows.map((row) => String(row[queue.owner] ?? "")),
    { signAvatars: false },
  );

  const total = count ?? rows.length;
  return csvResponse(
    csvDocument({
      columns: [...queue.columns, "compte", "email"],
      rows: rows.map((row) => {
        const profile = profiles.get(String(row[queue.owner] ?? ""));
        return [
          ...queue.columns.map((column) => csvCell(row[column])),
          csvCell(profile?.full_name),
          csvCell(profile?.email),
        ];
      }),
      notice:
        total > rows.length
          ? i18n.t(
              "Export limite aux {limite} premieres lignes sur {total}. Affinez les filtres de l'ecran pour obtenir le reste.",
              { limite: i18n.format.formatNumber(rows.length), total: i18n.format.formatNumber(total) },
            )
          : null,
    }),
    queue.filename,
  );
}
