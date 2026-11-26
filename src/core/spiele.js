"use strict";
// Spiele, die eine Regie streamen kann. Pro Spiel eine eigene Ereignisliste.
// quelle: woher der Game-PC die Daten hat. sim: Beschriftung „eine Runde“ im Simulator (null = kein Simulator).
// Spiele mit offizieller Live-Schnittstelle (Valve GSI, Psyonix Stats API), dazu Valorant, The Finals, Fortnite und LoL (bild-spiele.js):
// über Shots Fired (Overwolf), LoL zuerst über Riots Live Client Data API, sonst über Bilderkennung.
const { EVENT_TYPES } = require("./events");
const { RL_EVENT_TYPES } = require("./rl-events");
const { DOTA_EVENT_TYPES } = require("./dota");
const { BILD_SPIELE } = require("./bild-spiele");

const QUELLEN_TEXT = { valorant: "Shots Fired, Overdrive oder Bilderkennung", lol: "Live Client Data API, Shots Fired oder Bilderkennung" };
// Match-MVP: die Regie löst es selbst aus, sobald das eingestellte Auslöser-Event kommt (Standard: Sieg / Match vorbei),
// mit dem besten Spieler aus dem Ranking des MVP-Endscreens. Die Wartezeit steht an jedem Befehl (Verzögerung in ms).
const MATCH_MVP = { id: "match_mvp", label: "Match-MVP", gruppe: "Match", team: true, spieler: true, mvp: true };
const SPIELE_ROH = [
  { id: "cs2", name: "Counter-Strike 2", kurz: "CS2", farbe: "#f2b33d", quelle: "Valve Game State Integration", teams: ["CT", "T"], events: EVENT_TYPES, sim: "Eine Runde" },
  { id: "rl", name: "Rocket League", kurz: "RL", farbe: "#3b9dff", quelle: "Psyonix Stats API", teams: ["BLUE", "ORANGE"], events: RL_EVENT_TYPES, sim: "Bis zum nächsten Tor" },
  { id: "dota2", name: "Dota 2", kurz: "DOTA", farbe: "#c0392b", quelle: "Valve Game State Integration", teams: ["RADIANT", "DIRE"], events: DOTA_EVENT_TYPES, sim: "Nächste 5 Minuten" },
  ...BILD_SPIELE.map(({ id, name, kurz, farbe, teams, events }) => ({ id, name, kurz, farbe, quelle: QUELLEN_TEXT[id] || "Shots Fired oder Bilderkennung", teams, events, sim: id === "valorant" ? "Eine Runde" : null, bild: true })),
];
const SPIELE = SPIELE_ROH.map((s) => ({ ...s, events: [...s.events, MATCH_MVP] }));
const SPIEL_BY_ID = Object.fromEntries(SPIELE.map((s) => [s.id, s]));
// Spiele, die ein Game-PC erkennen kann
const QUELLEN = SPIELE.filter((s) => s.quelle).map((s) => s.id);
// Event-IDs gelten je Spiel (z. B. „mvp“ in CS2 und Rocket League). Ohne passendes Spiel: erstes Spiel, das die ID kennt.
const eventInfo = (spiel, type) => SPIEL_BY_ID[spiel]?.events.find((e) => e.id === type) || SPIELE.map((s) => s.events.find((e) => e.id === type)).find(Boolean);

// Teamfarben wie im Spiel
const TEAM_FARBEN = { CT: "#5aa9ff", T: "#f2b33d", RED: "#e84057", BLUE: "#3b9dff", ORANGE: "#ff8a1f", RADIANT: "#5fd068", DIRE: "#e5533d", "TEAM A": "#3fd4c0", "TEAM B": "#ff4655", "TEAM C": "#ffd23f", "TEAM D": "#b779ff" };

module.exports = { MATCH_MVP, SPIELE, SPIEL_BY_ID, QUELLEN, eventInfo, TEAM_FARBEN };
