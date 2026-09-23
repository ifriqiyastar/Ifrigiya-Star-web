#!/usr/bin/env node
/**
 * Regenere `public/og/{fr,en,ar}.png`, les images de partage (WhatsApp, X,
 * LinkedIn, iMessage...) de tout le site public. A relancer apres tout
 * changement des champs `hero.titleLine1` / `titleLine2` / `titleAccent` /
 * `leadMobile` dans `messages/*.json`, ou du logo/de la charte.
 *
 * POURQUOI UN SCREENSHOT DE NAVIGATEUR ET NON `next/og` (`ImageResponse`) :
 * dans ce projet, `ImageResponse` ignore silencieusement toute police
 * personnalisee passee via `fonts` — quel que soit le format (woff/ttf verifie),
 * quel que soit le rasteriseur (sharp installe ou repli resvg), le rendu
 * retombe toujours sur la police par defaut de `@vercel/og` (Geist), sans la
 * moindre erreur. Confirme par un test controle : un `<div>` minimal avec une
 * police cursive (Pacifico) sans aucune mise en forme produit le meme rendu
 * en police batons, presence ou absence de `sharp` ne changeant rien. Un vrai
 * navigateur (ici, via CDP) honore correctement les `@font-face`, d'ou ce
 * detour : on genere le HTML, on le fait peindre par un Chromium/Edge
 * installe sur la machine, et on capture le resultat en PNG.
 *
 * Usage : node scripts/build-og-cards.mjs [--browser "C:\...\msedge.exe"]
 * Sans `--browser`, essaie les emplacements standards de Chrome/Edge.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const LOCALES = {
  fr: { rtl: false, heading: "NunitoSans-800.ttf", body: "Poppins-400.ttf" },
  en: { rtl: false, heading: "NunitoSans-800.ttf", body: "Poppins-400.ttf" },
  ar: { rtl: true, heading: "Cairo-800.ttf", body: "Cairo-400.ttf" },
};

const b64 = (path) => readFileSync(path).toString("base64");
const logoB64 = b64(join(ROOT, "lib/og-fonts/logo-mark.png"));

function buildHtml(locale) {
  const dict = JSON.parse(readFileSync(join(ROOT, `messages/${locale}.json`), "utf8"));
  const { hero } = dict;
  const cfg = LOCALES[locale];
  const headingB64 = b64(join(ROOT, "lib/og-fonts", cfg.heading));
  const bodyB64 = b64(join(ROOT, "lib/og-fonts", cfg.body));

  return `<!doctype html>
<html dir="${cfg.rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: 'Heading'; src: url(data:font/ttf;base64,${headingB64}) format('truetype'); font-weight: 800; }
  @font-face { font-family: 'Body'; src: url(data:font/ttf;base64,${bodyB64}) format('truetype'); font-weight: 400; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; background: #000; overflow: hidden; }
  .card { width: 1200px; height: 630px; background: #000; position: relative; display: flex; flex-direction: column; padding: 64px; font-family: 'Body', sans-serif; }
  .glow { position: absolute; ${cfg.rtl ? "left" : "right"}: -220px; bottom: -220px; width: 760px; height: 760px; border-radius: 9999px; background: radial-gradient(circle, rgba(175,247,15,0.32), rgba(175,247,15,0) 70%); }
  .brand { display: flex; align-items: center; gap: 20px; }
  .brand img { width: 64px; height: 64px; display: block; }
  .brand span { font-family: 'Heading', sans-serif; font-weight: 800; font-size: 32px; color: #fff; }
  .spacer { flex: 1; }
  .titleblock { display: flex; flex-direction: column; gap: 20px; max-width: 1000px; }
  .line { font-family: 'Heading', sans-serif; font-weight: 800; font-size: 66px; line-height: 1.08; color: #fff; }
  .line2row { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; }
  .pill { font-family: 'Heading', sans-serif; font-weight: 800; font-size: 66px; line-height: 1.08; color: #aff70f; border: 3px solid #aff70f; border-radius: 9999px; padding: 2px 32px; }
  .lead { font-family: 'Body', sans-serif; font-size: 27px; line-height: 1.5; color: #ccc; max-width: 860px; margin-top: 12px; }
  .footer { display: flex; align-items: center; gap: 14px; }
  .dot { width: 10px; height: 10px; border-radius: 9999px; background: #aff70f; }
  .footer span { font-family: 'Body', sans-serif; font-size: 24px; color: #8c8c8c; }
</style>
</head>
<body>
  <div class="card">
    <div class="glow"></div>
    <div class="brand"><img src="data:image/png;base64,${logoB64}" /><span>Ifriqiya Soccer Star</span></div>
    <div class="spacer"></div>
    <div class="titleblock">
      <div class="line">${hero.titleLine1}</div>
      <div class="line2row"><div class="line">${hero.titleLine2}</div><div class="pill">${hero.titleAccent}</div></div>
      <div class="lead">${hero.leadMobile}</div>
    </div>
    <div class="spacer"></div>
    <div class="footer"><div class="dot"></div><span>Ifriqiya Soccer Star — iOS &amp; Android</span></div>
  </div>
</body>
</html>`;
}

function findBrowser() {
  const candidates = [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ];
  return candidates.find(existsSync);
}

async function send(ws, method, params = {}, sessionId, nextId) {
  return new Promise((resolve, reject) => {
    const msgId = nextId();
    const handler = (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.id === msgId) {
        ws.removeEventListener("message", handler);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ id: msgId, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

async function screenshotHtml(wsUrl, html, outPath) {
  let id = 0;
  const nextId = () => ++id;
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  const { targetId } = await send(ws, "Target.createTarget", { url: "about:blank" }, undefined, nextId);
  const { sessionId } = await send(ws, "Target.attachToTarget", { targetId, flatten: true }, undefined, nextId);
  await send(ws, "Page.enable", {}, sessionId, nextId);
  await send(ws, "Emulation.setDeviceMetricsOverride", { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false }, sessionId, nextId);
  const dataUrl = `data:text/html;base64,${Buffer.from(html).toString("base64")}`;
  await send(ws, "Page.navigate", { url: dataUrl }, sessionId, nextId);
  await new Promise((resolve) => {
    const handler = (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.method === "Page.loadEventFired" && msg.sessionId === sessionId) {
        ws.removeEventListener("message", handler);
        resolve();
      }
    };
    ws.addEventListener("message", handler);
  });
  await new Promise((r) => setTimeout(r, 500));
  const shot = await send(ws, "Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } }, sessionId, nextId);
  writeFileSync(outPath, Buffer.from(shot.data, "base64"));
  await send(ws, "Target.closeTarget", { targetId }, undefined, nextId);
  ws.close();
}

async function main() {
  const browserArg = process.argv.includes("--browser")
    ? process.argv[process.argv.indexOf("--browser") + 1]
    : findBrowser();
  if (!browserArg) {
    console.error("Aucun Chrome/Edge trouve. Passez son chemin avec --browser \"<chemin>\".");
    process.exit(1);
  }

  const port = 9222 + Math.floor(Math.random() * 1000);
  const userDataDir = join(tmpdir(), `og-card-build-${port}`);
  const child = spawn(browserArg, [
    "--headless=new",
    "--disable-gpu",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
  ]);

  try {
    let wsUrl;
    for (let attempt = 0; attempt < 15 && !wsUrl; attempt++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const res = await fetch(`http://localhost:${port}/json/version`);
        wsUrl = (await res.json()).webSocketDebuggerUrl;
      } catch {
        // pas encore pret
      }
    }
    if (!wsUrl) throw new Error("Le navigateur headless n'a pas demarre a temps.");

    mkdirSync(join(ROOT, "public/og"), { recursive: true });
    const sharp = (await import("sharp")).default;
    for (const locale of Object.keys(LOCALES)) {
      const html = buildHtml(locale);
      const out = join(ROOT, "public/og", `${locale}.png`);
      await screenshotHtml(wsUrl, html, out);
      // Recompresse sans perte : le PNG brut de la capture pese 3x plus que
      // necessaire (~170 Ko contre ~60 Ko une fois la compression maximale).
      const recompressed = await sharp(out).png({ compressionLevel: 9, effort: 10 }).toBuffer();
      writeFileSync(out, recompressed);
      console.log(`public/og/${locale}.png regenere (${recompressed.length} octets)`);
    }
  } finally {
    child.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
