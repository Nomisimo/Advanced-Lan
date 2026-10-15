"use strict";
// Layout des Game-Stats-Screens: welche Anzeigen und Texte wo auf der 1920×1080-Fläche stehen.
// Der Editor in der Regie bearbeitet es, Pop-out-Fenster und NDI-Stream zeigen es direkt an.
// Reine Funktionen, laufen in der Oberfläche, im Hauptprozess und in den Tests.

const B = 1920, H = 1080;
const MIN = 40; // kleinste Breite und Höhe eines Elements
const MAX_TEXTE = 30;
const TEXT_MAX = 500;

// Anzeigen des Screens; jede gibt es genau einmal. titel: Überschrift, die man im Editor ändern kann
const ANZEIGEN = [
  { typ: "logo", label: "Logo und Titel", x: 44, y: 34, b: 560, h: 78, titel: "ADVANCED LAN" },
  { typ: "spiel", label: "Aktives Spiel", x: 640, y: 34, b: 640, h: 78 },
  { typ: "session", label: "Session-Name", x: 1300, y: 34, b: 380, h: 78 },
  { typ: "live", label: "LIVE-Anzeige", x: 1700, y: 34, b: 176, h: 78 },
  { typ: "spielstand", label: "Spielstand", x: 44, y: 138, b: 1832, h: 330 },
  { typ: "zahlen", label: "Zahlen des Matches", x: 44, y: 494, b: 1832, h: 116 },
  { typ: "bestenliste", label: "Beste Spieler", x: 44, y: 636, b: 1046, h: 410, titel: "Beste Spieler" },
  { typ: "events", label: "Letzte Events", x: 1116, y: 636, b: 760, h: 410, titel: "Letzte Events" },
];
const ANZEIGE = Object.fromEntries(ANZEIGEN.map((a) => [a.typ, a]));
const HINTERGRUENDE = [["verlauf", "Verlauf (Standard)"], ["schwarz", "Schwarz"], ["gruen", "Grün (Chroma-Key)"]];
const AUSRICHTUNG = ["links", "mitte", "rechts"];
// Platzhalter in Texten: {spiel} wird zu „Counter-Strike 2“ usw.
const PLATZHALTER = [["spiel", "Name des aktiven Spiels"], ["kurz", "Kürzel des Spiels"], ["session", "Name der Session"], ["team1", "Team links"], ["team2", "Team rechts"], ["score1", "Punkte links"], ["score2", "Punkte rechts"], ["uhrzeit", "Uhrzeit"], ["datum", "Datum"]];

const zahl = (v, std, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std; };
const farbe = (v, std) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : std);

let zaehler = 0;
const neueId = (p = "t") => `${p}${Date.now().toString(36)}${(zaehler++).toString(36)}`;

function anzeigeStandard(a) {
  const { typ, x, y, b, h, titel } = a;
  return { id: typ, typ, x, y, b, h, sichtbar: true, ...(titel ? { titel } : {}) };
}

function neuerText(over = {}) {
  return { id: neueId(), typ: "text", x: 660, y: 470, b: 600, h: 120, sichtbar: true, text: "Neuer Text", groesse: 64, farbe: "#ffffff", fett: true, ausrichtung: "mitte", panel: false, ...over };
}

function standardLayout() {
  return { hintergrund: "verlauf", elemente: ANZEIGEN.map(anzeigeStandard) };
}

// Position und Größe in die Fläche bringen
function kasten(e) {
  const b = zahl(e.b, MIN, MIN, B), h = zahl(e.h, MIN, MIN, H);
  return { x: zahl(e.x, 0, 0, B - b), y: zahl(e.y, 0, 0, H - h), b, h };
}

// Gespeichertes Layout prüfen: unbekannte Typen raus, jede Anzeige genau einmal (fehlende kommen dazu), Zahlen begrenzen
function migrateLayout(l) {
  const std = standardLayout();
  if (!l || typeof l !== "object" || !Array.isArray(l.elemente)) return std;
  const gesehen = new Set(), out = [];
  let texte = 0;
  for (const e of l.elemente) {
    if (!e || typeof e !== "object") continue;
    if (e.typ === "text") {
      if (texte >= MAX_TEXTE) continue;
      texte++;
      const id = typeof e.id === "string" && e.id && !gesehen.has(e.id) && !ANZEIGE[e.id] ? e.id.slice(0, 40) : neueId();
      gesehen.add(id);
      out.push({
        id, typ: "text", ...kasten(e), sichtbar: e.sichtbar !== false,
        text: typeof e.text === "string" ? e.text.slice(0, TEXT_MAX) : "",
        groesse: zahl(e.groesse, 64, 10, 400), farbe: farbe(e.farbe, "#ffffff"), fett: e.fett !== false,
        ausrichtung: AUSRICHTUNG.includes(e.ausrichtung) ? e.ausrichtung : "mitte", panel: !!e.panel,
      });
    } else if (ANZEIGE[e.typ] && !gesehen.has(e.typ)) {
      gesehen.add(e.typ);
      const a = ANZEIGE[e.typ];
      out.push({ id: e.typ, typ: e.typ, ...kasten(e), sichtbar: e.sichtbar !== false, ...(a.titel ? { titel: typeof e.titel === "string" ? e.titel.slice(0, 80) : a.titel } : {}) });
    }
  }
  for (const a of ANZEIGEN) if (!gesehen.has(a.typ)) out.push({ ...anzeigeStandard(a), sichtbar: false });
  return { hintergrund: HINTERGRUENDE.some(([k]) => k === l.hintergrund) ? l.hintergrund : "verlauf", elemente: out };
}

// Platzhalter ersetzen; unbekannte bleiben stehen, damit man den Tippfehler sieht
function textEinsetzen(text, werte) {
  return String(text || "").replace(/\{(\w+)\}/g, (m, k) => (werte && werte[k] != null && werte[k] !== "" ? String(werte[k]) : PLATZHALTER.some(([p]) => p === k) ? "" : m));
}

// Einrasten beim Ziehen: an das Raster und an Kanten und Mitten der Fläche und der anderen Elemente.
// k: { x, y, b, h } des gezogenen Elements, andere: Liste von Kästen, modus: "bewegen" oder Liste der gezogenen Kanten ("l","r","o","u").
// → { x, y, b, h, linien: [{ achse: "x"|"y", pos }] }
function einrasten(k, andere, { raster = 0, abstand = 8, kanten = null } = {}) {
  const ziele = { x: [0, B / 2, B], y: [0, H / 2, H] };
  for (const o of andere || []) { ziele.x.push(o.x, o.x + o.b / 2, o.x + o.b); ziele.y.push(o.y, o.y + o.h / 2, o.y + o.h); }
  const linien = [];
  const nah = (werte, achse) => {
    // werte: [[pos, anwenden(delta)]] → bestes Ziel innerhalb des Abstands
    let best = null;
    for (const [pos] of werte) for (const z of ziele[achse]) { const d = z - pos; if (Math.abs(d) <= abstand && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, z }; }
    return best;
  };
  const r = { ...k };
  const grid = (v) => (raster > 1 ? Math.round(v / raster) * raster : v);
  if (!kanten) {
    const bx = nah([[r.x], [r.x + r.b / 2], [r.x + r.b]], "x");
    r.x = bx ? r.x + bx.d : grid(r.x);
    if (bx) linien.push({ achse: "x", pos: bx.z });
    const by = nah([[r.y], [r.y + r.h / 2], [r.y + r.h]], "y");
    r.y = by ? r.y + by.d : grid(r.y);
    if (by) linien.push({ achse: "y", pos: by.z });
  } else {
    if (kanten.includes("l")) { const rechts = r.x + r.b; const t = nah([[r.x]], "x"); r.x = t ? t.z : grid(r.x); if (t) linien.push({ achse: "x", pos: t.z }); r.b = rechts - r.x; }
    if (kanten.includes("r")) { const t = nah([[r.x + r.b]], "x"); const e = t ? t.z : grid(r.x + r.b); if (t) linien.push({ achse: "x", pos: t.z }); r.b = e - r.x; }
    if (kanten.includes("o")) { const unten = r.y + r.h; const t = nah([[r.y]], "y"); r.y = t ? t.z : grid(r.y); if (t) linien.push({ achse: "y", pos: t.z }); r.h = unten - r.y; }
    if (kanten.includes("u")) { const t = nah([[r.y + r.h]], "y"); const e = t ? t.z : grid(r.y + r.h); if (t) linien.push({ achse: "y", pos: t.z }); r.h = e - r.y; }
  }
  // In der Fläche halten, Mindestgröße
  r.b = Math.max(MIN, Math.min(B, Math.round(r.b))); r.h = Math.max(MIN, Math.min(H, Math.round(r.h)));
  r.x = Math.max(0, Math.min(B - r.b, Math.round(r.x))); r.y = Math.max(0, Math.min(H - r.h, Math.round(r.y)));
  return { ...r, linien };
}

module.exports = { B, H, MIN, MAX_TEXTE, ANZEIGEN, ANZEIGE, HINTERGRUENDE, AUSRICHTUNG, PLATZHALTER, standardLayout, migrateLayout, neuerText, textEinsetzen, einrasten };
