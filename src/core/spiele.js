"use strict";
// Spiele, die eine Regie streamen kann. Pro Spiel eine eigene Ereignisliste.
// quelle: woher der Game-PC die Daten hat. sim: Beschriftung „eine Runde“ im Simulator (null = kein Simulator).
// Spiele mit offizieller Live-Schnittstelle (Valve GSI, Psyonix Stats API), dazu Valorant und The Finals über Bilderkennung (bild-spiele.js).
const { EVENT_TYPES } = require("./events");
const { RL_EVENT_TYPES } = require("./rl-events");
const { DOTA_EVENT_TYPES } = require("./dota");
const { BILD_SPIELE } = require("./bild-spiele");

const SPIELE = [
  { id: "cs2", name: "Counter-Strike 2", kurz: "CS2", farbe: "#f2b33d", quelle: "Valve Game State Integration", teams: ["CT", "T"], events: EVENT_TYPES, sim: "Eine Runde" },
  { id: "rl", name: "Rocket League", kurz: "RL", farbe: "#3b9dff", quelle: "Psyonix Stats API", teams: ["BLUE", "ORANGE"], events: RL_EVENT_TYPES, sim: "Bis zum nächsten Tor" },
  { id: "dota2", name: "Dota 2", kurz: "DOTA", farbe: "#c0392b", quelle: "Valve Game State Integration", teams: ["RADIANT", "DIRE"], events: DOTA_EVENT_TYPES, sim: "Nächste 5 Minuten" },
  ...BILD_SPIELE.map(({ id, name, kurz, farbe, teams, events }) => ({ id, name, kurz, farbe, quelle: "Bilderkennung", teams, events, sim: id === "valorant" ? "Eine Runde" : null, bild: true })),
];
const SPIEL_BY_ID = Object.fromEntries(SPIELE.map((s) => [s.id, s]));
// Spiele, die ein Game-PC erkennen kann
const QUELLEN = SPIELE.filter((s) => s.quelle).map((s) => s.id);
// Event-IDs gelten je Spiel (z. B. „mvp“ in CS2 und Rocket League). Ohne passendes Spiel: erstes Spiel, das die ID kennt.
const eventInfo = (spiel, type) => SPIEL_BY_ID[spiel]?.events.find((e) => e.id === type) || SPIELE.map((s) => s.events.find((e) => e.id === type)).find(Boolean);

// Teamfarben wie im Spiel
const TEAM_FARBEN = { CT: "#5aa9ff", T: "#f2b33d", BLUE: "#3b9dff", ORANGE: "#ff8a1f", RADIANT: "#5fd068", DIRE: "#e5533d", "TEAM A": "#3fd4c0", "TEAM B": "#ff4655", "TEAM C": "#ffd23f", "TEAM D": "#b779ff" };

module.exports = { SPIELE, SPIEL_BY_ID, QUELLEN, eventInfo, TEAM_FARBEN };
