"use strict";
// Spiele, die eine Regie streamen kann. Pro Spiel eine eigene Ereignisliste.
// quelle: woher der Game-PC die Daten hat. sim: Beschriftung „eine Runde“ im Simulator (null = kein Simulator).
const { EVENT_TYPES } = require("./events");
const { RL_EVENT_TYPES } = require("./rl-events");
const { DOTA_EVENT_TYPES } = require("./dota");
const { GEP_SPIELE } = require("./gep-spiele");

const GEP_QUELLE = "Overwolf Game Events (GEP)";

const SPIELE = [
  { id: "cs2", name: "Counter-Strike 2", kurz: "CS2", farbe: "#f2b33d", quelle: "Valve Game State Integration", teams: ["CT", "T"], events: EVENT_TYPES, sim: "Eine Runde" },
  { id: "rl", name: "Rocket League", kurz: "RL", farbe: "#3b9dff", quelle: "Psyonix Stats API", teams: ["BLUE", "ORANGE"], events: RL_EVENT_TYPES, sim: "Bis zum nächsten Tor" },
  { id: "dota2", name: "Dota 2", kurz: "DOTA", farbe: "#c0392b", quelle: "Valve Game State Integration", teams: ["RADIANT", "DIRE"], events: DOTA_EVENT_TYPES, sim: "Nächste 5 Minuten" },
  ...GEP_SPIELE.map(({ id, name, kurz, farbe, teams, events, sim, owId, art }) => ({ id, name, kurz, farbe, quelle: GEP_QUELLE, teams, events, sim, gep: owId, art })),
  { id: "valorant", name: "Valorant", kurz: "VAL", farbe: "#ff4655", quelle: null, teams: [], events: [], sim: null },
];
const SPIEL_BY_ID = Object.fromEntries(SPIELE.map((s) => [s.id, s]));
// Spiele, die ein Game-PC erkennen kann
const QUELLEN = SPIELE.filter((s) => s.quelle).map((s) => s.id);
// Event-IDs gelten je Spiel (z. B. „mvp“ in CS2 und Rocket League). Ohne passendes Spiel: erstes Spiel, das die ID kennt.
const eventInfo = (spiel, type) => SPIEL_BY_ID[spiel]?.events.find((e) => e.id === type) || SPIELE.map((s) => s.events.find((e) => e.id === type)).find(Boolean);

// Teamfarben wie im Spiel
const TEAM_FARBEN = { CT: "#5aa9ff", T: "#f2b33d", BLUE: "#3b9dff", ORANGE: "#ff8a1f", RADIANT: "#5fd068", DIRE: "#e5533d", ATK: "#ff8a1f", DEF: "#4ea1ff", "TEAM 1": "#4ea1ff", "TEAM 2": "#ff5d5d" };

module.exports = { SPIELE, SPIEL_BY_ID, QUELLEN, eventInfo, TEAM_FARBEN, GEP_QUELLE };
