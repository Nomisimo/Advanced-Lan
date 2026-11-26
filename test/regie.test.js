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
  const gesendet = [], events = [], verworfen = [];
  let t = 0;
  const regie = new Regie({ getConfig: () => cfg, send: (s) => gesendet.push(s), emit: (typ, d) => typ === "event" && (d.verworfen ? verworfen : events).push(d), now: () => t });
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
  return { regie, m, gesendet, events, verworfen, runden };
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

test("Nur das aktive Spiel erzeugt OSC, andere Spiele werden verworfen und geloggt", () => {
  const { gesendet, events, verworfen, regie } = lauf({ armed: true, aktivesSpiel: "valorant" });
  assert.equal(events.length, 0);
  assert.equal(gesendet.length, 0);
  assert.ok(verworfen.length > 0 && verworfen.every((e) => e.verworfen === "anderes Spiel"));
  assert.equal(regie.snapshot().zaehler.verworfen, verworfen.length);
  assert.equal(regie.alleLogs().length, Math.min(verworfen.length, 300));
});

test("Doppelte Meldungen mehrerer PCs werden als verworfen geloggt, echte Events bleiben im eigenen Log", () => {
  const { events, verworfen, regie } = lauf();
  const doppelt = verworfen.filter((e) => e.verworfen === "doppelt");
  assert.ok(doppelt.some((e) => e.ev.type === "round_end"), "9 von 10 PCs melden round_end doppelt");
  assert.ok(regie.log.every((e) => !e.verworfen));
  assert.equal(regie.log.length, Math.min(events.length, 300));
  const alle = regie.alleLogs();
  assert.ok(alle.every((e, i) => i === 0 || alle[i - 1].id > e.id), "neueste zuerst");
});

test("Sendefehler meldet den Log-Eintrag erneut mit derselben ID", async () => {
  const cfg = { ...standardRegie(), armed: true, targets: ZIELE, signale: SIGNALE };
  const gemeldet = [];
  const regie = new Regie({ getConfig: () => cfg, send: () => Promise.reject(new Error("Netz weg")), emit: (typ, d) => typ === "event" && gemeldet.push({ id: d.id, fehler: [...d.fehler] }) });
  regie.pcVerbunden("PC 1", { spiele: ["cs2"] });
  regie.pcEvent("PC 1", "cs2", { type: "round_end", team: "T", round: 1 });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(gemeldet.length, 2);
  assert.equal(gemeldet[0].id, gemeldet[1].id);
  assert.deepEqual(gemeldet[1].fehler, ["MA3: Netz weg"]);
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

// Session-PCs verbunden: der Simulator spielt mit genau diesen PCs, ohne virtuelle SIM-PCs
// Eine Runde ohne Wartezeiten: Match anlegen, Echtzeit-Lauf anhalten, Schritte direkt zustellen
function simRunde(sim, spiel) {
  sim.start("runde", spiel);
  sim.stop();
  for (const s of sim.runner.match.naechsteRunde()) for (const p of s.payloads) sim.runner.deliver(p);
}

test("Simulator der Regie spielt mit den verbundenen Session-PCs", () => {
  const cfg = standardRegie();
  const events = [];
  const regie = new Regie({ getConfig: () => cfg, send: () => {}, emit: (typ, d) => typ === "event" && events.push(d) });
  regie.pcVerbunden("PC 02", { spiele: ["cs2"], remote: "10.0.0.12", spieler: "Kira" });
  regie.pcVerbunden("PC 01", { spiele: ["cs2"], remote: "10.0.0.11", spieler: "Momo" });
  regie.pcStatus("PC 02", { spiel: "cs2", status: { spieler: "Kira", team: "T" } });
  regie.pcVerbunden("Regie-PC", { spiele: ["cs2"], remote: "dieser PC" }); // der PC der Regie zählt nicht
  const sim = new RegieSim({ regie });
  simRunde(sim, "cs2");
  const st = sim.status();
  assert.equal(st.echt, true);
  assert.deepEqual(st.pcs, [{ pcId: "PC 01", name: "Momo", team: "CT" }, { pcId: "PC 02", name: "Kira", team: "T" }]);
  assert.equal(regie.snapshot().pcs.filter((p) => p.sim).length, 0);
  assert.ok(events.length > 0);
  assert.ok(events.every((e) => ["PC 01", "PC 02"].includes(e.ev.pcId) && e.quelle === "sim"));
  assert.ok(events.some((e) => e.ev.type === "round_end"));
  // Zurücksetzen: die PCs bleiben verbunden und bekommen ihren eigenen Stand zurück
  sim.neu();
  assert.equal(regie.pcs.size, 3);
  assert.deepEqual(regie.pcs.get("PC 02").status, { spieler: "Kira", team: "T" });
  assert.equal(regie.pcs.get("PC 01").status, undefined);
});

test("Simulator der Regie: ohne Session-PCs virtuelle PCs, beim Verbinden wechselt er", () => {
  const cfg = standardRegie();
  const regie = new Regie({ getConfig: () => cfg, send: () => {} });
  const sim = new RegieSim({ regie });
  sim.start("runde", "cs2"); sim.stop();
  assert.equal(sim.status().echt, false);
  assert.equal(regie.snapshot().pcs.filter((p) => p.sim).length, 10);
  regie.pcVerbunden("PC 01", { spiele: ["cs2"], remote: "10.0.0.11" });
  sim.start("runde", "cs2"); sim.stop();
  assert.equal(sim.status().echt, true);
  assert.deepEqual(regie.snapshot().pcs.map((p) => p.pcId), ["PC 01"]);
  regie.pcGetrennt("PC 01");
  sim.start("runde", "cs2"); sim.stop();
  assert.equal(sim.status().echt, false);
});

test("Simulator der Regie: Session-PCs in Rocket League, Dota 2 und Valorant", () => {
  for (const spiel of ["rl", "dota2", "valorant"]) {
    const cfg = { ...standardRegie(), aktivesSpiel: spiel };
    const events = [];
    const regie = new Regie({ getConfig: () => cfg, send: () => {}, emit: (typ, d) => typ === "event" && events.push(d) });
    for (let i = 1; i <= 3; i++) regie.pcVerbunden(`PC 0${i}`, { spiele: [spiel], remote: `10.0.0.1${i}`, spieler: `Spieler ${i}` });
    const sim = new RegieSim({ regie });
    simRunde(sim, spiel);
    assert.equal(sim.status().pcs.length, 3, spiel);
    assert.equal(regie.pcs.size, 3, spiel);
    assert.ok(events.length > 0, spiel);
    assert.ok(events.every((e) => e.ev.pcId.startsWith("PC 0")), spiel);
    sim.neu();
  }
});

test("Valorant: „Team steht fest“ je PC, ein Befehl je Team mit {nr} aus dem Plan", () => {
  const signale = { valorant: { team: [
    { id: "a", ziel: "ma", befehl: "goto_cue", werte: { seq: "{100+nr}", cue: "1" }, pc: "", team: "TEAM A" },
    { id: "b", ziel: "ma", befehl: "goto_cue", werte: { seq: "{100+nr}", cue: "2" }, pc: "", team: "TEAM B" },
  ] } };
  const plan = { pcs: [{ id: "1", pcId: "PC 1", rechner: "", werte: {} }, { id: "2", pcId: "PC 2", rechner: "", werte: {} }], regeln: {}, auto: false, vorlage: null, vorlageAuto: true };
  const cfg = { ...standardRegie(), armed: true, aktivesSpiel: "valorant", targets: ZIELE, signale, plan };
  const gesendet = [];
  const regie = new Regie({ getConfig: () => cfg, send: (s) => gesendet.push(s), now: () => 1000 });
  for (const pc of ["PC 1", "PC 2"]) regie.pcVerbunden(pc, { spiele: ["valorant"] });
  regie.pcEvent("PC 1", "valorant", { type: "team", team: "TEAM A", player: "PC 1", round: 0, einmal: "team:PC 1:m1:TEAM A" });
  regie.pcEvent("PC 2", "valorant", { type: "team", team: "TEAM B", player: "PC 2", round: 0, einmal: "team:PC 2:m1:TEAM B" });
  regie.pcEvent("PC 2", "valorant", { type: "team", team: "TEAM B", player: "PC 2", round: 0, einmal: "team:PC 2:m1:TEAM B" }); // doppelt
  const text = gesendet.map((s) => `${s.address} ${s.args.map((a) => a.value).join(" ")}`);
  assert.equal(gesendet.length, 2, text.join("\n"));
  assert.match(text[0], /101/);
  assert.match(text[0], /\b1\b/);
  assert.match(text[1], /102/);
});

test("Verzögerung am Befehl: sendet erst nach der eingestellten Zeit, und nur wenn die Ausgabe dann noch an ist", () => {
  const cfg = { ...standardRegie(), armed: true, aktivesSpiel: "cs2", targets: ZIELE, signale: { cs2: { round_end: [{ id: "1", ziel: "ma", befehl: "goto_cue", werte: { seq: "1", cue: "2" }, pc: "", team: "", verzoegerung: 3000 }] } } };
  const gesendet = [], uhr = [];
  let t = 0;
  const regie = new Regie({ getConfig: () => cfg, send: (s) => gesendet.push(s), now: () => (t += 10000), timer: (fn, ms) => uhr.push({ fn, ms }) });
  regie.pcVerbunden("PC 1", { spiele: ["cs2"] });
  const e = regie.pcEvent("PC 1", "cs2", { type: "round_end", team: "CT", round: 1 });
  assert.equal(gesendet.length, 0);
  assert.equal(e.befehle[0].ms, 3000);
  assert.deepEqual(uhr.map((u) => u.ms), [3000]);
  uhr[0].fn();
  assert.equal(gesendet.length, 1);
  regie.pcEvent("PC 1", "cs2", { type: "round_end", team: "CT", round: 2 });
  cfg.armed = false;
  uhr[1].fn();
  assert.equal(gesendet.length, 1);
});

test("Match-MVP: kommt nach dem Auslöser-Event mit dem besten Spieler, Auslöser einstellbar", () => {
  const cfg = { ...standardRegie(), armed: true, aktivesSpiel: "valorant", targets: ZIELE, signale: { valorant: { match_mvp: [{ id: "m", ziel: "ql", befehl: "start", werte: { cue: "MVP {spieler}" }, pc: "", team: "", verzoegerung: 3000 }] } } };
  const gesendet = [], uhr = [], events = [];
  let t = 0;
  const regie = new Regie({ getConfig: () => cfg, send: (s) => gesendet.push(s), emit: (typ, d) => typ === "event" && !d.verworfen && events.push(d), now: () => (t += 10000), timer: (fn, ms) => uhr.push({ fn, ms }) });
  for (const pc of ["PC 1", "PC 2"]) regie.pcVerbunden(pc, { spiele: ["valorant"] });
  for (let i = 0; i < 3; i++) regie.pcEvent("PC 2", "valorant", { type: "kill", player: "PC 2", team: "TEAM B", round: i + 1 });
  regie.pcEvent("PC 1", "valorant", { type: "kill", player: "PC 1", team: "TEAM A", round: 1 });
  regie.pcEvent("PC 1", "valorant", { type: "match_won", team: "TEAM B" });
  const mvp = events.find((e) => e.ev.type === "match_mvp");
  assert.ok(mvp, "Match-MVP fehlt");
  assert.equal(mvp.ev.pcId, "PC 2");
  assert.equal(gesendet.length, 0);
  uhr.at(-1).fn();
  assert.equal(gesendet.length, 1);
  // anderer Auslöser
  cfg.mvpNach = { valorant: "match_end" };
  const vorher = events.length;
  regie.pcEvent("PC 1", "valorant", { type: "match_won", team: "TEAM A" });
  assert.equal(events.slice(vorher).filter((e) => e.ev.type === "match_mvp").length, 0);
  regie.pcEvent("PC 1", "valorant", { type: "match_end" });
  assert.equal(events.slice(vorher).filter((e) => e.ev.type === "match_mvp").length, 1);
});

test("Test-Knopf mit Seiten-Filter: Verteidigung sendet genauso wie Angriff", () => {
  const cfg = { ...standardRegie(), aktivesSpiel: "valorant", targets: ZIELE };
  const gesendet = [];
  const regie = new Regie({ getConfig: () => cfg, send: (s) => gesendet.push(s) });
  for (const seite of ["Angriff", "Verteidigung"]) {
    const k = regie.testeZuweisung("valorant", "round_end", { id: "s", ziel: "ql", befehl: "start", werte: { cue: "{seite}" }, pc: "", team: "", seite });
    assert.deepEqual(k.fehler, []);
    assert.equal(k.nachrichten.length, 1);
    assert.match(k.nachrichten[0], new RegExp(seite));
  }
  assert.equal(gesendet.length, 2);
});
