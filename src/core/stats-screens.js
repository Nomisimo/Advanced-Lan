"use strict";
// Mehrere Game-Stats-Screens der Regie: jeder hat eine eigene Größe in Pixeln, ein eigenes Layout,
// ein eigenes Pop-out-Fenster und eine eigene NDI-Quelle. Gespeichert in cfg.regie.stats.
// Reine Funktionen, laufen in der Oberfläche, im Hauptprozess und in den Tests.

const { B, H, MIN, standardLayout, einzelLayout, migrateLayout } = require("./stats-layout");

const MAX_SCREENS = 8;
const GROESSE_MIN = MIN; // kleinster Screen: so groß wie das kleinste Element
const GROESSE_MAX = 3840;
const NAME_MAX = 40;
const NDI_NAME_MAX = 60;
const NDI_STANDARD = "Advanced LAN Stats";
// Formate zur Auswahl im Editor [Breite, Höhe, Name]
const FORMATE = [
  [1920, 1080, "Full HD"], [1280, 720, "HD 720p"], [3840, 2160, "4K"], [1080, 1920, "Hochkant"], [1080, 1080, "Quadrat"],
  [1920, 200, "Bauchbinde"], [800, 200, "Spielstand-Leiste"], [480, 120, "Kleines Element"],
];

const zahl = (v, std, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std; };
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

let zaehler = 0;
const neueScreenId = () => `s${Date.now().toString(36)}${(zaehler++).toString(36)}`;

const groesse = (b, h) => ({ b: zahl(b, B, GROESSE_MIN, GROESSE_MAX), h: zahl(h, H, GROESSE_MIN, GROESSE_MAX) });

// Neuer Screen. vorlage: "standard" (alle Anzeigen, anteilig gesetzt), "leer" oder der Typ eines einzelnen Elements
function neuerScreen({ name = "Neuer Screen", b = B, h = H, vorlage = "standard", ndiName = "" } = {}) {
  const g = groesse(b, h);
  const layout = vorlage === "standard" ? standardLayout(g) : einzelLayout(vorlage === "leer" ? "" : vorlage, g);
  return { id: neueScreenId(), name: text(name, NAME_MAX) || "Neuer Screen", ...g, ndi: false, ndiName: text(ndiName, NDI_NAME_MAX), layout };
}

function standardStats() {
  return { an: false, aktiv: "haupt", screens: [{ id: "haupt", name: "Haupt-Screen", b: B, h: H, ndi: false, ndiName: NDI_STANDARD, layout: standardLayout() }] };
}

// Name der NDI-Quelle, der noch frei ist: „Advanced LAN Stats 2“ usw. (zwei Quellen mit gleichem Namen stören sich)
function freierNdiName(wunsch, belegt) {
  const klein = new Set([...belegt].map((n) => n.toLowerCase()));
  const basis = text(wunsch, NDI_NAME_MAX) || NDI_STANDARD;
  if (!klein.has(basis.toLowerCase())) return basis;
  for (let i = 2; ; i++) { const n = `${basis.slice(0, NDI_NAME_MAX - String(i).length - 1)} ${i}`; if (!klein.has(n.toLowerCase())) return n; }
}

function migrateScreen(s, i) {
  const g = groesse(s.b, s.h);
  return { id: typeof s.id === "string" && /^[\w-]{1,40}$/.test(s.id) ? s.id : neueScreenId(), name: text(s.name, NAME_MAX) || `Screen ${i + 1}`, ...g, ndi: !!s.ndi, ndiName: text(s.ndiName, NDI_NAME_MAX), layout: migrateLayout(s.layout, g) };
}

// Gespeicherte Einstellungen prüfen. Ältere Versionen hatten genau einen Screen: { an, ndi, ndiName, layout }
function migrateStats(s) {
  const std = standardStats();
  if (!s || typeof s !== "object") return std;
  const roh = Array.isArray(s.screens) && s.screens.length ? s.screens : [{ id: "haupt", name: "Haupt-Screen", b: B, h: H, ndi: s.ndi, ndiName: s.ndiName || NDI_STANDARD, layout: s.layout }];
  const ids = new Set(), namen = [];
  const screens = [];
  for (const r of roh) {
    if (!r || typeof r !== "object" || screens.length >= MAX_SCREENS) continue;
    const m = migrateScreen(r, screens.length);
    if (ids.has(m.id)) m.id = neueScreenId();
    ids.add(m.id);
    m.ndiName = freierNdiName(m.ndiName, namen);
    namen.push(m.ndiName);
    screens.push(m);
  }
  if (!screens.length) return { ...std, an: !!s.an };
  const aktiv = screens.some((x) => x.id === s.aktiv) ? s.aktiv : screens[0].id;
  return { an: !!s.an, aktiv, screens };
}

// Eigene Screens eines Stats-Screen-PCs: wie die der Regie, aber auch keiner erlaubt und ohne NDI (das sendet die Regie)
function migrateEigene(s) {
  const roh = Array.isArray(s?.screens) ? s.screens : [];
  const ids = new Set(), screens = [];
  for (const r of roh) {
    if (!r || typeof r !== "object" || screens.length >= MAX_SCREENS) continue;
    const m = { ...migrateScreen(r, screens.length), ndi: false };
    if (ids.has(m.id)) m.id = neueScreenId();
    ids.add(m.id);
    screens.push(m);
  }
  return { an: true, aktiv: screens.some((x) => x.id === s?.aktiv) ? s.aktiv : screens[0]?.id || "", screens };
}

// Screen zu einer ID (oder der erste)
function screenVon(stats, id) {
  const l = stats?.screens || [];
  return l.find((s) => s.id === id) || l[0] || null;
}

// Hash der Stats-Seite: #stats (erster Screen), #stats=<id>, mit „&ndi“ für das NDI-Fenster
function statsHash(id, ndi) { return `stats${id ? `=${id}` : ""}${ndi ? "&ndi" : ""}`; }
function leseStatsHash(hash) {
  const m = /^#?stats(?:=([\w-]+))?(&ndi)?$/.exec(String(hash || ""));
  return m ? { id: m[1] || "", ndi: !!m[2] } : null;
}

// Pixel eines Bildes (BGRA, Alpha vormultipliziert wie aus Chromium) für NDI auf geraden Alpha-Kanal bringen.
// Ganz deckende und ganz durchsichtige Pixel bleiben, wie sie sind.
function alphaGerade(buf) {
  for (let i = 0; i < buf.length; i += 4) {
    const a = buf[i + 3];
    if (a === 255 || a === 0) continue;
    const f = 255 / a;
    buf[i] = Math.min(255, Math.round(buf[i] * f));
    buf[i + 1] = Math.min(255, Math.round(buf[i + 1] * f));
    buf[i + 2] = Math.min(255, Math.round(buf[i + 2] * f));
  }
  return buf;
}

module.exports = {
  MAX_SCREENS, GROESSE_MIN, GROESSE_MAX, NAME_MAX, NDI_NAME_MAX, NDI_STANDARD, FORMATE,
  neuerScreen, standardStats, migrateStats, migrateEigene, freierNdiName, screenVon, statsHash, leseStatsHash, alphaGerade, groesse,
};
