// Bildbereiche aus Video oder Bild lesen: für das Erkennungsfenster und den Editor gleich, damit Frames und Live-Bild vergleichbar sind.
import { signatur, bildLeer } from "../core/bild-erkennung.js";

const leinwand = (b, h) => { const c = document.createElement("canvas"); c.width = b; c.height = h; return c; };
const groesse = (q) => ({ b: q.videoWidth || q.naturalWidth || q.width || 0, h: q.videoHeight || q.naturalHeight || q.height || 0 });
const pixel = (q, r) => { const g = groesse(q); return { sx: Math.round(r.x * g.b), sy: Math.round(r.y * g.h), sb: Math.max(1, Math.round(r.b * g.b)), sh: Math.max(1, Math.round(r.h * g.h)) }; };

// Ein wiederverwendetes Canvas: höchstens 128 × 48 Pixel je Bereich, danach Blockmittel auf die Signatur
const arbeit = typeof document !== "undefined" ? leinwand(128, 48) : null;
export function sigAus(q, r) {
  const { sx, sy, sb, sh } = pixel(q, r);
  const b = Math.min(128, sb), h = Math.min(48, sh);
  const ctx = arbeit.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(q, sx, sy, sb, sh, 0, 0, b, h);
  return signatur(ctx.getImageData(0, 0, b, h).data, b, h);
}

// Ist das ganze Bild schwarz? (exklusives Vollbild)
export function istLeer(q) {
  const g = groesse(q);
  if (!g.b) return true;
  const ctx = arbeit.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(q, 0, 0, g.b, g.h, 0, 0, 64, 36);
  return bildLeer(ctx.getImageData(0, 0, 64, 36).data);
}

// Bereich als kleines Vorschaubild (für die Frame-Liste im Editor)
export function bildAus(q, r, maxB = 220) {
  const { sx, sy, sb, sh } = pixel(q, r);
  const f = Math.min(1, maxB / sb);
  const c = leinwand(Math.max(1, Math.round(sb * f)), Math.max(1, Math.round(sh * f)));
  c.getContext("2d").drawImage(q, sx, sy, sb, sh, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}

// Bereich als PNG für die Texterkennung: klein gelesene Schrift auf mindestens 60 Pixel Höhe vergrößern
export async function pngAus(q, r) {
  const { sx, sy, sb, sh } = pixel(q, r);
  const f = Math.min(3, Math.max(1, 60 / sh), 900 / sb);
  const c = leinwand(Math.max(1, Math.round(sb * f)), Math.max(1, Math.round(sh * f)));
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(q, sx, sy, sb, sh, 0, 0, c.width, c.height);
  const blob = await new Promise((ok) => c.toBlob(ok, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

export const bildGroesse = groesse;
