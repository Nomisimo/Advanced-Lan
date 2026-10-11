"use strict";
// Bilderkennung: vergleicht Bereiche des Spielbilds mit Frames, die der Nutzer im Editor aus einer eigenen Aufnahme auswählt,
// und optional mit einem Wort, das dort stehen muss (Texterkennung).
// Jeder Bereich (relativ zum Bild 0…1) wird auf SIG_B × SIG_H Pixel verkleinert; das ist seine Signatur.
// Verglichen wird mit der normierten Kreuzkorrelation (−1…1): unabhängig von Helligkeit und Kontrast, empfindlich für Form.
// Reine Funktionen ohne Node- und Browser-Abhängigkeiten: laufen im Hauptprozess, im Erkennungsfenster, im Editor und in den Tests.

const SIG_B = 32, SIG_H = 12;
const SIG_LAENGE = SIG_B * SIG_H;

// RGBA-Pixel (ImageData.data) mit der Breite b → Graustufen-Signatur SIG_B × SIG_H (Mittelwert je Block)
function signatur(rgba, b, h) {
  const out = new Uint8Array(SIG_LAENGE);
  for (let sy = 0; sy < SIG_H; sy++) {
    const y0 = Math.floor((sy * h) / SIG_H), y1 = Math.max(y0 + 1, Math.floor(((sy + 1) * h) / SIG_H));
    for (let sx = 0; sx < SIG_B; sx++) {
      const x0 = Math.floor((sx * b) / SIG_B), x1 = Math.max(x0 + 1, Math.floor(((sx + 1) * b) / SIG_B));
      let s = 0, n = 0;
      for (let y = y0; y < y1 && y < h; y++) for (let x = x0; x < x1 && x < b; x++) {
        const i = (y * b + x) * 4;
        s += rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29;
        n++;
      }
      out[sy * SIG_B + sx] = n ? Math.round(s / n / 256) : 0;
    }
  }
  return out;
}

// Mittelwert 0, Länge 1. Fast einfarbige Bereiche (schwarzes Bild, Ladebildschirm) haben keine Form: null
function normiert(sig) {
  if (!sig || sig.length !== SIG_LAENGE) return null;
  let s = 0;
  for (let i = 0; i < sig.length; i++) s += sig[i];
  const m = s / sig.length;
  const v = new Float32Array(sig.length);
  let q = 0;
  for (let i = 0; i < sig.length; i++) { v[i] = sig[i] - m; q += v[i] * v[i]; }
  if (Math.sqrt(q / sig.length) < 4) return null;
  const n = Math.sqrt(q);
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

const aehnlichkeit = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

// Ist das Bild schwarz oder eingefroren? (Exklusives Vollbild lässt sich oft nicht aufnehmen.) rgba eines verkleinerten Gesamtbilds
function bildLeer(rgba) {
  let max = 0;
  for (let i = 0; i < rgba.length; i += 4) max = Math.max(max, rgba[i], rgba[i + 1], rgba[i + 2]);
  return max < 12;
}

// Signaturen speichern sich als Base64 in den Einstellungen und in Exportdateien
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function kodieren(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=") + (i + 2 < bytes.length ? B64[n & 63] : "=");
  }
  return s;
}
function dekodieren(s) {
  if (typeof s !== "string") return null;
  const t = s.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((t.length * 3) / 4));
  let j = 0;
  const w = (c) => (c === undefined ? 0 : Math.max(0, B64.indexOf(c)));
  for (let i = 0; i < t.length; i += 4) {
    const n = (w(t[i]) << 18) | (w(t[i + 1]) << 12) | (w(t[i + 2]) << 6) | w(t[i + 3]);
    if (j < out.length) out[j++] = (n >> 16) & 255;
    if (j < out.length) out[j++] = (n >> 8) & 255;
    if (j < out.length) out[j++] = n & 255;
  }
  return out;
}

// Bereich begrenzen: innerhalb des Bildes, mindestens 0,5 % groß
const zahl01 = (x, std) => (Number.isFinite(Number(x)) ? Math.min(1, Math.max(0, Number(x))) : std);
function region(r, std = { x: 0.4, y: 0.4, b: 0.2, h: 0.1 }) {
  const x = Math.min(0.995, zahl01(r?.x, std.x)), y = Math.min(0.995, zahl01(r?.y, std.y));
  const b = Math.max(0.005, Math.min(1 - x, zahl01(r?.b, std.b))), h = Math.max(0.005, Math.min(1 - y, zahl01(r?.h, std.h)));
  return { x, y, b, h };
}

// Woran hängt ein HUD-Element? Spiele skalieren ihr HUD mit der kürzeren Seite und hängen es an Rand oder Mitte.
const ANKER_H = ["links", "mitte", "rechts"], ANKER_V = ["oben", "mitte", "unten"];
function ankerVon(r) {
  const cx = r.x + r.b / 2, cy = r.y + r.h / 2;
  return { h: cx < 0.3 ? "links" : cx > 0.7 ? "rechts" : "mitte", v: cy < 0.3 ? "oben" : cy > 0.7 ? "unten" : "mitte" };
}

// Korrektur für ein anderes Seitenverhältnis: Bereich aus einem Bild von (von.b × von.h) Pixeln auf (nach.b × nach.h) umrechnen
function umrechnen(r, von, nach, anker = ankerVon(r)) {
  if (!von?.b || !von?.h || !nach?.b || !nach?.h) return region(r);
  const s = Math.min(nach.b / von.b, nach.h / von.h);
  const achse = (pos, groesse, alt, neu, a) => {
    const p = pos * alt, g = groesse * alt;
    const np = a === "links" || a === "oben" ? p * s : a === "rechts" || a === "unten" ? neu - (alt - p) * s : neu / 2 + (p - alt / 2) * s;
    return [np / neu, (g * s) / neu];
  };
  const [x, b] = achse(r.x, r.b, von.b, nach.b, anker.h);
  const [y, h] = achse(r.y, r.h, von.h, nach.h, anker.v);
  return region({ x, y, b, h });
}

// Texterkennung: großzügig vergleichen (Groß/klein, Umlaute, Satzzeichen, typische Verwechsler wie 0/O und 1/I)
const textNorm = (t) => String(t || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/0/g, "O").replace(/[1|]/g, "I").replace(/5/g, "S").replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
// Mehrere erlaubte Wörter mit „|“ trennen, z. B. „ROUND WIN|RUNDE GEWONNEN“
function textPasst(gelesen, erwartet) {
  const g = textNorm(gelesen);
  if (!g) return false;
  return String(erwartet || "").split("|").map(textNorm).filter(Boolean).some((w) => g.includes(w));
}

// Erkennt Aktionen über mehrere Bilder hinweg.
// aktionen: [{ id, gruppe?, pause?, schwelle?, text? }]  gruppe: Aktionen am selben Ort, nur die ähnlichste zählt
// Eine Aktion meldet sich, wenn sie `treffer` Bilder in Folge passt. Danach erst wieder, wenn sie verschwunden war
// (unter Schwelle − 0,1) oder ein anderer ihrer Frames passt (z. B. Kill-Banner mit einem Kill mehr).
class BildErkennung {
  constructor({ aktionen = [], schwelle = 0.8, treffer = 2 } = {}) {
    this.aktionen = aktionen;
    this.schwelle = schwelle;
    this.treffer = treffer;
    this.vorlagen = {}; // id → [Float32Array]
    this.z = {};
    for (const a of aktionen) this.z[a.id] = { n: 0, idx: -1, scharf: true, letzt: -Infinity, gemeldet: -1 };
  }

  // vorlagen: { id: [Uint8Array | Base64-Text] }
  setVorlagen(vorlagen) {
    this.vorlagen = {};
    for (const a of this.aktionen) {
      const liste = (vorlagen?.[a.id] || []).map((v) => normiert(typeof v === "string" ? dekodieren(v) : v)).filter(Boolean);
      if (liste.length) this.vorlagen[a.id] = liste;
    }
  }

  // Aktionen, die etwas zum Vergleichen haben
  aktiv(a) { return !!(this.vorlagen[a.id] || a.text); }

  // sigs: { id: Uint8Array } aus einem Bild, texte: { id: zuletzt gelesener Text }
  // → { erkannt: [{ id, wert, vorlage }], werte: { id: Ähnlichkeit 0…1 } }
  frame(sigs, now = Date.now(), texte = {}) {
    const werte = {}, beste = {};
    for (const a of this.aktionen) {
      if (!this.aktiv(a)) continue;
      const v = this.vorlagen[a.id];
      let w = 1, idx = 0;
      if (v) {
        const s = normiert(sigs?.[a.id]);
        w = -1; idx = -1;
        if (s) v.forEach((t, i) => { const x = aehnlichkeit(s, t); if (x > w) { w = x; idx = i; } });
      }
      // Text muss zusätzlich passen; ohne Treffer zählt die Aktion als nicht sichtbar
      if (a.text && !textPasst(texte[a.id], a.text)) w = Math.min(w, 0);
      werte[a.id] = Math.max(0, Math.round(w * 1000) / 1000);
      beste[a.id] = idx;
    }
    const gewinner = {};
    for (const a of this.aktionen) if (a.gruppe && werte[a.id] != null && (gewinner[a.gruppe] == null || werte[a.id] > werte[gewinner[a.gruppe]])) gewinner[a.gruppe] = a.id;

    const erkannt = [];
    for (const a of this.aktionen) {
      const z = this.z[a.id], w = werte[a.id], sw = a.schwelle ?? this.schwelle;
      if (!z) continue;
      const treffer = w != null && w >= sw && (!a.gruppe || gewinner[a.gruppe] === a.id);
      if (!treffer) {
        z.n = 0; z.idx = -1;
        if (w == null || w < sw - 0.1) { z.scharf = true; z.gemeldet = -1; }
        continue;
      }
      z.n = beste[a.id] === z.idx ? z.n + 1 : 1;
      z.idx = beste[a.id];
      const neu = z.scharf || z.idx !== z.gemeldet;
      if (z.n >= this.treffer && neu && now - z.letzt >= (a.pause ?? 2000)) {
        z.scharf = false; z.gemeldet = z.idx; z.letzt = now;
        erkannt.push({ id: a.id, wert: w, vorlage: z.idx });
      }
    }
    return { erkannt, werte };
  }
}

module.exports = { SIG_B, SIG_H, SIG_LAENGE, signatur, normiert, aehnlichkeit, bildLeer, kodieren, dekodieren, region, ANKER_H, ANKER_V, ankerVon, umrechnen, textNorm, textPasst, BildErkennung };
