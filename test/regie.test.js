const test = require("node:test");
const assert = require("node:assert/strict");
const { Regie } = require("../src/core/regie");
const { RegieSim } = require("../src/core/regie-sim");
const { SimMatch } = require("../src/core/gsi-sim");
const { CsQuelle } = require("../src/core/cs-quelle");
const { standardRegie } = require("../src/core/defaults");

// 10 Game-PCs mit eigener CsQuelle spielen ein Match, alles synchron
function lauf({ armed = false, aktivesSpiel = "cs2", spiel = "cs2", seed = 42 } = {}) {
  const cfg = { ...standardRegie(), armed, aktivesSpiel };
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
  assert.ok(events.some((e) => e.address === "/lan/cs2/round_end" && !e.scharf));
});

test("Scharf: neutrale Signale gehen an alle Ziele", () => {
  const { gesendet, events } = lauf({ armed: true });
  assert.ok(gesendet.some((s) => s.address === "/lan/cs2/round_end"));
  assert.ok(gesendet.some((s) => /^\/lan\/cs2\/pc\d+\/kill$/.test(s.address)));
  assert.equal(gesendet.length, events.length); // ein Ziel
  assert.ok(gesendet.every((s) => s.address.startsWith("/lan/") && !s.address.includes("gma3")));
});

test("Gesperrte Ereignisse erscheinen im Log, werden aber nicht gesendet", () => {
  let t = 0;
  const cfg = { ...standardRegie(), armed: true, signale: { cs2: { kill: false } } };
  const gesendet = [];
  const regie = new Regie({ getConfig: () => cfg, send: (s) => gesendet.push(s), now: () => t });
  regie.pcVerbunden("PC 1", { spiele: ["cs2"] });
  const k = regie.pcEvent("PC 1", "cs2", { type: "kill", team: "T", player: "Nova", steamid: "1", round: 1, kills: 1 });
  const r = regie.pcEvent("PC 1", "cs2", { type: "round_end", team: "T", round: 1 });
  assert.equal(k.gesperrt, true);
  assert.equal(r.gesperrt, false);
  assert.deepEqual(gesendet.map((s) => s.address), ["/lan/cs2/round_end"]);
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
