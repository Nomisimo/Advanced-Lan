"use strict";
// Spiele über Overwolf Game Events (GEP): Overwatch 2, Rainbow Six Siege, Marvel Rivals, Fortnite, Apex Legends, PUBG.
// GEP läuft im Hauptprozess von ow-electron (app.overwolf.packages.gep) und meldet nur, was der Spieler an diesem PC erlebt:
//   new-game-event  { feature, key, value }            z. B. kill/kill/"4"
//   new-info-update { feature, category, key, value }  z. B. match_info/match_id/"602871308"
// Die App macht daraus Nachrichten { gep: true, art: "event" | "info", feature, key, value } und hier eigene Events.
// value ist oft ein JSON-Text oder eine Zahl als Text, deshalb wird alles vorsichtig gelesen.
// Reine Funktionen ohne Node-Abhängigkeiten: laufen im Hauptprozess und in der Browser-Vorschau.
// Doku: https://dev.overwolf.com/ow-electron/live-game-data-gep/supported-games/

const { Dedupe } = require("./events");

// JSON-Text → Objekt, sonst der Wert selbst
const wert = (v) => {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (t[0] === "{" || t[0] === "[") { try { return JSON.parse(t); } catch { return v; } }
  return v;
};
// Zahl aus "8", 8 oder { data: 8 } (Marvel Rivals)
const zahl = (v) => {
  const x = wert(v);
  const n = Number(x && typeof x === "object" ? x.data ?? x.value : x);
  return Number.isFinite(n) ? n : null;
};
const text = (v) => (v == null ? "" : String(typeof v === "object" ? "" : v));
const istRoster = (k) => /^roster_\d+$/.test(k);

const M = (id, label, x = {}) => ({ id, label, gruppe: "Match", ...x });
const R = (id, label, x = {}) => ({ id, label, gruppe: "Runde", ...x });
const P = (id, label, x = {}) => ({ id, label, gruppe: "Spieler", spieler: true, ...x });
const PT = (id, label) => P(id, label, { team: true });

// Sieg/Niederlage aus Sicht dieses PCs → Gewinnerteam
const gegner = (teams, t) => (t === teams[0] ? teams[1] : t === teams[1] ? teams[0] : "");
const sieger = (teams, eigen, ergebnis) => (/^victory$/i.test(ergebnis) ? eigen : /^defeat$/i.test(ergebnis) ? gegner(teams, eigen) : null);

// Battle Royale: Tod einmal melden, auch wenn das Spiel „death“ und „killer“ schickt
function tod(z, e) {
  if (z.todT != null && e.now - z.todT < 3000) return;
  z.todT = e.now;
  e.spieler("death");
}
function sieg(z, e) {
  if (z.sieg) return;
  z.sieg = true;
  e.global("victory", { player: z.name });
}

const TEAMS_12 = ["TEAM 1", "TEAM 2"];

const GEP_SPIELE = [
  {
    id: "ow2", owId: 10844, name: "Overwatch 2", kurz: "OW2", farbe: "#f99e1a", teams: TEAMS_12, art: "team", sim: "Eine Runde", spieler: 10,
    exe: "overwatch.exe", doku: "https://dev.overwolf.com/ow-electron/live-game-data-gep/supported-games/overwatch/",
    events: [M("match_start", "Match startet"), M("match_end", "Match vorbei"), M("match_won", "Match gewonnen", { team: true }),
      R("round_start", "Runde startet"), R("round_end", "Runde vorbei"),
      PT("kill", "Eliminierung"), PT("assist", "Assist"), PT("death", "Spieler stirbt"), PT("respawn", "Respawn"), PT("revive", "Wiederbelebt")],
    verarbeite(m, z, e) {
      const v = wert(m.value);
      if (m.art === "event") switch (m.key) {
        case "match_start": e.neuesMatch(); e.global("match_start"); break;
        case "match_end": e.global("match_end"); break;
        case "round_start": z.runde++; e.global("round_start"); break;
        case "round_end": e.global("round_end"); break;
        case "elimination": e.spieler("kill"); break;
        case "assist": e.spieler("assist"); break;
        case "death": e.spieler("death"); break;
        case "respawn": e.spieler("respawn"); break;
        case "revive": e.spieler("revive"); break;
      }
      else if (istRoster(m.key) && v && typeof v === "object" && v.is_local) { z.team = TEAMS_12[Number(v.team)] || z.team; z.name = z.name || text(v.player_name); }
      else switch (m.key) {
        case "battle_tag": z.name = text(v).split("#")[0]; break;
        case "match_id": z.match = text(v); break;
        case "pseudo_match_id": z.match = z.match || text(v); break;
        case "map": z.map = text(v); break;
        case "match_outcome": { const t = sieger(TEAMS_12, z.team, text(v)); if (t != null) e.global("match_won", { team: t }); break; }
      }
    },
  },
  {
    id: "r6", owId: 10826, name: "Rainbow Six Siege", kurz: "R6", farbe: "#8da2bb", teams: ["ATK", "DEF"], art: "runden", sim: "Eine Runde", spieler: 10,
    exe: "rainbowsix.exe", doku: "https://dev.overwolf.com/ow-electron/live-game-data-gep/supported-games/rainbow-six-siege/",
    // Team = Seite in der Runde (Angriff/Verteidigung). GEP meldet Punkte nur relativ (eigenes Team ist immer „blue“).
    events: [M("match_start", "Match startet"), M("match_end", "Match vorbei"),
      R("round_start", "Runde startet"), R("round_end", "Runde gewonnen", { team: true }),
      R("bomb_planted", "Defuser gelegt", { team: true, fest: "ATK" }), R("bomb_defused", "Defuser entschärft", { team: true, fest: "DEF" }),
      PT("kill", "Kill"), PT("headshot", "Headshot"), PT("knocked", "Spieler niedergeschlagen"), PT("death", "Spieler stirbt")],
    verarbeite(m, z, e) {
      const v = wert(m.value);
      if (m.art === "event") switch (m.key) {
        case "match_start": e.neuesMatch(); e.global("match_start"); break;
        case "match_end": e.global("match_end"); break;
        case "roundStart": e.global("round_start"); break;
        case "roundOutcome": { const t = sieger(["ATK", "DEF"], z.team, text(v)); if (t != null) e.global("round_end", { team: t, grund: z.grund || "" }); break; }
        case "defuser_planted": e.global("bomb_planted", { team: "ATK" }); break;
        case "defuser_disabled": e.global("bomb_defused", { team: "DEF" }); break;
        case "kill": e.spieler("kill"); break;
        case "headshot": e.spieler("headshot"); break;
        case "knockedout": e.spieler("knocked"); break;
        case "death": e.spieler("death"); break;
      }
      // Datenschutz (Overwolf-Regeln für R6): nur der Name, den das Spiel gerade zeigt
      else if (istRoster(m.key) && v && typeof v === "object" && v.is_local) {
        z.team = v.role === "attacker" ? "ATK" : v.role === "defender" ? "DEF" : z.team;
        if (v.player) z.name = text(v.player);
      }
      else switch (m.key) {
        case "name": z.name = z.name || text(v); break;
        case "number": z.runde = zahl(v) ?? z.runde; break;
        case "match_id": z.match = text(v); break;
        case "pseudo_match_id": z.match = z.match || text(v); break;
        case "map_id": z.map = text(v); break;
        case "round_outcome_type": z.grund = text(v); break;
        case "score": if (v && typeof v === "object") z.score = { eigen: zahl(v.blue) ?? 0, gegner: zahl(v.orange) ?? 0 }; break;
      }
    },
  },
  {
    id: "mr", owId: 24890, name: "Marvel Rivals", kurz: "MR", farbe: "#ec3c6e", teams: TEAMS_12, art: "team", sim: "Eine Runde", spieler: 12,
    exe: "marvel-win64-shipping.exe", doku: "https://dev.overwolf.com/ow-electron/live-game-data-gep/supported-games/marvel-rivals/",
    events: [M("match_start", "Match startet"), M("match_end", "Match vorbei"), M("match_won", "Match gewonnen", { team: true }),
      R("round_start", "Runde startet"), R("round_end", "Runde vorbei"),
      PT("kill", "Kill"), PT("assist", "Assist"), PT("death", "Spieler stirbt")],
    verarbeite(m, z, e) {
      const v = wert(m.value);
      if (m.art === "event") switch (m.key) {
        case "match_start": e.neuesMatch(); e.global("match_start"); break;
        case "match_end": e.global("match_end"); break;
        case "round_start": z.runde++; e.global("round_start"); break;
        case "round_end": e.global("round_end"); break;
        case "kill": e.spieler("kill"); break;
        case "assist": e.spieler("assist"); break;
        case "death": e.spieler("death"); break;
      }
      else if (istRoster(m.key) && v && typeof v === "object" && v.is_local) { z.team = TEAMS_12[Number(v.team)] || z.team; z.name = z.name || text(v.name); }
      else switch (m.key) {
        case "player_name": z.name = text(v); break;
        case "match_id": z.match = text(v); break;
        case "map": z.map = text(v); break;
        case "match_outcome": { const t = sieger(TEAMS_12, z.team, text(v)); if (t != null) e.global("match_won", { team: t }); break; }
      }
    },
  },
  {
    id: "fn", owId: 21216, name: "Fortnite", kurz: "FN", farbe: "#24d3c5", teams: [], art: "br", sim: "Nächste Zone", spieler: 8, squad: 4, lobby: 100,
    exe: "fortniteclient-win64-shipping.exe", doku: "https://dev.overwolf.com/ow-electron/live-game-data-gep/supported-games/fortnite/",
    events: [M("match_start", "Match startet"), M("victory", "Victory Royale"),
      P("kill", "Eliminierung"), P("knockout", "Gegner niedergeschlagen"), P("knocked", "Spieler niedergeschlagen"), P("death", "Spieler eliminiert"), P("revived", "Wiederbelebt")],
    verarbeite(m, z, e) {
      const v = wert(m.value);
      if (m.art === "event") switch (m.key) {
        case "matchStart": e.neuesMatch(); e.global("match_start"); break;
        case "matchEnd": z.laeuft = false; break;
        case "kill": e.spieler("kill"); break;
        case "knockout": e.spieler("knockout", { gegner: text(v) }); break;
        case "knockedout": e.spieler("knocked"); break;
        case "killer": case "death": tod(z, e); break;
        case "revived": e.spieler("revived"); break;
        case "generic": if (text(v) === "won") sieg(z, e); break;
      }
      else switch (m.key) {
        case "name": z.name = text(v); break;
        case "rank": z.platz = zahl(v); if (z.platz === 1 && z.laeuft) sieg(z, e); break;
        case "total_players": z.uebrig = zahl(v); break;
        case "total_teams": z.teams = zahl(v); break;
        case "matchID": z.match = text(v); break;
        case "pseudo_match_id": z.match = z.match || text(v); break;
        case "mode": z.map = text(v); break;
      }
    },
  },
  {
    id: "apex", owId: 21566, name: "Apex Legends", kurz: "APEX", farbe: "#ff6f61", teams: [], art: "br", sim: "Nächste Zone", spieler: 6, squad: 3, lobby: 60,
    exe: "r5apex.exe", doku: "https://dev.overwolf.com/ow-electron/live-game-data-gep/supported-games/apex-legends/",
    events: [M("match_start", "Match startet"), M("victory", "Champion (Sieg)"), M("squad_out", "Squad ausgeschieden"),
      P("kill", "Kill"), P("knockdown", "Gegner niedergeschlagen"), P("assist", "Assist"), P("knocked", "Spieler niedergeschlagen"), P("death", "Spieler stirbt")],
    verarbeite(m, z, e) {
      const v = wert(m.value);
      if (m.art === "event") switch (m.key) {
        case "match_start": e.neuesMatch(); e.global("match_start"); break;
        case "match_end": z.laeuft = false; break;
        case "kill": e.spieler("kill"); break;
        case "knockdown": e.spieler("knockdown"); break;
        case "assist": e.spieler("assist"); break;
        case "knocked_out": e.spieler("knocked"); break;
        case "death": tod(z, e); break;
      }
      else switch (m.key) {
        case "name": z.name = text(v); break;
        case "victory": if (text(v) === "true") sieg(z, e); break;
        case "team_info": if (v?.team_state === "eliminated" && z.laeuft && !z.raus) { z.raus = true; e.global("squad_out", { player: z.name, einmal: `${z.match}:${z.name}` }); } break;
        case "tabs": if (v && typeof v === "object") { z.uebrig = zahl(v.players); z.teams = zahl(v.teams); } break;
        case "match_summary": if (v && typeof v === "object") z.platz = zahl(v.rank); break;
        case "pseudo_match_id": z.match = text(v); break;
        case "map_name": z.map = text(v); break;
      }
    },
  },
  {
    id: "pubg", owId: 10906, name: "PUBG: Battlegrounds", kurz: "PUBG", farbe: "#c8a165", teams: [], art: "br", sim: "Nächste Zone", spieler: 8, squad: 4, lobby: 100,
    exe: "tslgame.exe", doku: "https://dev.overwolf.com/ow-electron/live-game-data-gep/supported-games/playerunknowns-battlegrounds/",
    events: [M("match_start", "Match startet"), M("victory", "Chicken Dinner (Sieg)"),
      P("kill", "Kill"), P("headshot", "Headshot"), P("death", "Spieler stirbt")],
    verarbeite(m, z, e) {
      const v = wert(m.value);
      if (m.art === "event") switch (m.key) {
        case "matchStart": e.neuesMatch(); e.global("match_start"); break;
        case "matchEnd": z.laeuft = false; break;
        case "kill": e.spieler("kill"); break;
        case "headshot": e.spieler("headshot"); break;
        case "killer": case "death": tod(z, e); break;
      }
      else switch (m.key) {
        case "name": z.name = text(v); break;
        case "me": z.platz = zahl(v); if (z.platz === 1) sieg(z, e); break;
        case "total": z.uebrig = zahl(v); break;
        case "match_id": z.match = text(v); break;
        case "map": z.map = text(v); break;
      }
    },
  },
];
const GEP_BY_ID = Object.fromEntries(GEP_SPIELE.map((s) => [s.id, s]));
const GEP_BY_OWID = Object.fromEntries(GEP_SPIELE.map((s) => [s.owId, s]));

// Name, Team, Match-ID und Map bleiben: sie können vor „Match startet“ kommen und werden mit dem nächsten Wert überschrieben
const neuerZustand = (alt = {}) => ({ name: alt.name || "", team: alt.team || "", runde: 0, match: alt.match || "", map: alt.map || "", score: null, platz: null, uebrig: null, teams: null, laeuft: false, sieg: false, raus: false, todT: null, n: {} });

let quellenNr = 0;

// Game-PC: GEP-Nachrichten eines Spiels → Events und Stand für die Regie
class GepQuelle {
  constructor(spiel) {
    this.spiel = spiel;
    this.def = GEP_BY_ID[spiel];
    this.z = neuerZustand();
    this.dedupe = new Dedupe();
    this.uid = `${spiel}:${++quellenNr}:${Math.random().toString(36).slice(2, 7)}`; // Spieler-Events dieses PCs
  }

  ingest(m, now = Date.now()) {
    if (!m || !this.def || typeof m.key !== "string") return { events: [], status: this.status(), stand: this.stand() };
    const z = this.z, roh = [];
    const e = {
      now,
      neuesMatch: () => { const neu = neuerZustand(z); for (const k of Object.keys(z)) delete z[k]; Object.assign(z, neu, { laeuft: true }); },
      global: (type, extra = {}) => roh.push({ type, team: "", round: z.runde, ...extra }),
      spieler: (type, extra = {}) => { z.n[type] = (z.n[type] || 0) + 1; roh.push({ type, team: z.team, player: z.name, steamid: this.uid, kills: z.n[type], round: z.runde, ...extra }); },
    };
    try { this.def.verarbeite(m, z, e); } catch { /* unerwartete Daten eines Spiels nie die App stoppen lassen */ }
    const events = roh.filter((x) => this.dedupe.accept(x, now));
    return { events, status: this.status(), stand: this.stand() };
  }

  status() {
    const z = this.z;
    return { spieler: z.name, team: z.team, kills: z.n.kill || 0, deaths: z.n.death || 0, assists: z.n.assist || 0 };
  }

  stand() {
    const z = this.z;
    if (!z.laeuft && !z.match && !z.map) return null;
    return { match: z.match, map: z.map, runde: z.runde, score: z.score, platz: z.platz, uebrig: z.uebrig, teams: z.teams, laeuft: z.laeuft };
  }
}

module.exports = { GEP_SPIELE, GEP_BY_ID, GEP_BY_OWID, GepQuelle, wert, zahl };
