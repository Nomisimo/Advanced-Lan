"use strict";
// Einstellungen der App. Eine Datei für beide Modi: Regie und Game-PC.

const PORTS = { session: 47801, gsi: 3000, rl: 49124 };

function neuerToken() {
  const b = new Uint8Array(12);
  globalThis.crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

const uid = () => Math.random().toString(36).slice(2, 10);

function standardRegie() {
  return {
    armed: false,
    aktivesSpiel: "cs2",
    spiele: { cs2: true, rl: true, dota2: false, ow2: false, r6: false, mr: false, fn: false, apex: false, pubg: false, valorant: false }, // Tab „Setup“: nur genutzte Spiele erscheinen in Control und Signale
    session: { name: "LAN-Party", passwort: "", port: PORTS.session, offen: false },
    netz: { empfang: "", senden: "" }, // Netzwerkkarten (Name, leer = automatisch): Empfang der Game-PCs, Senden der OSC-Befehle
    // Tab „Ziele“: angelegt aus der Ziel-Datenbank (ziel-typen.js)
    targets: [], // [{ id, typ, name, host, port, optionen: {}, netz }]  netz: eigene Netzwerkkarte, leer = wie „Senden“
    // Tab „Signale“: welches Event welchen Befehl an welches Ziel sendet
    signale: {}, // { [spiel]: { [event]: [{ id, ziel, befehl, werte, pc, team }] } }
  };
}

function standardGamePc() {
  return {
    pcId: "",
    regie: { id: "", session: "", host: "", port: 0 }, // gewählte Session aus mDNS, nie von Hand eingegeben
    passwort: "",
    autoVerbinden: false,
    netz: "", // Netzwerkkarte zur Regie (Name, leer = automatisch)
    gsiPort: PORTS.gsi,
    overlay: { an: true, x: null, y: null }, // Mini-Overlay, solange die App minimiert ist (Tab „Setup“)
    rlPort: PORTS.rl, // WebSocket der Rocket-League-Stats-API
    gsiToken: neuerToken(),
  };
}

function standardKonfig() {
  return { format: "advanced-lan", version: 5, modus: null, regie: standardRegie(), gamepc: standardGamePc() };
}

function genutzteSpiele(s, std) {
  const out = { ...std };
  if (s && typeof s === "object") for (const k of Object.keys(std)) if (typeof s[k] === "boolean") out[k] = s[k];
  if (!Object.values(out).some(Boolean)) out.cs2 = true; // mindestens ein Spiel
  return out;
}

// Ziele vor Version 5 hatten keinen Typ: allgemeines OSC-Gerät
const migrateZiel = (t) => ({ id: t.id || uid(), typ: t.typ || "osc", name: t.name || "", host: t.host || "", port: Number(t.port) || 0, optionen: t.optionen && typeof t.optionen === "object" ? t.optionen : {}, netz: typeof t.netz === "string" ? t.netz : "" });

// Vor Version 5 waren Signale nur an/aus (neutrales OSC). Übernommen werden nur Befehlslisten.
function migrateSignale(s) {
  const out = {};
  if (!s || typeof s !== "object") return out;
  for (const [spiel, evs] of Object.entries(s)) {
    if (!evs || typeof evs !== "object") continue;
    for (const [ev, liste] of Object.entries(evs)) {
      if (!Array.isArray(liste)) continue;
      (out[spiel] = out[spiel] || {})[ev] = liste.filter((z) => z && typeof z === "object").map((z) => ({ id: z.id || uid(), ziel: z.ziel || "", befehl: z.befehl || "eigene", werte: z.werte && typeof z.werte === "object" ? z.werte : {}, pc: z.pc || "", team: z.team || "" }));
    }
  }
  return out;
}

// Gespeicherte Einstellungen einlesen, fehlende Felder ergänzen
function migrateKonfig(k) {
  const d = standardKonfig();
  if (!k || typeof k !== "object" || ![3, 4, 5].includes(k.version)) return d;
  const r = k.regie || {}, g = k.gamepc || {};
  const m = {
    ...d,
    modus: k.modus === "regie" || k.modus === "gamepc" ? k.modus : null,
    regie: {
      ...d.regie,
      ...r,
      armed: false, // nach dem Start nie scharf: erst bewusst einschalten
      session: { ...d.regie.session, ...(r.session || {}) },
      netz: { ...d.regie.netz, ...(r.netz && typeof r.netz === "object" ? r.netz : {}) },
      targets: Array.isArray(r.targets) ? r.targets.map(migrateZiel) : d.regie.targets,
      signale: migrateSignale(r.signale),
      spiele: genutzteSpiele(r.spiele, d.regie.spiele),
    },
    gamepc: { ...d.gamepc, ...g, regie: { ...d.gamepc.regie, ...(g.regie || {}) }, overlay: { ...d.gamepc.overlay, ...(g.overlay && typeof g.overlay === "object" ? g.overlay : {}) }, gsiToken: g.gsiToken || d.gamepc.gsiToken },
  };
  delete m.gamepc.spiel;
  // Das aktive Spiel muss ein genutztes Spiel sein
  if (!m.regie.spiele[m.regie.aktivesSpiel]) m.regie.aktivesSpiel = Object.keys(m.regie.spiele).find((k) => m.regie.spiele[k]);
  return m;
}

module.exports = { standardKonfig, migrateKonfig, genutzteSpiele, standardRegie, standardGamePc, neuerToken, uid, PORTS };
