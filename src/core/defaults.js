"use strict";
// Einstellungen der App. Eine Datei für beide Modi: Regie und Game-PC.

const PORTS = { session: 47801, gsi: 3000 };

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
    session: { name: "LAN-Party", passwort: "", port: PORTS.session, offen: false },
    // Wohin die Signale gehen, ist der App egal: jedes Ziel bekommt alle freigegebenen Signale
    targets: [{ id: uid(), name: "", host: "127.0.0.1", port: 8000 }],
    signale: {}, // { [spiel]: { [event]: false } } = gesperrt, alles andere wird gesendet
  };
}

function standardGamePc() {
  return {
    pcId: "",
    regie: { host: "", port: PORTS.session, session: "" },
    passwort: "",
    autoVerbinden: false,
    gsiPort: PORTS.gsi,
    gsiToken: neuerToken(),
  };
}

function standardKonfig() {
  return { format: "lan-regie", version: 3, modus: null, regie: standardRegie(), gamepc: standardGamePc() };
}

// Gespeicherte Einstellungen einlesen, fehlende Felder ergänzen
function migrateKonfig(k) {
  const d = standardKonfig();
  if (!k || typeof k !== "object" || k.version !== 3) return d;
  const r = k.regie || {}, g = k.gamepc || {};
  return {
    ...d,
    modus: k.modus === "regie" || k.modus === "gamepc" ? k.modus : null,
    regie: {
      ...d.regie,
      ...r,
      armed: false, // nach dem Start nie scharf: erst bewusst einschalten
      session: { ...d.regie.session, ...(r.session || {}) },
      targets: Array.isArray(r.targets) ? r.targets.map((t) => ({ id: t.id || uid(), name: t.name || "", host: t.host || "", port: Number(t.port) || 0 })) : d.regie.targets,
      signale: r.signale && typeof r.signale === "object" ? r.signale : {},
    },
    gamepc: { ...d.gamepc, ...g, regie: { ...d.gamepc.regie, ...(g.regie || {}) }, gsiToken: g.gsiToken || d.gamepc.gsiToken },
  };
}

module.exports = { standardKonfig, migrateKonfig, standardRegie, standardGamePc, neuerToken, uid, PORTS };
