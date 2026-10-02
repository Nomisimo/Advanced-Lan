"use strict";
// Einstellungen der App. Eine Datei für beide Modi: Regie und Game-PC.

const PORTS = { session: 47801, gsi: 3000 };

function neuerToken() {
  const b = new Uint8Array(12);
  globalThis.crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

const uid = () => Math.random().toString(36).slice(2, 10);

// grandMA3 führt Befehle aus, die als String an <Präfix>/cmd kommen (In & Out → OSC, „Receive Command“ an).
const ma3 = (event, team, befehl) => ({ event, team, target: "ma3", address: "/gma3/cmd", argTyp: "s", argWert: befehl });
const playout = (event, team, argWert = "{team}") => ({ event, team, target: "playout", address: `/lanparty/{spiel}/${event}`, argTyp: "s", argWert });

const STANDARD_REGELN = [
  ma3("round_end", "CT", "Go+ Sequence 101"),
  ma3("round_end", "T", "Go+ Sequence 102"),
  playout("round_end", ""),
  ma3("bomb_planted", "", "Go+ Sequence 110"),
  playout("bomb_planted", ""),
  ma3("bomb_exploded", "", "Go+ Sequence 111"),
  ma3("bomb_defused", "", "Go+ Sequence 112"),
  ma3("ace", "", "Go+ Sequence 120"),
  playout("ace", "", "{player}"),
  ma3("match_end", "", "Go+ Sequence 130"),
  playout("match_end", ""),
  { ...playout("kill", "", "{player}"), aktiv: false },
];

function standardRegie() {
  return {
    armed: false,
    aktivesSpiel: "cs2",
    session: { name: "LAN-Party", passwort: "", port: PORTS.session, offen: false },
    targets: [
      { id: "ma3", name: "grandMA3", typ: "ma3", host: "192.168.1.50", port: 8000 },
      { id: "playout", name: "Playout", typ: "playout", host: "192.168.1.60", port: 9000 },
    ],
    rules: STANDARD_REGELN.map((r) => ({ id: uid(), aktiv: true, spiel: "cs2", pc: "", cooldown: 0, ...r })),
  };
}

function standardGamePc() {
  return {
    pcId: "",
    spiel: "cs2",
    regie: { host: "", port: PORTS.session, session: "" },
    passwort: "",
    autoVerbinden: false,
    gsiPort: PORTS.gsi,
    gsiToken: neuerToken(),
  };
}

function standardKonfig() {
  return { format: "lan-regie", version: 2, modus: null, regie: standardRegie(), gamepc: standardGamePc() };
}

// Gespeicherte Einstellungen einlesen, fehlende Felder ergänzen
function migrateKonfig(k) {
  const d = standardKonfig();
  if (!k || typeof k !== "object" || k.version !== 2) return d;
  const r = k.regie || {}, g = k.gamepc || {};
  return {
    ...d,
    modus: k.modus === "regie" || k.modus === "gamepc" ? k.modus : null,
    regie: {
      ...d.regie,
      ...r,
      armed: false, // nach dem Start nie scharf: erst bewusst einschalten
      session: { ...d.regie.session, ...(r.session || {}) },
      targets: Array.isArray(r.targets) ? r.targets : d.regie.targets,
      rules: Array.isArray(r.rules) ? r.rules.map((x) => ({ id: uid(), aktiv: true, spiel: "cs2", team: "", pc: "", cooldown: 0, argTyp: "", argWert: "", ...x })) : d.regie.rules,
    },
    gamepc: { ...d.gamepc, ...g, regie: { ...d.gamepc.regie, ...(g.regie || {}) }, gsiToken: g.gsiToken || d.gamepc.gsiToken },
  };
}

module.exports = { standardKonfig, migrateKonfig, standardRegie, standardGamePc, neuerToken, uid, PORTS };
