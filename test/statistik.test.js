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
  assert.deepEqual(j.top[0], { name: "Nova", team: "T", kills: 3, tode: 0, headshots: 1, mvps: 1 });
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
  assert.deepEqual(k.regie.spiele, { cs2: true, valorant: false, rl: false });
  k.regie.spiele = { cs2: false, valorant: true, rl: false };
  k.regie.aktivesSpiel = "cs2";
  assert.equal(migrateKonfig(k).regie.aktivesSpiel, "valorant");
  k.regie.spiele = { cs2: false, valorant: false, rl: false };
  assert.equal(migrateKonfig(k).regie.spiele.cs2, true);
  assert.equal(migrateKonfig({ ...k, version: 3 }).version, 4);
});
