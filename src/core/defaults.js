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
    spiele: { cs2: true, valorant: false, rl: true }, // Tab „Setup“: nur genutzte Spiele erscheinen in Control und Signale
    session: { name: "LAN-Party", passwort: "", port: PORTS.session, offen: false },
    // Wohin die Signale gehen, ist der App egal: jedes Ziel bekommt alle freigegebenen Signale
    targets: [{ id: uid(), name: "", host: "127.0.0.1", port: 8000 }],
    signale: {}, // { [spiel]: { [event]: false } } = gesperrt, alles andere wird gesendet
  };
}

function standardGamePc() {
  return {
    pcId: "",
    regie: { id: "", session: "", host: "", port: 0 }, // gewählte Session aus mDNS, nie von Hand eingegeben
    passwort: "",
    autoVerbinden: false,
    gsiPort: PORTS.gsi,
    rlPort: PORTS.rl, // WebSocket der Rocket-League-Stats-API
    gsiToken: neuerToken(),
  };
}

function standardKonfig() {
  return { format: "advanced-lan", version: 4, modus: null, regie: standardRegie(), gamepc: standardGamePc() };
}

function genutzteSpiele(s, std) {
  const out = { ...std };
  if (s && typeof s === "object") for (const k of Object.keys(std)) if (typeof s[k] === "boolean") out[k] = s[k];
  if (!Object.values(out).some(Boolean)) out.cs2 = true; // mindestens ein Spiel
  return out;
}

// Gespeicherte Einstellungen einlesen, fehlende Felder ergänzen
function migrateKonfig(k) {
  const d = standardKonfig();
  if (!k || typeof k !== "object" || (k.version !== 3 && k.version !== 4)) return d;
  const r = k.regie || {}, g = k.gamepc || {};
  const m = {
    ...d,
    modus: k.modus === "regie" || k.modus === "gamepc" ? k.modus : null,
    regie: {
      ...d.regie,
      ...r,
      armed: false, // nach dem Start nie scharf: erst bewusst einschalten
      session: { ...d.regie.session, ...(r.session || {}) },
      targets: Array.isArray(r.targets) ? r.targets.map((t) => ({ id: t.id || uid(), name: t.name || "", host: t.host || "", port: Number(t.port) || 0 })) : d.regie.targets,
      signale: r.signale && typeof r.signale === "object" ? r.signale : {},
      spiele: genutzteSpiele(r.spiele, d.regie.spiele),
    },
    gamepc: { ...d.gamepc, ...g, regie: { ...d.gamepc.regie, ...(g.regie || {}) }, gsiToken: g.gsiToken || d.gamepc.gsiToken },
  };
  delete m.gamepc.spiel;
  // Das aktive Spiel muss ein genutztes Spiel sein
  if (!m.regie.spiele[m.regie.aktivesSpiel]) m.regie.aktivesSpiel = Object.keys(m.regie.spiele).find((k) => m.regie.spiele[k]);
  return m;
}

module.exports = { standardKonfig, migrateKonfig, genutzteSpiele, standardRegie, standardGamePc, neuerToken, uid, PORTS };
