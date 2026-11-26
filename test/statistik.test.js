const test = require("node:test");
const assert = require("node:assert/strict");
const { Statistik } = require("../src/core/statistik");
const { migrateKonfig, standardKonfig } = require("../src/core/defaults");

test("Statistik: Runde und Match", () => {
  const s = new Statistik();
  const e = (type, x = {}) => s.add({ spiel: "cs2", type, round: 1, ...x });
  e("match_live", { round: 0 });
  e("freezetime"); e("round_live");
  e("kill", { player: "Nova", team: "T", kills: 1 });
  e("kill", { player: "Nova", team: "T", kills: 3 }); // zwei Kills zwischen zwei GSI-Ständen
  e("headshot", { player: "Nova", team: "T", kills: 3 });
  e("death", { player: "Blitz", team: "CT" });
  e("bomb_planted", { team: "T" });
  e("round_end", { team: "T" });
  e("mvp", { player: "Nova", team: "T" });
  let j = s.json();
  assert.deepEqual([j.runde.kills, j.runde.headshots, j.runde.sieger, j.runde.mvp, j.runde.bombe], [3, 1, "T", "Nova", "planted"]);
  assert.equal(j.match.runden, 1);
  assert.equal(j.match.siege.T, 1);
  assert.deepEqual([j.top[0].name, j.top[0].kills, j.top[0].headshots, j.top[0].mvps], ["Nova", 3, 1, 1]);
  e("freezetime", { round: 2 });
  j = s.json();
  assert.equal(j.runde.nr, 2);
  assert.equal(j.runde.kills, 0);
  assert.equal(j.letzteRunde.sieger, "T");
  assert.equal(j.match.kills, 3);
  s.add({ spiel: "valorant", type: "round_end", team: "T" }); // anderes Spiel: neu
  assert.equal(s.json().match.kills, 0);
});

test("Setup: nur genutzte Spiele, aktives Spiel ist immer eins davon", () => {
  const k = standardKonfig();
  assert.deepEqual(k.regie.spiele, { cs2: true, rl: true, dota2: false, valorant: false, finals: false, fortnite: false, lol: false });
  k.regie.spiele = { cs2: false, valorant: true, rl: false };
  k.regie.aktivesSpiel = "cs2";
  assert.equal(migrateKonfig(k).regie.aktivesSpiel, "valorant");
  k.regie.spiele = { cs2: false, valorant: false, rl: false };
  assert.equal(migrateKonfig(k).regie.spiele.cs2, true);
  assert.equal(migrateKonfig({ ...k, version: 3 }).version, 5);
});

test("Valorant: Rundenende erst ohne Sieger gemeldet, der nächste PC mit Team trägt den Punkt nach", () => {
  const s = new Statistik();
  const ev = (type, extra = {}) => s.add({ spiel: "valorant", type, round: 1, ...extra });
  ev("round_start");
  ev("round_end", { team: "" }); // PC ohne erkanntes Team
  ev("round_end", { team: "TEAM A" });
  ev("round_end", { team: "TEAM B" }); // zu spät, Sieger steht schon
  const j = s.json();
  assert.equal(j.match.runden, 1);
  assert.equal(j.match.siege["TEAM A"], 1);
  assert.ok(!j.match.siege["TEAM B"]);
});

test("CS2: Rundenende ohne Sieger, Sieger kommt nach", () => {
  const s = new Statistik();
  s.add({ spiel: "cs2", type: "round_live", round: 1 });
  s.add({ spiel: "cs2", type: "round_end", round: 1, team: "" });
  s.add({ spiel: "cs2", type: "round_end", round: 1, team: "CT" });
  assert.deepEqual(s.json().match.siege, { CT: 1, T: 0 });
  assert.equal(s.json().match.runden, 1);
});

test("Valorant: Rundenstart mehrfach (mehrere PCs, doppelt) zählt die Runde nicht hoch, Nummer vom PC gilt", () => {
  const s = new Statistik();
  const ev = (type, extra = {}) => s.add({ spiel: "valorant", type, ...extra });
  ev("round_start", { round: 1 });
  ev("round_start", { round: 1 });
  ev("round_start"); // ohne Nummer, Runde läuft noch
  assert.equal(s.json().runde.nr, 1);
  ev("round_end", { team: "TEAM B", round: 1 });
  ev("round_start", { round: 2 });
  assert.equal(s.json().runde.nr, 2);
  ev("round_start", { round: 5 }); // PC weiß es besser (z. B. Regie später gestartet)
  assert.equal(s.json().runde.nr, 5);
  assert.equal(s.json().match.siege["TEAM B"], 1);
});
