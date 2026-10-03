const test = require("node:test");
const assert = require("node:assert/strict");
const { Regie } = require("../src/core/regie");
const { RegieSim } = require("../src/core/regie-sim");
const { SimMatch } = require("../src/core/gsi-sim");
const { CsQuelle } = require("../src/core/cs-quelle");
const { standardRegie } = require("../src/core/defaults");

// 10 Game-PCs mit eigener CsQuelle spielen ein Match, alles synchron
// Ein MA3 und ein QLab, Runde → MA3-Cue, Kill → QLab-Cue nur für PC 1
const ZIELE = [{ id: "ma", typ: "ma3", name: "MA3", host: "10.0.0.5", port: 8000, optionen: { prefix: "gma3" } }, { id: "ql", typ: "qlab", name: "QLab", host: "10.0.0.6", port: 53, optionen: {} }];
const SIGNALE = { cs2: {
  round_end: [{ id: "1", ziel: "ma", befehl: "goto_cue", werte: { seq: "101", cue: "3" }, pc: "", team: "" }],
  kill: [{ id: "2", ziel: "ql", befehl: "start", werte: { cue: "K{runde}" }, pc: "PC 1", team: "" }],
} };

function lauf({ armed = false, aktivesSpiel = "cs2", spiel = "cs2", seed = 42 } = {}) {
  const cfg = { ...standardRegie(), armed, aktivesSpiel, targets: ZIELE, signale: SIGNALE };
  const gesendet = [], events = [];
  let t = 0;
  const regie = new Regie({ getConfig: () => cfg, send: (s) => gesendet.push(s), emit: (typ, d) => typ === "event" && events.push(d), now: () => t });
  const pcs = Array.from({ length: 10 }, (_, i) => ({ pcId: `PC ${i + 1}`, token: `t${i}`, quelle: new CsQuelle() }));
  pcs.forEach((p) => regie.pcVerbunden(p.pcId, { spiele: ["cs2"] }));
  const m = new SimMatch({ clients: pcs, seed });
  let runden = 0;
  while (!m.vorbei() && runden < 40) {
    for (const s of m.naechsteRunde()) {
      t += s.dt;
      for (const pl of s.payloads) {
        const pc = pcs.find((p) => p.token === pl.auth.token);
        const r = pc.quelle.ingest(pl, t);
        regie.pcStatus(pc.pcId, { spiel, status: r.status, stand: r.stand });
        for (const ev of r.events) regie.pcEvent(pc.pcId, spiel, ev);
      }
    }
    runden++;
  }
  return { regie, m, gesendet, events, runden };
}

test("Simuliertes Match: jede Runde genau ein round_end, Match-Ende einmal", () => {
  for (const seed of [1, 7, 42]) {
    const { m, events, runden } = lauf({ seed });
    assert.ok(m.vorbei());
    const ends = events.filter((e) => e.ev.type === "round_end");
    assert.equal(ends.length, runden);
    assert.equal(events.filter((e) => e.ev.type === "match_end").length, 1);
    assert.equal(events.filter((e) => e.ev.type === "match_live").length, 1);
    assert.equal(events.filter((e) => e.ev.type === "kill").length, events.filter((e) => e.ev.type === "death").length);
  }
});

test("Nicht scharf: nichts wird gesendet, Log zeigt was gesendet würde", () => {
  const { gesendet, events } = lauf();
  assert.equal(gesendet.length, 0);
  const e = events.find((x) => x.ev.type === "round_end");
  assert.equal(e.scharf, false);
  assert.deepEqual(e.befehle, [{ ziel: "MA3", typ: "ma3", nachrichten: ['/gma3/cmd "Goto Sequence 101 Cue 3"'], fehler: "" }]);
});

test("Scharf: jedes Event sendet nur seine eingestellten Befehle", () => {
  const { gesendet, events } = lauf({ armed: true });
  const ends = gesendet.filter((s) => s.ziel.id === "ma");
  assert.equal(ends.length, events.filter((e) => e.ev.type === "round_end").length);
  assert.ok(ends.every((s) => s.address === "/gma3/cmd" && s.args[0].value === "Goto Sequence 101 Cue 3"));
  const kills = gesendet.filter((s) => s.ziel.id === "ql");
  assert.equal(kills.length, events.filter((e) => e.ev.type === "kill" && e.ev.pcId === "PC 1").length, "nur Kills von PC 1");
  assert.ok(kills.length > 0);
  assert.ok(kills.every((s) => /^\/cue\/K\d+\/start$/.test(s.address)), "Runde aus dem Ereignis eingesetzt");
  assert.ok(events.filter((e) => e.ev.type === "bomb_planted").every((e) => e.gesperrt), "ohne Befehl nur im Log");
});

test("Team-Filter und mehrere Befehle für ein Event", () => {
  let t = 0;
  const cfg = { ...standardRegie(), armed: true, targets: ZIELE, signale: { cs2: { round_end: [
    { id: "a", ziel: "ma", befehl: "goto_cue", werte: { seq: "101", cue: "1" }, pc: "", team: "CT" },
    { id: "b", ziel: "ma", befehl: "goto_cue", werte: { seq: "101", cue: "2" }, pc: "", team: "T" },
    { id: "c", ziel: "ql", befehl: "go", werte: {}, pc: "", team: "" },
  ] } } };
  const gesendet = [];
  const regie = new Regie({ getConfig: () => cfg, send: (s) => gesendet.push(s), now: () => t });
  regie.pcVerbunden("PC 1", { spiele: ["cs2"] });
  regie.pcEvent("PC 1", "cs2", { type: "round_end", team: "T", round: 1 });
  assert.deepEqual(gesendet.map((s) => [s.ziel.id, s.address, s.args.map((a) => a.value)]), [["ma", "/gma3/cmd", ["Goto Sequence 101 Cue 2"]], ["ql", "/go", []]]);
});

test("Test-Knopf sendet eine Zuweisung sofort, auch wenn nicht scharf", () => {
  const cfg = { ...standardRegie(), armed: false, targets: ZIELE };
  const gesendet = [];
  const regie = new Regie({ getConfig: () => cfg, send: (s) => gesendet.push(s) });
  const k = regie.testeZuweisung("rl", "goal", { id: "x", ziel: "ql", befehl: "start", werte: { cue: "{team}" } });
  assert.deepEqual(k.nachrichten, ["/cue/BLUE/start"]);
  assert.equal(gesendet.length, 1);
  assert.equal(regie.testeZuweisung("rl", "goal", { ziel: "weg", befehl: "go" }).fehler[0], "Ziel fehlt");
});

test("Nur das aktive Spiel erzeugt OSC, andere Spiele werden verworfen", () => {
  const { gesendet, events, regie } = lauf({ armed: true, aktivesSpiel: "valorant" });
  assert.equal(events.length, 0);
  assert.equal(gesendet.length, 0);
  assert.ok(regie.snapshot().zaehler.verworfen > 0);
});

test("Simulator der Regie meldet 10 virtuelle PCs", () => {
  const cfg = standardRegie();
  const regie = new Regie({ getConfig: () => cfg, send: () => {} });
  const sim = new RegieSim({ regie });
  sim.start("runde");
  sim.stop();
  assert.equal(regie.snapshot().pcs.filter((p) => p.sim).length, 10);
  sim.neu();
  assert.equal(regie.snapshot().pcs.length, 0);
});
