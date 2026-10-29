const test = require("node:test");
const assert = require("node:assert/strict");
const { Regie } = require("../src/core/regie");
const { standardRegie, migrateKonfig } = require("../src/core/defaults");
const { matchGruppen, matchWahl } = require("../src/core/match-check");

const rl = (pcId, match) => ({ pcId, verbunden: true, spiel: "rl", stand: { match, arena: "DFH" } });
const cs = (pcId, map, ct, tt) => ({ pcId, verbunden: true, spiel: "cs2", stand: { map, ct, tt } });

test("Matches: RL nach MatchGuid, größtes zuerst", () => {
  const g = matchGruppen([rl("PC 1", "X1"), rl("PC 2", "X2"), rl("PC 3", "X2"), { ...rl("PC 4", "X2"), verbunden: false }, { pcId: "PC 5", verbunden: true, spiel: "rl", stand: null }], "rl");
  assert.deepEqual(g.map((x) => [x.id, x.pcs]), [["rl:X2", ["PC 2", "PC 3"]], ["rl:X1", ["PC 1"]]]);
});

test("Matches: CS2 nach Map und Spielstand, Valorant nach MatchID", () => {
  const g = matchGruppen([cs("A", "de_mirage", 3, 2), cs("B", "de_mirage", 3, 3), cs("C", "de_inferno", 0, 1), cs("D", "de_inferno", 0, 1), cs("E", "de_inferno", 1, 1)], "cs2");
  assert.deepEqual(g.map((x) => x.pcs), [["C", "D", "E"], ["A", "B"]]);
  assert.equal(g[0].id, "cs2:de_inferno:C");
  const v = (pcId, match) => ({ pcId, verbunden: true, spiel: "valorant", stand: { match } });
  assert.deepEqual(matchGruppen([v("A", "m1"), v("B", "m1"), v("C", "m2")], "valorant").map((x) => x.id), ["valorant:m1", "valorant:m2"]);
});

test("Match-Wahl: automatisch das größte, ohne Hin und Her bei Gleichstand", () => {
  const g = (id, pcs) => ({ id, pcs, anzahl: pcs.length });
  const a = g("rl:A", ["1", "2"]), b = g("rl:B", ["3", "4"]), c = g("rl:C", ["3", "4", "5"]);
  assert.equal(matchWahl([b, a], { auto: true }, { id: "rl:A", pcs: a.pcs }).id, "rl:A");
  assert.equal(matchWahl([c, a], { auto: true }, { id: "rl:A", pcs: a.pcs }).id, "rl:C");
  // fest gewählt: bleibt beim kleineren
  assert.equal(matchWahl([c, a], { auto: false, wahl: "rl:A" }, { id: "", pcs: [] }).id, "rl:A");
  // fest gewählt und das Match ist vorbei: folgt seinen PCs ins nächste
  const neu = g("rl:N", ["1", "2"]);
  assert.equal(matchWahl([c, neu], { auto: false, wahl: "rl:A" }, { id: "rl:A", pcs: a.pcs, folgt: "rl:A" }).id, "rl:N");
  assert.equal(matchWahl([], { auto: true }), null);
});

test("Regie: Events aus anderen Matches werden verworfen, Statistik nur aus dem gewählten", () => {
  const cfg = { ...standardRegie(), aktivesSpiel: "rl" };
  const regie = new Regie({ getConfig: () => cfg, send: () => {} });
  for (const [pc, m] of [["PC 1", "A"], ["PC 2", "A"], ["PC 3", "B"]]) {
    regie.pcVerbunden(pc, { spiele: ["rl"] });
    regie.pcStatus(pc, { spiel: "rl", status: {}, stand: { match: m, arena: "DFH", blau: 0, orange: 0 } });
  }
  assert.equal(regie.snapshot().match, "rl:A");
  assert.deepEqual(regie.snapshot().matches.map((m) => m.anzahl), [2, 1]);
  assert.ok(regie.pcEvent("PC 1", "rl", { type: "goal", team: "BLUE", player: "X" }));
  assert.equal(regie.pcEvent("PC 3", "rl", { type: "goal", team: "ORANGE", player: "Y" }), null);
  assert.equal(regie.verworfenLog[0].verworfen, "anderes Match");
  assert.equal(regie.statistik.match.tore.BLUE, 1);
  assert.equal(regie.statistik.match.tore.ORANGE, 0);
  // Auf Match B schalten: B zählt, A nicht mehr, die Statistik beginnt neu
  cfg.match = { auto: false, wahl: "rl:B" };
  regie.matchAktualisieren();
  assert.equal(regie.snapshot().match, "rl:B");
  assert.equal(regie.statistik.match.tore.BLUE, 0);
  assert.ok(regie.pcEvent("PC 3", "rl", { type: "goal", team: "ORANGE", player: "Y" }));
  assert.equal(regie.pcEvent("PC 2", "rl", { type: "goal", team: "BLUE", player: "X" }), null);
  // PC ohne Matchdaten zählt immer
  regie.pcVerbunden("PC 4", { spiele: ["rl"] });
  assert.ok(regie.pcEvent("PC 4", "rl", { type: "demolition", team: "BLUE", player: "Z" }));
});

test("Einstellung Match: automatisch ist Standard und übersteht das Laden", () => {
  assert.deepEqual(standardRegie().match, { auto: true, wahl: "" });
  const k = migrateKonfig({ version: 5, regie: { match: { auto: false, wahl: "rl:A" } } });
  assert.deepEqual(k.regie.match, { auto: false, wahl: "rl:A" });
  assert.deepEqual(migrateKonfig({ version: 5, regie: {} }).regie.match, { auto: true, wahl: "" });
});
