/**
 * La vignette d'un modele : le courriel reel, reduit.
 *
 * ⚠️ Une `iframe` en `sandbox=""` et `pointer-events-none`. Le courriel
 * porte son propre `<body>` et ses styles en ligne, qui se melangeraient a
 * ceux du back-office s'il etait rendu dans la page ; son contenu vient de
 * la base, donc rien n'a le droit de s'y executer ; et une vignette se
 * regarde, elle ne se clique pas — c'est la carte autour qui porte les
 * gestes.
 *
 * La reduction se fait par `transform`, pas par une largeur d'`iframe` : un
 * courriel mis en page pour 600 px et affiche dans 280 px se recomposerait,
 * et la vignette montrerait autre chose que ce qui part.
 */
export function TemplateThumb({ html, label }: { html: string; label: string }) {
  return (
    <div className="relative h-44 overflow-hidden border-b border-border bg-white">
      {/* ⚠️ Centre par `left: 50%` et une marge negative de la demi-largeur,
          pas par `origin-top-left` : le courriel est mis en page pour 600 px
          et cale a gauche, la vignette laissait un vide blanc a droite qui se
          lisait comme un defaut de rendu. La reduction reste un `transform`
          — retrecir l'`iframe` recomposerait la mise en page, et la vignette
          montrerait autre chose que ce qui part. */}
      <iframe
        title={label}
        srcDoc={html}
        sandbox=""
        scrolling="no"
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none absolute top-0 left-1/2 border-0"
        style={{
          width: "620px",
          height: "900px",
          marginLeft: "-310px",
          transform: "scale(0.52)",
          transformOrigin: "top center",
        }}
      />
      {/* Fondu en pied : la vignette coupe le courriel, et une coupe franche
          se lit comme un defaut d'affichage. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent"
      />
    </div>
  );
}
