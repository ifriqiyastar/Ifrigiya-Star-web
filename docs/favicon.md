# Icônes d'onglet et d'écran d'accueil

Fichiers livrés : `app/favicon.ico` (16/32/48), `app/icon.png` (512),
`app/apple-icon.png` (180). Régénérés par `node scripts/build-icons.mjs`
depuis `public/brand/ifriqiya-star.svg`.

Next.js App Router les détecte **par convention de nom** : rien à écrire dans
l'objet `metadata` de `app/[locale]/layout.tsx`, aucun `<link rel="icon">` à la
main. C'est pour ça qu'ils vivent dans `app/` et non dans `public/`.

## Ce qu'ils remplacent

Le `favicon.ico` par défaut du gabarit Next/Vercel, resté en place depuis la
création du projet (25 931 octets, le logo Vercel). Il s'affichait dans
l'onglet de toutes les pages publiques.

## Pourquoi le SVG du site, et non l'icône de l'app mobile

C'est la même marque, et le réflexe serait de reprendre
`~/ifriqiyastar/assets/images/icon.png` — celle que montre la fiche Play Store.
Mesuré : dans ce fichier de 1024×1024, la boîte englobante réelle de la marque
fait **200×579**, décentrée, soit presque trois fois plus haute que large.
Réduite en 16 px, elle devient un trait blanc de quatre pixels de large.

Le SVG de marque, lui, est déjà carré et cadré, et il porte le vert lime
`#aff70f` de la charte. Ça compte pour une icône d'onglet : le lime ressort sur
un onglet clair **comme** sur un onglet sombre, là où un aplat blanc sur noir
se confond avec le chrome du navigateur en thème sombre.

⚠️ Conséquence assumée : l'icône du site et celle du Play Store ne sont pas
identiques — lime sur noir arrondi d'un côté, blanc sur noir carré de l'autre.
C'est la même marque dans deux déclinaisons de la charte. Si le client veut une
stricte parité avec le Store, il faut d'abord **recadrer l'icône mobile**, pas
changer celle du site : c'est le cadrage de la source mobile qui est en cause.

## Le cas d'`apple-icon.png`

Seul rendu **à plat**, coins remplis en noir. iOS applique son propre masque
arrondi à l'icône d'écran d'accueil : des coins transparents ressortiraient en
blanc par-dessous. Les deux autres gardent l'arrondi du SVG, que les
navigateurs affichent tel quel.

## Le `.ico`

`sharp` ne sait pas écrire d'ICO. Le script assemble donc le conteneur
lui-même — en-tête de 6 octets, une entrée de 16 octets par taille, puis les
images — avec des **PNG** en charge utile plutôt que du BMP. Tous les
navigateurs actuels l'acceptent, et ça évite d'écrire un encodeur BMP.
Vérification : `file app/favicon.ico` doit annoncer `3 icons` et
`with PNG image data`.
