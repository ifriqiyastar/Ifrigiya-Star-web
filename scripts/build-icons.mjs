#!/usr/bin/env node
/**
 * Regenere les icones de l'onglet et de l'ecran d'accueil — `app/favicon.ico`,
 * `app/icon.png`, `app/apple-icon.png` — a partir du logo de marque
 * `public/brand/ifriqiya-star.svg`. A relancer si le logo change.
 *
 * Next.js App Router detecte ces trois fichiers par convention de nom : aucun
 * `<link rel="icon">` a ecrire a la main, et rien a declarer dans l'objet
 * `metadata` de `app/[locale]/layout.tsx`.
 *
 * ⚠️ POURQUOI LE SVG DU SITE ET NON L'ICONE DE L'APP MOBILE
 * (`~/ifriqiyastar/assets/images/icon.png`), qui est pourtant la meme marque :
 * la marque n'y occupe qu'un quart du cadre, decentree, et sa boite englobante
 * reelle fait 200x579 — presque trois fois plus haute que large. Reduite en
 * 16 px, elle devient un trait blanc de quatre pixels. Le SVG, lui, est deja
 * carre et cadre, et il porte le vert lime de la charte, qui ressort sur un
 * onglet clair COMME sur un onglet sombre la ou un aplat blanc sur noir se
 * confond avec le chrome du navigateur en theme sombre.
 *
 * ⚠️ `apple-icon.png` est le seul rendu A PLAT (coins remplis en noir) :
 * iOS applique son propre masque arrondi, et des coins transparents
 * ressortiraient en blanc par-dessous. Les deux autres gardent l'arrondi du
 * SVG, que les navigateurs affichent tel quel.
 *
 * Usage : node scripts/build-icons.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SVG = join(ROOT, "public/brand/ifriqiya-star.svg");
const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };

/** Rend le SVG a la taille voulue. `flat` remplit les coins arrondis en noir. */
async function render(size, flat = false) {
  const svg = readFileSync(SVG);
  // La densite suit la taille : un SVG rendu a 72 dpi puis agrandi baverait.
  const base = sharp(svg, { density: Math.max(72, size * 4) }).resize(size, size, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (!flat) return base.png({ compressionLevel: 9 }).toBuffer();
  const mark = await base.toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BLACK } })
    .composite([{ input: mark }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Assemble un `.ico` dont chaque image est un PNG — format accepte par tous
 * les navigateurs actuels, et qui evite d'avoir a ecrire du BMP a la main.
 * En-tete 6 octets, puis une entree de 16 octets par taille, puis les PNG.
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserve
  header.writeUInt16LE(1, 2); // type : icone
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = [];
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 signifie 256
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // plans
    e.writeUInt16LE(32, 6); // bits par pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const small = [];
for (const size of [16, 32, 48]) small.push({ size, data: await render(size) });

writeFileSync(join(ROOT, "app/favicon.ico"), ico(small));
writeFileSync(join(ROOT, "app/icon.png"), await render(512));
writeFileSync(join(ROOT, "app/apple-icon.png"), await render(180, true));

console.log("app/favicon.ico (16/32/48), app/icon.png (512), app/apple-icon.png (180) regeneres");
