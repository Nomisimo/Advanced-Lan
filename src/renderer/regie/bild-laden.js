// Bilder für den Stats-Screen vorbereiten: auf höchstens 1920 px verkleinern und als WebP (mit Transparenz) kodieren,
// damit Layout und Einstellungen klein bleiben. Ergebnis: Data-URL, die Pop-out-Fenster und NDI direkt anzeigen.
import { BILD_MAX } from "../../core/stats-layout.js";

export const BILD_TYPEN = "image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml";

// Dateiauswahl öffnen → File oder null
export function bildWaehlen() {
  return new Promise((ok) => {
    const i = document.createElement("input");
    i.type = "file"; i.accept = BILD_TYPEN;
    i.onchange = () => ok(i.files?.[0] || null);
    i.click();
  });
}

function ladeBild(file) {
  return new Promise((ok, fehler) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); fehler(new Error("Bild lässt sich nicht lesen")); };
    img.src = url;
  });
}

function kodieren(img, max, qualitaet) {
  const w0 = img.naturalWidth || img.width || 1920, h0 = img.naturalHeight || img.height || 1080;
  const f = Math.min(1, max / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * f)), h = Math.max(1, Math.round(h0 * f));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(img, 0, 0, w, h);
  let url = c.toDataURL("image/webp", qualitaet);
  if (!url.startsWith("data:image/webp")) url = c.toDataURL("image/png"); // ohne WebP-Kodierer
  return { url, b: w, h };
}

// File → { url, b, h }; wirft bei unlesbaren oder zu großen Bildern
export async function bildVorbereiten(file, max = 1920) {
  if (!file || !/^image\//.test(file.type || "image/")) throw new Error("Keine Bilddatei");
  const img = await ladeBild(file);
  for (const [m, q] of [[max, 0.9], [max, 0.8], [Math.round(max * 0.7), 0.8], [Math.round(max * 0.5), 0.75]]) {
    const r = kodieren(img, m, q);
    if (r.url.length <= BILD_MAX) return r;
  }
  throw new Error("Bild ist zu groß");
}
