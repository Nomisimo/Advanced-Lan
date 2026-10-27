"use strict";
// Show-Files: die ganze Einrichtung eines Modus als eine Datei. Regie und Game-PC haben getrennte Shows,
// Standalone nutzt beide. Reine Funktionen, laufen in der Oberfläche, im Hauptprozess und in den Tests.
const { migrateKonfig, standardKonfig, standardRegie, standardGamePc, standardShows, migrateShows, sauberName } = require("./defaults");
const { istLeer } = require("./plan");

const SHOW_FORMAT = "advanced-lan-show";
const SHOW_VERSION = 1;
const SHOW_ENDUNG = "alshow";
const ARTEN = ["regie", "gamepc"];
const ART_NAME = { regie: "Regie", gamepc: "Game-PC" };

const kopie = (x) => JSON.parse(JSON.stringify(x));

// Was in eine Show gehört. Nicht dabei, weil es zu diesem PC oder zum Moment gehört:
// Regie: Ausgabe an/aus und ob die Session gerade offen ist. Game-PC: PC-ID, Spielername, GSI-Token (steht in den
// installierten cfg-Dateien) und die Position des Overlays.
function showDaten(cfg, art) {
  if (art === "regie") {
    const d = kopie(cfg.regie);
    delete d.armed;
    delete d.session.offen;
    // Ohne Plan und ohne ersetzte Events wie vor beta.10: ältere Shows gelten nicht als geändert
    if (istLeer(d.plan)) delete d.plan;
    if (d.ersetzt && !Object.keys(d.ersetzt).length) delete d.ersetzt;
    return d;
  }
  const d = kopie(cfg.gamepc);
  delete d.pcId;
  delete d.verwaltet;
  delete d.spieler;
  delete d.gsiToken;
  delete d.overlay.x;
  delete d.overlay.y;
  return d;
}

// Kurzer Fingerabdruck der Show-Daten: erkennt ungespeicherte Änderungen. Schlüssel sortiert, damit die Reihenfolge egal ist.
function stabil(x) {
  if (Array.isArray(x)) return `[${x.map(stabil).join(",")}]`;
  if (x && typeof x === "object") return `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${stabil(x[k])}`).join(",")}}`;
  return JSON.stringify(x) ?? "null";
}
function fingerabdruck(daten) {
  const s = stabil(daten);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${s.length.toString(36)}-${h.toString(36)}`;
}

// Welche Show gerade geladen ist und ob sie seit dem Speichern geändert wurde
function showInfo(cfg, art) {
  const s = cfg.shows?.[art] || { name: "", stand: "" };
  return { art, name: s.name, geaendert: !!s.name && fingerabdruck(showDaten(cfg, art)) !== s.stand };
}

// Gehen beim Laden einer anderen Show Einstellungen verloren? Geänderte Show, oder ohne Show etwas anderes als die Standardwerte
function ungesichert(cfg, art) {
  const i = showInfo(cfg, art);
  if (i.name) return i.geaendert;
  return fingerabdruck(showDaten(cfg, art)) !== fingerabdruck(showDaten(leereShow(cfg, art), art));
}

// Datei zum Speichern und Exportieren
function showDatei(cfg, art, name, { appVersion = "", jetzt = new Date() } = {}) {
  return { format: SHOW_FORMAT, version: SHOW_VERSION, art, name: sauberName(name) || ART_NAME[art], app: appVersion, gespeichert: jetzt.toISOString(), konfig: cfg.version, daten: showDaten(cfg, art) };
}

// Datei einlesen und prüfen. arten: welche Shows dieser Modus laden darf
function leseShow(inhalt, arten = ARTEN) {
  let d = inhalt;
  if (typeof inhalt === "string") { try { d = JSON.parse(inhalt); } catch { return { fehler: "Keine Show-Datei (kein gültiges JSON)." }; } }
  if (!d || typeof d !== "object" || d.format !== SHOW_FORMAT) return { fehler: "Keine Advanced-LAN-Show." };
  if (typeof d.version !== "number" || d.version > SHOW_VERSION) return { fehler: "Die Show stammt aus einer neueren Version der App. Bitte Advanced LAN aktualisieren." };
  if (!ARTEN.includes(d.art)) return { fehler: "Unbekannte Show-Art." };
  if (!d.daten || typeof d.daten !== "object") return { fehler: "Die Show enthält keine Einstellungen." };
  if (!arten.includes(d.art)) return { fehler: `Das ist eine ${ART_NAME[d.art]}-Show. In diesem Modus lassen sich nur ${arten.map((a) => ART_NAME[a]).join("- und ")}-Shows laden.` };
  // pcId: nur in Game-PC-Shows aus einem Einrichtungspaket der Regie
  const pcId = d.art === "gamepc" && typeof d.pcId === "string" ? d.pcId.trim().slice(0, 40) : "";
  return { art: d.art, name: sauberName(d.name) || ART_NAME[d.art], daten: d.daten, gespeichert: typeof d.gespeichert === "string" ? d.gespeichert : "", ...(pcId ? { pcId } : {}) };
}

// Show in die Einstellungen übernehmen. Was nicht in der Show steht (siehe showDaten), bleibt von diesem PC.
// Die Ausgabe ist danach immer aus: neue Ziele und Signale erst bewusst scharf schalten.
// pcId: PC-ID aus einem Einrichtungspaket (nur Game-PC), sonst bleibt die eigene.
function showAnwenden(cfg, art, daten, name, { pcId = "" } = {}) {
  const roh = kopie(cfg);
  roh.version = 5;
  if (art === "regie") {
    const offen = !!cfg.regie.session.offen;
    roh.regie = { ...kopie(daten), session: { ...(daten.session || {}), offen } };
  } else {
    const g = cfg.gamepc;
    // Session-Wahl und Netzwerkkarte bleiben, wenn die Show sie nicht enthält (Vorlage der Regie, Einrichtungspaket)
    const lokal = Object.fromEntries(VORLAGE_LOKAL.map((k) => [k, kopie(g[k] ?? null)]).filter(([, v]) => v != null));
    roh.gamepc = { ...lokal, ...kopie(daten), pcId: pcId || g.pcId, spieler: g.spieler, gsiToken: g.gsiToken, verwaltet: g.verwaltet, overlay: { ...(daten.overlay || {}), x: g.overlay?.x ?? null, y: g.overlay?.y ?? null } };
  }
  const neu = migrateKonfig(roh);
  neu.modus = cfg.modus;
  neu.regie.armed = false;
  neu.regie.session.offen = !!cfg.regie.session.offen;
  neu.shows = migrateShows(cfg.shows);
  neu.shows[art] = { name: sauberName(name), stand: fingerabdruck(showDaten(neu, art)) };
  return neu;
}

// Leere Show: Standard-Einstellungen, ohne Namen
function leereShow(cfg, art) {
  const neu = showAnwenden(cfg, art, art === "regie" ? standardRegie() : standardGamePc(), "");
  neu.shows[art] = { name: "", stand: "" };
  return neu;
}

// Nach dem Speichern: diese Show ist jetzt geladen und unverändert
function alsGespeichert(cfg, art, name) {
  const neu = kopie(cfg);
  neu.shows = migrateShows(cfg.shows);
  neu.shows[art] = { name: sauberName(name), stand: fingerabdruck(showDaten(cfg, art)) };
  return neu;
}

// Dateiname aus dem Show-Namen (Windows und macOS)
function dateiName(name, art) {
  const n = sauberName(name).replace(/[<>:"/\\|?*]/g, "-").replace(/[. ]+$/, "") || ART_NAME[art];
  return `${n}.${SHOW_ENDUNG}`;
}

// Game-PC-Vorlage der Regie (Tab „Plan“): eine Game-PC-Show ohne das, was zur Verbindung dieses PCs gehört.
// stand: Fingerabdruck, an dem Regie und Game-PC erkennen, ob die Vorlage auf dem PC aktuell ist.
const VORLAGE_LOKAL = ["regie", "passwort", "autoVerbinden", "netz"];
function vorlageDaten(showDatenGamepc) {
  const d = kopie(showDatenGamepc);
  for (const k of VORLAGE_LOKAL) delete d[k];
  return d;
}
const vorlageStand = (cfg) => fingerabdruck(vorlageDaten(showDaten(cfg, "gamepc")));
// Aus einer Game-PC-Show (Datei, verbundener PC oder Standalone) eine Vorlage machen. Über Standard-Einstellungen
// angewendet, damit der Fingerabdruck dem entspricht, den der Game-PC nach dem Übernehmen selbst ausrechnet.
function vorlageAus(daten, name) {
  const tmp = showAnwenden(standardKonfig(), "gamepc", daten, name);
  const d = vorlageDaten(showDaten(tmp, "gamepc"));
  return { name: sauberName(name) || ART_NAME.gamepc, daten: d, stand: fingerabdruck(d) };
}
const vorlageAnwenden = (cfg, vorlage, opt) => showAnwenden(cfg, "gamepc", vorlage.daten, vorlage.name, opt);
// Einrichtungspaket: je Platz eine Game-PC-Show mit fertiger PC-ID
const paketDatei = (vorlage, pcId, opt = {}) => ({ ...showDatei(standardKonfig(), "gamepc", vorlage.name, opt), daten: kopie(vorlage.daten), pcId });

// Modi und ihre Shows: Standalone hat beide
const arten = (modus) => (modus === "regie" ? ["regie"] : modus === "gamepc" ? ["gamepc"] : modus === "standalone" ? ["regie", "gamepc"] : []);

module.exports = { SHOW_FORMAT, SHOW_VERSION, SHOW_ENDUNG, ARTEN, ART_NAME, showDaten, fingerabdruck, standardShows, migrateShows, showInfo, ungesichert, showDatei, leseShow, showAnwenden, leereShow, alsGespeichert, dateiName, arten, sauberName, VORLAGE_LOKAL, vorlageDaten, vorlageStand, vorlageAus, vorlageAnwenden, paketDatei };
