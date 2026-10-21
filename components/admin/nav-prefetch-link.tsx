"use client"

import Link from "next/link"
import * as React from "react"

/**
 * Le lien du rail de navigation : charge la page **au survol**, pas au clic.
 *
 * POURQUOI. Un ecran du back-office est une route dynamique. Par defaut
 * (`prefetch="auto"`), Next n'en prefetche que le squelette jusqu'a la
 * premiere frontiere `loading.js` — jamais les donnees. Tout le cout du rendu
 * serveur tombait donc apres le clic : la garde d'acces, puis les requetes de
 * l'ecran, soit plusieurs allers-retours successifs vers un projet Supabase
 * distant (0,09 a 0,51 s l'un a chaud, 1,01 s a froid, mesure du 21 oct. 2026).
 * C'est le meme defaut que `components/admin/pagination.tsx` a corrige pour
 * « Suivant », et pour la meme raison.
 *
 * ⚠️ **Le survol, et surtout pas le viewport.** `prefetch` a `true` aurait
 * prefetche la charge complete des quatorze entrees du rail des l'affichage
 * de n'importe quel ecran — quatorze rendus serveur complets, donc quatorze
 * fois la garde et les requetes de file, sur le lien meme qu'on cherche a
 * desengorger. Le rail aurait rendu le back-office plus lent, pas plus
 * rapide. `prefetch={false}` coupe le viewport *et* le survol ; on l'arme
 * donc a la main au premier survol ou a la premiere prise de focus, ce qui
 * est exactement le motif que Next documente pour les listes de liens
 * (`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`,
 * « To reduce resource usage without fully disabling prefetch »).
 *
 * Deux choses a savoir avant de juger l'effet :
 *
 *  * **le prefetch n'existe qu'en production** (regle de Next) — en
 *    `next dev`, le clic reste aussi lent qu'avant ;
 *  * **il n'y a pas de survol sur telephone**, ou le rail est un tiroir : la
 *    navigation y coute ce qu'elle coutait. C'est assume — c'est aussi la ou
 *    le prefetch de quatorze pages serait le plus couteux.
 *
 * Une page prefetchee est servie depuis le cache client pendant
 * `staleTimes.static`, ramene a 30 s dans `next.config.ts` pour que l'ecran
 * ne puisse jamais etre plus perime que la pastille qui l'annonce.
 */
export function NavPrefetchLink({
  href,
  onMouseEnter,
  onFocus,
  ...props
}: React.ComponentProps<typeof Link>) {
  const [armed, setArmed] = React.useState(false)

  return (
    <Link
      {...props}
      href={href}
      prefetch={armed}
      // Les deux gestes restent transmis : `SidebarMenuButton` y accroche son
      // infobulle, et l'ecraser la ferait disparaitre.
      onMouseEnter={(event) => {
        setArmed(true)
        onMouseEnter?.(event)
      }}
      onFocus={(event) => {
        setArmed(true)
        onFocus?.(event)
      }}
    />
  )
}
