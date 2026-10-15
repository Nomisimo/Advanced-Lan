"use strict";
// Beispieldaten für den Editor des Game-Stats-Screens: ein laufendes Match des gewählten Spiels,
// damit man das Layout auch ohne echtes Spiel mit gefüllten Anzeigen sieht.
const { Statistik } = require("./statistik");

const NAMEN = ["Momo", "Kira", "Flux", "Nova", "Rex", "Juno", "Blitz", "Echo"];

// spiel: Eintrag aus SPIELE → { regie: { aktivesSpiel, statistik, stand }, log }
function statsBeispiel(spiel, jetzt = Date.now()) {
  if (!spiel) return { regie: null, log: [] };
  const teams = spiel.teams?.length >= 2 ? spiel.teams : ["TEAM A", "TEAM B"];
  const s = new Statistik();
  const log = [];
  let nr = 0;
  const ev = (e) => { const x = { spiel: spiel.id, ...e }; s.add(x); log.unshift({ id: `bsp${++nr}`, t: jetzt - (120 - nr) * 4000, ev: x }); };
  const spieler = (i) => ({ player: NAMEN[i % NAMEN.length], team: teams[i % 2] });
  let stand;
  if (spiel.id === "rl") {
    ev({ type: "match_start" });
    [0, 1, 2, 3, 0, 1, 4, 5].forEach((i, k) => { ev({ type: "shot", ...spieler(i) }); if (k % 3 === 0) ev({ type: "save", ...spieler(i + 1) }); });
    ev({ type: "goal", ...spieler(0), speed: 112 }); ev({ type: "assist", ...spieler(2) });
    ev({ type: "demolition", ...spieler(3) });
    ev({ type: "goal", ...spieler(1), speed: 87 });
    ev({ type: "goal", ...spieler(4), speed: 134 });
    stand = { spiel: "rl", blau: 2, orange: 1, zeit: 154, arena: "DFH Stadium", t: jetzt };
  } else if (spiel.id === "cs2") {
    for (let r = 1; r <= 16; r++) { ev({ type: "round_live", round: r }); ev({ type: "round_end", round: r, team: r % 2 || r > 14 ? "CT" : "T" }); }
    ev({ type: "multikill_3", ...spieler(0) });
    ev({ type: "round_live", round: 17 });
    [0, 1, 2, 0, 3, 4, 0, 5, 2, 1, 0, 3].forEach((i, k) => { ev({ type: "kill", ...spieler(i), round: 17 }); if (k % 3 === 0) ev({ type: "headshot", ...spieler(i) }); ev({ type: "death", ...spieler(i + 1) }); });
    ev({ type: "mvp", ...spieler(0) });
    ev({ type: "bomb_planted", ...spieler(1) });
    stand = { spiel: "cs2", ct: 9, tt: 7, map: "de_mirage", rundenPhase: "live", runde: 17, phase: "live", bombe: "planted", t: jetzt };
  } else {
    ev({ type: "match_start" });
    if (!spiel.id.startsWith("dota")) ev({ type: "round_start", round: 12 });
    [0, 1, 2, 0, 3, 4, 0, 5, 2, 1].forEach((i, k) => { ev({ type: "kill", ...spieler(i) }); ev({ type: "death", ...spieler(i + 1) }); if (k % 2 === 0) ev({ type: "assist", ...spieler(i + 2) }); if (k % 3 === 0) ev({ type: "headshot", ...spieler(i) }); });
    if (spiel.id === "dota2") { ev({ type: "tower_destroyed", team: teams[0] }); ev({ type: "roshan_killed", team: teams[1] }); }
    stand = spiel.id === "dota2"
      ? { spiel: "dota2", score: { [teams[0]]: 14, [teams[1]]: 11 }, zeit: 1234, phase: "GAME_IN_PROGRESS", tag: true, t: jetzt }
      : { spiel: spiel.id, runde: 12, map: "Ascent", score: {}, laeuft: true, t: jetzt };
    const st = s.json();
    st.match.siege = { [teams[0]]: 7, [teams[1]]: 4 };
    return { regie: { aktivesSpiel: spiel.id, statistik: st, stand }, log };
  }
  return { regie: { aktivesSpiel: spiel.id, statistik: s.json(), stand }, log };
}

module.exports = { statsBeispiel };
