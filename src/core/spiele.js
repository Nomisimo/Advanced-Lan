"use strict";
// Spiele, die eine Regie streamen kann. Pro Spiel eine eigene Ereignisliste.
const { EVENT_TYPES } = require("./events");

const SPIELE = [
  { id: "cs2", name: "Counter-Strike 2", kurz: "CS2", farbe: "#f2b33d", quelle: "Valve Game State Integration", events: EVENT_TYPES },
  { id: "valorant", name: "Valorant", kurz: "VAL", farbe: "#ff4655", quelle: null, events: [] },
  { id: "rl", name: "Rocket League", kurz: "RL", farbe: "#3b9dff", quelle: null, events: [] },
];
const SPIEL_BY_ID = Object.fromEntries(SPIELE.map((s) => [s.id, s]));

module.exports = { SPIELE, SPIEL_BY_ID };
