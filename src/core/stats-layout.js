"use strict";
// Layout des Game-Stats-Screens: welche Anzeigen und Texte wo auf der Fläche stehen.
// Die Fläche ist standardmäßig 1920×1080, jeder Screen kann eine eigene Größe in Pixeln haben (flaeche = { b, h }).
// Der Editor in der Regie bearbeitet es, Pop-out-Fenster und NDI-Stream zeigen es direkt an.
// Reine Funktionen, laufen in der Oberfläche, im Hauptprozess und in den Tests.

const B = 1920, H = 1080;
const F0 = { b: B, h: H };
const MIN = 40; // kleinste Breite und Höhe eines Elements
const MAX_TEXTE = 30;
const MAX_BILDER = 12; // Bild-Blöcke
const MAX_SPIELER = 12; // Spieler-Karten
const MAX_WERTE = 30; // Einzelwerte
const TEXT_MAX = 500;
const BILD_MAX = 4_000_000; // Zeichen einer Bild-Data-URL (die Oberfläche verkleinert Bilder vorher auf höchstens 1920 px)
const BILD_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
const ZOOM_MIN = 25, ZOOM_MAX = 300;

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
  // Optionale Anzeigen: im Standard-Layout ausgeblendet
  { typ: "teams", label: "Teams und Spieler", x: 44, y: 636, b: 1046, h: 410, titel: "Teams", aus: true },
  { typ: "mvp", label: "MVP und Ranking (Endscreen)", x: 44, y: 138, b: 1832, h: 908, titel: "MVP", aus: true },
];
const ANZEIGE = Object.fromEntries(ANZEIGEN.map((a) => [a.typ, a]));
const HINTERGRUENDE = [["verlauf", "Verlauf (Standard)"], ["schwarz", "Schwarz"], ["gruen", "Grün (Chroma-Key)"], ["transparent", "Transparent (Alpha)"], ["farbe", "Eigene Farbe"], ["eigen", "Eigener Verlauf"], ["bild", "Eigenes Bild"]];
const VERLAUF_ARTEN = [["linear", "Linear"], ["radial", "Radial"], ["konisch", "Konisch"]];
const PASSUNGEN = [["fuellen", "Füllen (zuschneiden)"], ["einpassen", "Einpassen (ganz zeigen)"], ["strecken", "Strecken"]];
const MAX_STOPPS = 8;
// Vorlagen für den Verlauf-Editor
const VERLAUF_VORLAGEN = [
  ["Lila Nacht", { art: "linear", winkel: 135, x: 50, y: 50, stopps: [{ farbe: "#2a1454", pos: 0, alpha: 100 }, { farbe: "#131118", pos: 55, alpha: 100 }, { farbe: "#0c0a10", pos: 100, alpha: 100 }] }],
  ["Neon", { art: "linear", winkel: 120, x: 50, y: 50, stopps: [{ farbe: "#9d5cff", pos: 0, alpha: 100 }, { farbe: "#ff4fd8", pos: 50, alpha: 100 }, { farbe: "#4ea1ff", pos: 100, alpha: 100 }] }],
  ["Sonnenuntergang", { art: "linear", winkel: 180, x: 50, y: 50, stopps: [{ farbe: "#ff8a1f", pos: 0, alpha: 100 }, { farbe: "#ff5d5d", pos: 45, alpha: 100 }, { farbe: "#2a1454", pos: 100, alpha: 100 }] }],
  ["Ozean", { art: "radial", winkel: 0, x: 50, y: 0, stopps: [{ farbe: "#1f6fd1", pos: 0, alpha: 100 }, { farbe: "#0b2a4a", pos: 60, alpha: 100 }, { farbe: "#05101c", pos: 100, alpha: 100 }] }],
  ["Spotlight", { art: "radial", winkel: 0, x: 50, y: 40, stopps: [{ farbe: "#3a3647", pos: 0, alpha: 100 }, { farbe: "#131118", pos: 70, alpha: 100 }, { farbe: "#000000", pos: 100, alpha: 100 }] }],
  ["Feuer", { art: "linear", winkel: 0, x: 50, y: 50, stopps: [{ farbe: "#ffcf3d", pos: 0, alpha: 100 }, { farbe: "#ff5d1f", pos: 35, alpha: 100 }, { farbe: "#1a0505", pos: 100, alpha: 100 }] }],
];
const AUSRICHTUNG = ["links", "mitte", "rechts"];
// Platzhalter in Texten: {spiel} wird zu „Counter-Strike 2“ usw.
const PLATZHALTER = [["spiel", "Name des aktiven Spiels"], ["kurz", "Kürzel des Spiels"], ["session", "Name der Session"], ["team1", "Team links"], ["team2", "Team rechts"], ["score1", "Punkte links"], ["score2", "Punkte rechts"], ["runde", "Runde"], ["kills", "Kills im Match"], ["tode", "Tode im Match"], ["headshots", "Headshots im Match"], ["uhrzeit", "Uhrzeit"], ["datum", "Datum"]];

const zahl = (v, std, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std; };
// Größe der Fläche: ohne Angabe 1920×1080, nie kleiner als ein Element
const flaecheVon = (f) => ({ b: zahl(f?.b, B, MIN, 8192), h: zahl(f?.h, H, MIN, 8192) });
const farbe = (v, std) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : std);

// Darstellung, die jedes Element hat: Deckkraft des ganzen Elements, Transparenz und Ecken der Kacheln, Rahmen,
// Schrift- und Akzentfarbe ("" = Standard der Anzeige)
const STIL = { deckkraft: 100, kachel: 92, ecken: 18, rahmen: true, schrift: "", akzent: "" };
function migrateStil(e) {
  const f = (v) => (v === "" || v == null ? "" : farbe(v, ""));
  return { deckkraft: zahl(e.deckkraft, 100, 0, 100), kachel: zahl(e.kachel, STIL.kachel, 0, 100), ecken: zahl(e.ecken, STIL.ecken, 0, 80), rahmen: e.rahmen !== false, schrift: f(e.schrift), akzent: f(e.akzent) };
}
// Eigene Einstellungen einzelner Anzeigen (0 bei Zeilen/Anzahl: automatisch nach Höhe)
// Texte (Zeichenketten) können Platzhalter wie {spiel} enthalten, leer = nichts anzeigen
const OPTIONEN = {
  logo: { icon: true },
  spiel: { kurz: true, name: true, textOhne: "" },
  session: { textOhne: "" },
  live: { punkt: true, textAn: true, textLive: "LIVE", textWartet: "WARTET" },
  spielstand: { teamnamen: true, mitteKlein: true, chips: true, textSieger: "Sieger", textWarten: "Warten auf Spieldaten …", wartenKlein: true },
  zahlen: { labels: true },
  bestenliste: { zeilen: 0, kopf: true, textLeer: "Noch keine Spielerdaten." },
  events: { anzahl: 0, spieler: true, zeit: true, textLeer: "Noch keine Events." },
  teams: { kopf: true, zahlen: true, textLeer: "Noch keine Spieler." },
  mvp: { nurEnde: false, punkte: true, kd: true, headshots: true, team: true, zeilen: 0, textLeer: "Noch keine Spielerdaten.", textMvp: "MVP des Matches" },
};
// Spieler-Karte: welcher Spieler (quelle "rang" + rang oder PC-ID) und welche Zahlen
const SPIELER_OPTIONEN = { team: true, seite: true, kills: true, tode: true, headshots: true, kd: true };
// Einzelwert: welcher Wert (core/stats-screen.js WERTE), für Spielerwerte welcher Spieler, Beschriftung
const WERT_KEYS = ["score1", "score2", "team1", "team2", "runde", "kills", "tode", "headshots", "aces", "sp.name", "sp.kills", "sp.tode", "sp.headshots", "sp.kd", "sp.team", "sp.seite"];
const quelleVon = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : "rang");
const OPTION_TEXT_MAX = 80;
function migrateOptionen(typ, e) {
  const o = OPTIONEN[typ];
  if (!o) return {};
  return Object.fromEntries(Object.entries(o).map(([k, std]) => [k,
    typeof std === "boolean" ? e[k] !== false : typeof std === "string" ? (typeof e[k] === "string" ? e[k].slice(0, OPTION_TEXT_MAX) : std) : zahl(e[k], std, 0, 20)]));
}

let zaehler = 0;
const neueId = (p = "t") => `${p}${Date.now().toString(36)}${(zaehler++).toString(36)}`;

function anzeigeStandard(a) {
  const { typ, x, y, b, h, titel, aus } = a;
  return { id: typ, typ, x, y, b, h, sichtbar: !aus, skalieren: true, zoom: 100, ...(titel ? { titel } : {}), ...STIL, ...(OPTIONEN[typ] || {}) };
}

function neuerText(over = {}, flaeche) {
  const F = flaecheVon(flaeche);
  const b = Math.min(600, F.b), h = Math.min(120, F.h);
  return { id: neueId(), typ: "text", x: Math.round((F.b - b) / 2), y: Math.round((F.h - h) / 2), b, h, sichtbar: true, text: "Neuer Text", groesse: 64, farbe: "#ffffff", fett: true, ausrichtung: "mitte", panel: false, skalieren: true, ...STIL, ...over };
}

// Bild-Block: bild ist der Schlüssel in layout.bilder. b0 × h0: Seitenverhältnis des Bildes, um den Block passend zu setzen
function neuesBild(bild, { b0 = 16, h0 = 9, flaeche, ...over } = {}) {
  const F = flaecheVon(flaeche);
  const v = b0 > 0 && h0 > 0 ? b0 / h0 : 16 / 9;
  // Auf 1920×1080 höchstens 640×480, auf anderen Screens ein Drittel der Fläche, sehr kleine Screens ganz
  const gross = F.b >= 960 && F.h >= 540;
  const mb = gross ? Math.round(F.b / 3) : F.b, mh = gross ? Math.round(F.h * 4 / 9) : F.h;
  let b = mb, h = Math.round(mb / v);
  if (h > mh) { h = mh; b = Math.round(mh * v); }
  b = Math.max(MIN, Math.min(F.b, b)); h = Math.max(MIN, Math.min(F.h, h));
  return { id: neueId("i"), typ: "bild", x: Math.round((F.b - b) / 2), y: Math.round((F.h - h) / 2), b, h, sichtbar: true, bild, passung: "einpassen", radius: 0, panel: false, ...STIL, ...over };
}

function standardVerlauf() {
  return JSON.parse(JSON.stringify(VERLAUF_VORLAGEN[0][1]));
}

// Spieler-Karte: Name, Team und Zahlen eines Spielers (bester, zweitbester … oder ein fester PC)
function neuerSpieler(over = {}, flaeche) {
  const F = flaecheVon(flaeche);
  const b = Math.min(680, F.b), h = Math.min(170, F.h);
  return { id: neueId("p"), typ: "spieler", x: Math.round((F.b - b) / 2), y: Math.round((F.h - h) / 2), b, h, sichtbar: true, quelle: "rang", rang: 1, ...SPIELER_OPTIONEN, ...STIL, ...over };
}

// Einzelwert: eine Zahl oder ein Name groß, z. B. Punkte links, Runde oder Kills eines Spielers
function neuerWert(over = {}, flaeche) {
  const F = flaecheVon(flaeche);
  const b = Math.min(320, F.b), h = Math.min(180, F.h);
  return { id: neueId("w"), typ: "wert", x: Math.round((F.b - b) / 2), y: Math.round((F.h - h) / 2), b, h, sichtbar: true, wert: "score1", quelle: "rang", rang: 1,
    beschriftung: true, text: "", farbe: "#ffffff", ausrichtung: "mitte", panel: false, ...STIL, ...over };
}

function standardHg() {
  return { farbe: "#1b1922", verlauf: standardVerlauf(), bild: "", passung: "fuellen", abdunkeln: 0, verlaufDrueber: false };
}

// Standard-Layout; auf einer anderen Fläche werden die Anzeigen anteilig gesetzt
function standardLayout(flaeche) {
  const F = flaecheVon(flaeche);
  const fx = F.b / B, fy = F.h / H;
  const elemente = ANZEIGEN.map(anzeigeStandard).map((e) => (fx === 1 && fy === 1 ? e : { ...e, ...kasten({ x: e.x * fx, y: e.y * fy, b: e.b * fx, h: e.h * fy }, F) }));
  return { hintergrund: "verlauf", hg: standardHg(), bilder: {}, elemente };
}

// Layout mit nur einem Element, das die ganze Fläche füllt (zum Streamen einzelner Elemente), Hintergrund transparent.
// typ: eine Anzeige aus ANZEIGEN oder "text"; sonst ist nichts sichtbar
function einzelLayout(typ, flaeche) {
  const F = flaecheVon(flaeche);
  const voll = { x: 0, y: 0, b: F.b, h: F.h };
  const elemente = ANZEIGEN.map(anzeigeStandard).map((e) => (e.typ === typ ? { ...e, ...voll } : { ...e, ...kasten(e, F), sichtbar: false }));
  if (typ === "text") elemente.push(neuerText({ ...voll, text: "{score1} : {score2}", groesse: Math.max(10, Math.min(400, Math.round(F.h * 0.6))) }, F));
  if (typ === "spieler") elemente.push(neuerSpieler(voll, F));
  if (typ === "wert") elemente.push(neuerWert(voll, F));
  return { hintergrund: "transparent", hg: standardHg(), bilder: {}, elemente };
}

const istBild = (v) => typeof v === "string" && v.length <= BILD_MAX && BILD_RE.test(v);
const bildId = (v) => (typeof v === "string" && /^[\w-]{1,40}$/.test(v) ? v : "");

function migrateVerlauf(v) {
  const std = standardVerlauf();
  if (!v || typeof v !== "object") return std;
  let stopps = (Array.isArray(v.stopps) ? v.stopps : []).filter((st) => st && typeof st === "object").slice(0, MAX_STOPPS)
    .map((st) => ({ farbe: farbe(st.farbe, "#000000"), pos: zahl(st.pos, 0, 0, 100), alpha: zahl(st.alpha, 100, 0, 100) }));
  if (stopps.length < 2) stopps = std.stopps;
  stopps.sort((a, b) => a.pos - b.pos);
  return { art: VERLAUF_ARTEN.some(([k]) => k === v.art) ? v.art : "linear", winkel: zahl(v.winkel, 135, 0, 360), x: zahl(v.x, 50, 0, 100), y: zahl(v.y, 50, 0, 100), stopps };
}

function migrateHg(h) {
  const std = standardHg();
  if (!h || typeof h !== "object") return std;
  return { farbe: farbe(h.farbe, std.farbe), verlauf: migrateVerlauf(h.verlauf), bild: bildId(h.bild), passung: h.passung === "einpassen" ? "einpassen" : "fuellen", abdunkeln: zahl(h.abdunkeln, 0, 0, 90), verlaufDrueber: !!h.verlaufDrueber };
}

// #rrggbb und Deckkraft (0–100) → rgba(…)
function rgba(hex, alpha = 100) {
  const n = parseInt(farbe(hex, "#000000").slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.round(alpha) / 100})`;
}

// CSS des eigenen Verlaufs
function verlaufCss(v) {
  const m = migrateVerlauf(v);
  const st = m.stopps.map((s) => `${rgba(s.farbe, s.alpha)} ${s.pos}%`).join(", ");
  if (m.art === "radial") return `radial-gradient(ellipse farthest-corner at ${m.x}% ${m.y}%, ${st})`;
  if (m.art === "konisch") return `conic-gradient(from ${m.winkel}deg at ${m.x}% ${m.y}%, ${st})`;
  return `linear-gradient(${m.winkel}deg, ${st})`;
}

// Farbe an einer Stelle (0–100) des Verlaufs, für neue Farbstopps
function farbeBei(v, pos) {
  const st = migrateVerlauf(v).stopps;
  const hex = (c) => parseInt(c.slice(1), 16);
  if (pos <= st[0].pos) return { farbe: st[0].farbe, alpha: st[0].alpha };
  for (let i = 1; i < st.length; i++) {
    if (pos <= st[i].pos) {
      const a = st[i - 1], b = st[i], t = b.pos === a.pos ? 0 : (pos - a.pos) / (b.pos - a.pos);
      const ca = hex(a.farbe), cb = hex(b.farbe);
      const k = (sh) => Math.round(((ca >> sh) & 255) + (((cb >> sh) & 255) - ((ca >> sh) & 255)) * t);
      return { farbe: "#" + ((k(16) << 16) | (k(8) << 8) | k(0)).toString(16).padStart(6, "0"), alpha: Math.round(a.alpha + (b.alpha - a.alpha) * t) };
    }
  }
  const l = st[st.length - 1];
  return { farbe: l.farbe, alpha: l.alpha };
}

// Wie stark der Inhalt eines Blocks skaliert: Anzeigen sind für ihre Standardgröße gestaltet.
// Größer oder kleiner gezogen wächst oder schrumpft der Inhalt mit (kleinere Seite zählt, damit nichts abgeschnitten wird),
// dazu der Zoom. → { f, b, h }: Faktor und die Größe, in der der Inhalt gesetzt wird (vor dem Skalieren)
// Blöcke, die wie Anzeigen mit der Blockgröße skalieren: Gestaltungsgröße
const BLOCK_BASIS = { spieler: { b: 680, h: 170 } };
function inhaltsSkala(e) {
  const a = ANZEIGE[e?.typ] || BLOCK_BASIS[e?.typ];
  if (!a) return { f: 1, b: e?.b || 0, h: e?.h || 0 };
  const auto = e.skalieren === false ? 1 : Math.min(e.b / a.b, e.h / a.h);
  const f = Math.min(5, Math.max(0.1, auto * (zahl(e.zoom, 100, ZOOM_MIN, ZOOM_MAX) / 100)));
  return { f, b: e.b / f, h: e.h / f };
}

// Position und Größe in die Fläche bringen
function kasten(e, F = F0) {
  const b = zahl(e.b, MIN, MIN, F.b), h = zahl(e.h, MIN, MIN, F.h);
  return { x: zahl(e.x, 0, 0, F.b - b), y: zahl(e.y, 0, 0, F.h - h), b, h };
}

// Gespeichertes Layout prüfen: unbekannte Typen raus, jede Anzeige genau einmal (fehlende kommen dazu), Zahlen begrenzen
// flaeche: Größe des Screens, alle Elemente bleiben darin
function migrateLayout(l, flaeche) {
  const F = flaecheVon(flaeche);
  if (!l || typeof l !== "object" || !Array.isArray(l.elemente)) return standardLayout(F);
  // Bilder: nur gültige Data-URLs, und nur solche, die ein Block oder der Hintergrund benutzt
  const quelle = l.bilder && typeof l.bilder === "object" ? l.bilder : {};
  const bilder = {};
  const nimmBild = (id) => { const k = bildId(id); if (k && istBild(quelle[k])) { bilder[k] = quelle[k]; return k; } return ""; };
  const gesehen = new Set(), out = [];
  let texte = 0, bloecke = 0, karten = 0, werte = 0;
  const eigeneId = (e, p) => {
    const id = typeof e.id === "string" && e.id && !gesehen.has(e.id) && !ANZEIGE[e.id] ? e.id.slice(0, 40) : neueId(p);
    gesehen.add(id);
    return id;
  };
  for (const e of l.elemente) {
    if (!e || typeof e !== "object") continue;
    if (e.typ === "text") {
      if (texte >= MAX_TEXTE) continue;
      texte++;
      out.push({
        id: eigeneId(e, "t"), typ: "text", ...kasten(e, F), sichtbar: e.sichtbar !== false,
        text: typeof e.text === "string" ? e.text.slice(0, TEXT_MAX) : "",
        groesse: zahl(e.groesse, 64, 10, 400), farbe: farbe(e.farbe, "#ffffff"), fett: e.fett !== false,
        ausrichtung: AUSRICHTUNG.includes(e.ausrichtung) ? e.ausrichtung : "mitte", panel: !!e.panel, skalieren: e.skalieren !== false, ...migrateStil(e),
      });
    } else if (e.typ === "bild") {
      const bild = nimmBild(e.bild);
      if (!bild || bloecke >= MAX_BILDER) continue;
      bloecke++;
      out.push({
        id: eigeneId(e, "i"), typ: "bild", ...kasten(e, F), sichtbar: e.sichtbar !== false, bild,
        passung: PASSUNGEN.some(([k]) => k === e.passung) ? e.passung : "einpassen",
        radius: zahl(e.radius, 0, 0, 540), panel: !!e.panel, ...migrateStil(e),
        ...(typeof e.name === "string" && e.name ? { name: e.name.slice(0, 60) } : {}),
      });
    } else if (e.typ === "spieler") {
      if (karten >= MAX_SPIELER) continue;
      karten++;
      out.push({ id: eigeneId(e, "p"), typ: "spieler", ...kasten(e, F), sichtbar: e.sichtbar !== false, quelle: quelleVon(e.quelle), rang: zahl(e.rang, 1, 1, 20),
        ...Object.fromEntries(Object.keys(SPIELER_OPTIONEN).map((k) => [k, e[k] !== false])), ...migrateStil(e) });
    } else if (e.typ === "wert") {
      if (werte >= MAX_WERTE) continue;
      werte++;
      out.push({ id: eigeneId(e, "w"), typ: "wert", ...kasten(e, F), sichtbar: e.sichtbar !== false, wert: WERT_KEYS.includes(e.wert) ? e.wert : "score1",
        quelle: quelleVon(e.quelle), rang: zahl(e.rang, 1, 1, 20), beschriftung: e.beschriftung !== false, text: typeof e.text === "string" ? e.text.slice(0, OPTION_TEXT_MAX) : "",
        farbe: farbe(e.farbe, "#ffffff"), ausrichtung: AUSRICHTUNG.includes(e.ausrichtung) ? e.ausrichtung : "mitte", panel: !!e.panel, ...migrateStil(e) });
    } else if (ANZEIGE[e.typ] && !gesehen.has(e.typ)) {
      gesehen.add(e.typ);
      const a = ANZEIGE[e.typ];
      out.push({ id: e.typ, typ: e.typ, ...kasten(e, F), sichtbar: e.sichtbar !== false, skalieren: e.skalieren !== false, zoom: zahl(e.zoom, 100, ZOOM_MIN, ZOOM_MAX),
        ...(a.titel ? { titel: typeof e.titel === "string" ? e.titel.slice(0, 80) : a.titel } : {}), ...migrateStil(e), ...migrateOptionen(e.typ, e) });
    }
  }
  for (const a of ANZEIGEN) if (!gesehen.has(a.typ)) { const st = anzeigeStandard(a); out.push({ ...st, ...kasten(st, F), sichtbar: false }); }
  const hg = migrateHg(l.hg);
  hg.bild = nimmBild(hg.bild);
  let hintergrund = HINTERGRUENDE.some(([k]) => k === l.hintergrund) ? l.hintergrund : "verlauf";
  if (hintergrund === "bild" && !hg.bild) hintergrund = "verlauf";
  return { hintergrund, hg, bilder, elemente: out };
}

// Bilder entfernen, die kein Block und nicht der Hintergrund benutzt (nach Löschen oder Ersetzen)
function bilderAufraeumen(l) {
  const genutzt = new Set(l.elemente.filter((e) => e.typ === "bild").map((e) => e.bild));
  if (l.hg?.bild) genutzt.add(l.hg.bild);
  const alle = l.bilder || {};
  if (Object.keys(alle).every((k) => genutzt.has(k))) return l;
  return { ...l, bilder: Object.fromEntries(Object.entries(alle).filter(([k]) => genutzt.has(k))) };
}

// Platzhalter ersetzen; unbekannte bleiben stehen, damit man den Tippfehler sieht
function textEinsetzen(text, werte) {
  return String(text || "").replace(/\{(\w+)\}/g, (m, k) => (werte && werte[k] != null && werte[k] !== "" ? String(werte[k]) : PLATZHALTER.some(([p]) => p === k) ? "" : m));
}

// Einrasten beim Ziehen: an das Raster und an Kanten und Mitten der Fläche und der anderen Elemente.
// k: { x, y, b, h } des gezogenen Elements, andere: Liste von Kästen, modus: "bewegen" oder Liste der gezogenen Kanten ("l","r","o","u").
// → { x, y, b, h, linien: [{ achse: "x"|"y", pos }] }
function einrasten(k, andere, { raster = 0, abstand = 8, kanten = null, flaeche } = {}) {
  const F = flaecheVon(flaeche);
  const ziele = { x: [0, F.b / 2, F.b], y: [0, F.h / 2, F.h] };
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
  r.b = Math.max(MIN, Math.min(F.b, Math.round(r.b))); r.h = Math.max(MIN, Math.min(F.h, Math.round(r.h)));
  r.x = Math.max(0, Math.min(F.b - r.b, Math.round(r.x))); r.y = Math.max(0, Math.min(F.h - r.h, Math.round(r.y)));
  return { ...r, linien };
}

module.exports = {
  STIL, OPTIONEN, OPTION_TEXT_MAX, migrateStil, B, H, MIN, MAX_TEXTE, MAX_BILDER, MAX_SPIELER, MAX_WERTE, SPIELER_OPTIONEN, WERT_KEYS, neuerSpieler, neuerWert, MAX_STOPPS, BILD_MAX, ZOOM_MIN, ZOOM_MAX, ANZEIGEN, ANZEIGE, HINTERGRUENDE, VERLAUF_ARTEN, VERLAUF_VORLAGEN, PASSUNGEN, AUSRICHTUNG, PLATZHALTER,
  standardLayout, einzelLayout, flaecheVon, standardHg, migrateLayout, migrateVerlauf, neuerText, neuesBild, textEinsetzen, einrasten, verlaufCss, farbeBei, rgba, inhaltsSkala, istBild, bilderAufraeumen, neueId,
};
