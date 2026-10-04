const test = require("node:test");
const assert = require("node:assert/strict");
const { statsDaten, statsEvents } = require("../src/core/stats-screen");
const { Statistik } = require("../src/core/statistik");
const { SPIEL_BY_ID } = require("../src/core/spiele");
const { migrateKonfig, standardKonfig } = require("../src/core/defaults");

test("Stats-Screen ohne Daten: leer, mit Teams für CS2", () => {
  const d = statsDaten(SPIEL_BY_ID.cs2, null, null);
  assert.equal(d.leer, true);
  assert.deepEqual(d.teams.map((t) => t.name), ["CT", "T"]);
  assert.equal(statsDaten(undefined, null, null).leer, true);
});

test("Stats-Screen CS2: Spielstand aus dem Stand, Bestenliste aus der Statistik", () => {
  const s = new Statistik();
  s.add({ spiel: "cs2", type: "round_live", round: 3 });
  s.add({ spiel: "cs2", type: "kill", player: "Momo", team: "CT", kills: 2, round: 3 });
  s.add({ spiel: "cs2", type: "headshot", player: "Momo", team: "CT" });
  const d = statsDaten(SPIEL_BY_ID.cs2, s.json(), { spiel: "cs2", ct: 7, tt: 5, map: "de_mirage", rundenPhase: "live" });
  assert.equal(d.leer, false);
  assert.deepEqual(d.teams.map((t) => [t.name, t.score]), [["CT", 7], ["T", 5]]);
  assert.equal(d.mitte.gross, "Runde 3");
  assert.equal(d.mitte.klein, "Runde läuft");
  assert.ok(d.chips.includes("de_mirage"));
  assert.equal(d.top[0].name, "Momo");
  assert.equal(d.top[0].kills, 2);
  assert.deepEqual(d.zahlen.find(([l]) => l === "HS-Quote"), ["HS-Quote", "50%"]);
});

test("Stats-Screen Rocket League: Tore, Spielzeit, Verlängerung", () => {
  const d = statsDaten(SPIEL_BY_ID.rl, null, { spiel: "rl", blau: 2, orange: 3, zeit: 65, overtime: true, arena: "DFH Stadium" });
  assert.deepEqual(d.teams.map((t) => t.score), [2, 3]);
  assert.equal(d.mitte.gross, "+1:05");
  assert.equal(d.mitte.klein, "Verlängerung");
});

test("Stats-Screen Dota 2 und Battle Royale", () => {
  const dota = statsDaten(SPIEL_BY_ID.dota2, null, { spiel: "dota2", score: { RADIANT: 12, DIRE: 9 }, zeit: 754, phase: "GAME_IN_PROGRESS", tag: false });
  assert.deepEqual(dota.teams.map((t) => t.score), [12, 9]);
  assert.equal(dota.mitte.gross, "12:34");
  assert.ok(dota.chips.includes("Nacht"));
  assert.ok(dota.spalten.some(([k]) => k === "assists"));
  const s = new Statistik();
  s.add({ spiel: "fn", type: "victory", player: "Kira" });
  const fn = statsDaten(SPIEL_BY_ID.fn, s.json(), { spiel: "fn", uebrig: 1 });
  assert.equal(fn.teams, null);
  assert.deepEqual(fn.br, { uebrig: 1, sieger: "Kira" });
  assert.equal(fn.vorbei, true);
});

test("Stats-Screen: Statistik eines anderen Spiels zählt nicht", () => {
  const s = new Statistik();
  s.add({ spiel: "rl", type: "goal", player: "X", team: "BLUE" });
  const d = statsDaten(SPIEL_BY_ID.cs2, s.json(), null);
  assert.equal(d.leer, true);
  assert.equal(d.top.length, 0);
});

test("Stats-Screen: letzte Events nur echte des aktiven Spiels", () => {
  const log = [
    { id: 4, ev: { spiel: "cs2", type: "kill" } },
    { id: 3, ev: { spiel: "rl", type: "goal" } },
    { id: 2, ev: { spiel: "cs2", type: "kill" }, verworfen: "doppelt" },
    { id: 1, ev: { spiel: "cs2", type: "ace" } },
  ];
  assert.deepEqual(statsEvents(log, "cs2").map((e) => e.id), [4, 1]);
  assert.equal(statsEvents(log, "cs2", 1).length, 1);
});

test("Einstellungen: Standalone-Modus und Stats-Screen", () => {
  const k = standardKonfig();
  assert.deepEqual(k.regie.stats, { an: false, ndi: false, ndiName: "Advanced LAN Stats" });
  k.modus = "standalone";
  k.regie.stats = { an: true, ndi: true, ndiName: "  Bühne  ", fremd: 1 };
  const m = migrateKonfig(JSON.parse(JSON.stringify(k)));
  assert.equal(m.modus, "standalone");
  assert.deepEqual(m.regie.stats, { an: true, ndi: true, ndiName: "Bühne" });
  assert.equal(migrateKonfig({ ...k, modus: "quatsch" }).modus, null);
  assert.equal(migrateKonfig({ ...k, regie: { ...k.regie, stats: { an: 1, ndiName: "" } } }).regie.stats.ndiName, "Advanced LAN Stats");
});
