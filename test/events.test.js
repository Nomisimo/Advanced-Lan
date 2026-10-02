const test = require("node:test");
const assert = require("node:assert/strict");
const { detectEvents, Dedupe } = require("../src/core/events");

const basis = (o = {}) => ({
  provider: { steamid: "1" },
  map: { name: "de_mirage", phase: "live", round: 3, team_ct: { score: 2 }, team_t: { score: 1 } },
  round: { phase: "live" },
  player: { steamid: "1", name: "Blitz", team: "CT", state: { health: 100, round_kills: 0, round_killhs: 0, flashed: 0 }, match_stats: { mvps: 0 } },
  ...o,
});
const typen = (a, b) => detectEvents(a, b).map((e) => e.type);
const mitSpieler = (st, ms) => basis({ player: { ...basis().player, state: { ...basis().player.state, ...st }, match_stats: { mvps: 0, ...ms } } });

test("erster Kontakt erzeugt keine Ereignisse", () => {
  assert.deepEqual(detectEvents(undefined, basis()), []);
});

test("Rundenphasen und Sieger", () => {
  assert.deepEqual(typen(basis({ round: { phase: "freezetime" } }), basis()), ["round_live"]);
  const e = detectEvents(basis(), basis({ round: { phase: "over", win_team: "T" } }));
  assert.equal(e[0].type, "round_end");
  assert.equal(e[0].team, "T");
  assert.equal(e[0].map, "de_mirage");
});

test("Bombe gelegt, entschärft, explodiert", () => {
  assert.deepEqual(typen(basis(), basis({ round: { phase: "live", bomb: "planted" } })), ["bomb_planted"]);
  const d = detectEvents(basis({ round: { phase: "live", bomb: "planted" } }), basis({ round: { phase: "over", bomb: "defused", win_team: "CT" } }));
  assert.deepEqual(d.map((e) => e.type), ["round_end", "bomb_defused"]);
  assert.equal(d[1].team, "CT");
});

test("Match-Start und -Ende mit Gewinner", () => {
  assert.deepEqual(typen(basis({ map: { ...basis().map, phase: "warmup" } }), basis()), ["match_live"]);
  const halbzeit = typen(basis({ map: { ...basis().map, phase: "intermission" } }), basis());
  assert.deepEqual(halbzeit, []);
  const e = detectEvents(basis(), basis({ map: { ...basis().map, phase: "gameover", team_ct: { score: 13 }, team_t: { score: 9 } } }));
  assert.equal(e[0].type, "match_end");
  assert.equal(e[0].team, "CT");
});

test("Kills, Headshot, Mehrfachkills, Tod, MVP", () => {
  assert.deepEqual(typen(mitSpieler({}), mitSpieler({ round_kills: 1, round_killhs: 1 })), ["kill", "headshot"]);
  assert.deepEqual(typen(mitSpieler({ round_kills: 2 }), mitSpieler({ round_kills: 3 })), ["kill", "multikill_3"]);
  assert.deepEqual(typen(mitSpieler({ round_kills: 2 }), mitSpieler({ round_kills: 4 })), ["kill", "multikill_4"]);
  assert.deepEqual(typen(mitSpieler({ round_kills: 4 }), mitSpieler({ round_kills: 5 })), ["kill", "ace"]);
  assert.deepEqual(typen(mitSpieler({ health: 40 }), mitSpieler({ health: 0 })), ["death"]);
  assert.deepEqual(typen(mitSpieler({}, { mvps: 1 }), mitSpieler({}, { mvps: 2 })), ["mvp"]);
  assert.deepEqual(typen(mitSpieler({}), mitSpieler({ flashed: 255 })), ["flashed"]);
  const k = detectEvents(mitSpieler({}), mitSpieler({ round_kills: 1 }))[0];
  assert.equal(k.player, "Blitz");
  assert.equal(k.team, "CT");
});

test("Zuschauen nach dem Tod zählt nicht als Kill", () => {
  const anderer = basis({ player: { steamid: "2", name: "Nova", team: "CT", state: { health: 100, round_kills: 3 }, match_stats: {} } });
  assert.deepEqual(typen(mitSpieler({ health: 0 }), anderer), []);
});

test("Observer mit allplayers meldet alle Spieler", () => {
  const obs = (k) => ({ ...basis(), player: undefined, allplayers: { 7: { name: "Viper", team: "T", state: { health: 100, round_kills: k }, match_stats: {} } } });
  const e = detectEvents(obs(0), obs(1));
  assert.equal(e[0].type, "kill");
  assert.equal(e[0].steamid, "7");
});

test("Dedupe: dasselbe Ereignis von mehreren Clients zählt einmal", () => {
  const d = new Dedupe();
  const ev = { type: "round_end", team: "CT" };
  assert.equal(d.accept(ev, 1000), true);
  assert.equal(d.accept(ev, 1200), false);
  assert.equal(d.accept({ type: "round_end", team: "T" }, 1300), true);
  assert.equal(d.accept(ev, 20000), true);
  assert.equal(d.accept({ type: "kill", steamid: "1", kills: 1 }, 1000), true);
  assert.equal(d.accept({ type: "kill", steamid: "1", kills: 2 }, 1100), true);
  assert.equal(d.accept({ type: "kill", steamid: "1", kills: 2 }, 1150), false);
});
