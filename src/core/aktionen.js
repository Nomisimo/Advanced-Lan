"use strict";
// Allgemeine Aktionen (Tab „Signale“, Bereich „Allgemein“): Ereignisse, die es in fast jedem Spiel gibt.
// Was hier eingerichtet ist, gilt für jedes Spiel, dessen Event zur Aktion gehört. Im Spiel lässt es sich ergänzen
// (eigene Befehle zusätzlich) oder ersetzen (nur die eigenen Befehle, die allgemeinen gelten für dieses Event nicht).
//
//   cfg.signale.allgemein = { [aktion]: [zuweisung …] }    wie bei einem Spiel, nur ohne Team-Filter
//   cfg.ersetzt = { [spiel]: [event …] }                    Events, bei denen die allgemeinen Befehle nicht gelten

const ALLGEMEIN = "allgemein";

const AKTIONEN = [
  { id: "kill", label: "Kill", gruppe: "Spieler", spieler: true, events: { cs2: ["kill"], valorant: ["kill"], dota2: ["kill"], finals: ["kill"], rl: ["demolition"] } },
  { id: "death", label: "Tod", gruppe: "Spieler", spieler: true, events: { cs2: ["death"], valorant: ["death"], dota2: ["death"], finals: ["death"] } },
  { id: "headshot", label: "Headshot", gruppe: "Spieler", spieler: true, events: { cs2: ["headshot"], valorant: ["headshot"] } },
  { id: "assist", label: "Assist", gruppe: "Spieler", spieler: true, events: { valorant: ["assist"], dota2: ["assist"], rl: ["assist"] } },
  { id: "ace", label: "Ace / Serie", gruppe: "Spieler", spieler: true, events: { cs2: ["ace"], valorant: ["ace"], dota2: ["rampage"], finals: ["team_wipe"], rl: ["hat_trick"] } },
  { id: "mvp", label: "MVP", gruppe: "Spieler", spieler: true, events: { cs2: ["mvp"], rl: ["mvp"] } },
  { id: "objective", label: "Objective (Bombe, Spike, Tor, Turm, Cashout)", gruppe: "Ziel", events: { cs2: ["bomb_planted"], valorant: ["spike_planted"], rl: ["goal"], dota2: ["tower_destroyed"], finals: ["cashout_done"] } },
  { id: "round_start", label: "Runde startet", gruppe: "Runde", events: { cs2: ["round_live"], valorant: ["round_start"], finals: ["round_start"], rl: ["kickoff"] } },
  { id: "round_end", label: "Runde vorbei", gruppe: "Runde", events: { cs2: ["round_end"], valorant: ["round_end"], finals: ["round_end"] } },
  { id: "match_start", label: "Match startet", gruppe: "Match", events: { cs2: ["match_live"], valorant: ["match_start"], rl: ["match_start"], dota2: ["match_start"], finals: ["match_start"] } },
  { id: "win", label: "Sieg / Match vorbei", gruppe: "Match", events: { cs2: ["match_end"], valorant: ["match_won"], rl: ["match_end"], dota2: ["match_end"], finals: ["match_won"] } },
];

// Allgemeine Aktion eines Spiel-Events, sonst null
const aktionVon = (spiel, type) => AKTIONEN.find((a) => a.events[spiel]?.includes(type)) || null;

const istErsetzt = (cfg, spiel, type) => Array.isArray(cfg?.ersetzt?.[spiel]) && cfg.ersetzt[spiel].includes(type);

// Allgemeine Befehle, die für dieses Spiel-Event gelten (leer, wenn ersetzt oder ohne Aktion)
function geerbt(cfg, spiel, type) {
  const a = aktionVon(spiel, type);
  if (!a || istErsetzt(cfg, spiel, type)) return [];
  const l = cfg?.signale?.[ALLGEMEIN]?.[a.id];
  return Array.isArray(l) ? l : [];
}

// Zustand eines Spiel-Events für die Anzeige: ohne (keine Aktion), erbt, ergaenzt, ersetzt
function modus(cfg, spiel, type) {
  if (!aktionVon(spiel, type)) return "ohne";
  if (istErsetzt(cfg, spiel, type)) return "ersetzt";
  const eigen = cfg?.signale?.[spiel]?.[type];
  return Array.isArray(eigen) && eigen.length ? "ergaenzt" : "erbt";
}

function migrateErsetzt(e) {
  const out = {};
  if (e && typeof e === "object") for (const [spiel, l] of Object.entries(e)) if (Array.isArray(l)) { const ids = [...new Set(l.filter((x) => typeof x === "string"))]; if (ids.length) out[spiel] = ids; }
  return out;
}

module.exports = { ALLGEMEIN, AKTIONEN, aktionVon, istErsetzt, geerbt, modus, migrateErsetzt };
