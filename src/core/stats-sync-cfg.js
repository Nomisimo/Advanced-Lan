"use strict";
// Einstellungen der Stats-Screen-PCs (ohne Node-Module, läuft auch in der Oberfläche). Protokoll: core/stats-sync.js

const DATEN_PORT = 47803; // Stats-PCs lauschen hier (Multicast und Unicast), die Regie auf Port + 1
const GRUPPE = "239.255.47.81"; // Multicast-Gruppe (organisationslokal)
const istMulticast = (ip) => /^(22[4-9]|23\d)\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(String(ip || ""));

// Einstellungen: Senden in der Regie (Tab „Setup“) und Empfang auf dem Stats-PC
function standardSync() { return { an: true, gruppe: GRUPPE, port: DATEN_PORT, netz: "" }; }
function migrateSync(s) {
  const d = standardSync();
  if (!s || typeof s !== "object") return d;
  const port = Math.round(Number(s.port));
  return { an: s.an !== false, gruppe: istMulticast(s.gruppe) ? String(s.gruppe) : d.gruppe, port: port >= 1024 && port <= 65534 ? port : d.port, netz: typeof s.netz === "string" ? s.netz : "" };
}
// Stats-PC: Adresse der Regie (leer = automatisch über Multicast und Session-Suche), Netzwerkkarte, Port, Fenster beim Start.
// Fenster gehen als normale Fenster auf (vollbildStart: gleich als Vollbild), lage: Position und Größe je Screen.
// Eigene Screens (eigene, wie regie.stats) migriert defaults.js
function standardStatsPc() { return { regie: "", netz: "", gruppe: GRUPPE, port: DATEN_PORT, fenster: [], vollbildStart: false, lage: {}, eigene: { an: true, aktiv: "", screens: [] } }; }
const ganz = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
function migrateLage(l) {
  const out = {};
  for (const [id, x] of Object.entries(l && typeof l === "object" ? l : {}).slice(0, 32)) {
    const [px, py, b, h] = [ganz(x?.x), ganz(x?.y), ganz(x?.b), ganz(x?.h)];
    if (!/^[\w-]{1,40}$/.test(id) || px == null || py == null || !(b >= 120) || !(h >= 60)) continue;
    out[id] = { x: px, y: py, b: Math.min(8000, b), h: Math.min(8000, h), vollbild: !!x.vollbild };
  }
  return out;
}
function migrateStatsPc(s) {
  const d = standardStatsPc();
  if (!s || typeof s !== "object") return d;
  const port = Math.round(Number(s.port));
  return {
    regie: typeof s.regie === "string" ? s.regie.trim().slice(0, 100) : "",
    netz: typeof s.netz === "string" ? s.netz : "",
    gruppe: istMulticast(s.gruppe) ? String(s.gruppe) : d.gruppe,
    port: port >= 1024 && port <= 65534 ? port : d.port,
    fenster: Array.isArray(s.fenster) ? [...new Set(s.fenster.filter((x) => typeof x === "string"))].slice(0, 16) : [],
    vollbildStart: s.vollbildStart === true, // bis 1.0.8 hieß es vollbild und war an: jetzt normale Fenster
    lage: migrateLage(s.lage),
    eigene: d.eigene,
  };
}

module.exports = { DATEN_PORT, GRUPPE, istMulticast, standardSync, migrateSync, standardStatsPc, migrateStatsPc };
