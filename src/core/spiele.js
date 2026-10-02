"use strict";
// Spiele, die eine Regie streamen kann. Pro Spiel eine eigene Ereignisliste.
const { EVENT_TYPES } = require("./events");
const { RL_EVENT_TYPES } = require("./rl-events");

const SPIELE = [
  { id: "cs2", name: "Counter-Strike 2", kurz: "CS2", farbe: "#f2b33d", quelle: "Valve Game State Integration", events: EVENT_TYPES },
  { id: "valorant", name: "Valorant", kurz: "VAL", farbe: "#ff4655", quelle: null, events: [] },
  { id: "rl", name: "Rocket League", kurz: "RL", farbe: "#3b9dff", quelle: "Psyonix Stats API", events: RL_EVENT_TYPES },
];
const SPIEL_BY_ID = Object.fromEntries(SPIELE.map((s) => [s.id, s]));
// Event-IDs gelten je Spiel (z. B. „mvp“ in CS2 und Rocket League). Ohne passendes Spiel: erstes Spiel, das die ID kennt.
const eventInfo = (spiel, type) => SPIEL_BY_ID[spiel]?.events.find((e) => e.id === type) || SPIELE.map((s) => s.events.find((e) => e.id === type)).find(Boolean);

module.exports = { SPIELE, SPIEL_BY_ID, eventInfo };
