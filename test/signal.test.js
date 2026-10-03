const test = require("node:test");
const assert = require("node:assert/strict");
const { baueNachrichten, befehleFuer, parseArgs, zeigeNachricht, testNachricht } = require("../src/core/signal");
const { ZIEL_TYPEN, befehleVon } = require("../src/core/ziel-typen");
const { encodeMessage } = require("../src/core/osc");
const { standardKonfig, migrateKonfig } = require("../src/core/defaults");
const { gsiCfg } = require("../src/core/cfg");

const ma3 = { id: "m", typ: "ma3", name: "MA3", host: "10.0.0.5", port: 8000, optionen: { prefix: "gma3" } };

test("Befehle aus der Ziel-Datenbank: Werte und Platzhalter aus dem Ereignis", () => {
  const ev = { spiel: "rl", type: "goal", team: "ORANGE", player: "Momo", pcId: "PC 03", round: 2 };
  assert.deepEqual(baueNachrichten(ma3, { befehl: "goto_cue", werte: { seq: "101", cue: "3" } }, ev), [{ address: "/gma3/cmd", args: [{ type: "s", value: "Goto Sequence 101 Cue 3" }] }]);
  assert.equal(baueNachrichten({ ...ma3, optionen: { prefix: "" } }, { befehl: "go", werte: { seq: "7" } })[0].address, "/cmd", "ohne Prefix");
  assert.deepEqual(baueNachrichten({ typ: "qlab" }, { befehl: "start", werte: { cue: "{team}-{runde}" } }, ev)[0].address, "/cue/ORANGE-2/start");
  const r = baueNachrichten({ typ: "reaper" }, { befehl: "marker_play", werte: { marker: "4" } });
  assert.deepEqual(r.map(zeigeNachricht), ["/marker/4", "/play"]);
  assert.throws(() => baueNachrichten(ma3, { befehl: "gibtsnicht" }));
  const ql = { typ: "qlab", optionen: { passcode: "1234" } };
  assert.deepEqual(baueNachrichten(ql, { befehl: "go" }).map(zeigeNachricht), ['/connect "1234"', "/go"], "QLab-Passcode vorab");
  assert.deepEqual(baueNachrichten({ typ: "qlab" }, { befehl: "go" }).map(zeigeNachricht), ["/go"]);
});

test("Eigene Nachricht: freie Adresse und Argumente mit Typen", () => {
  const n = baueNachrichten({ typ: "osc" }, { befehl: "eigene", werte: { adresse: "/show/{event}", argumente: 's:{spieler} i:{runde} 0.5 "zwei Worte" T' } }, { type: "kill", player: "Nova", round: 4 });
  assert.equal(n[0].address, "/show/kill");
  assert.deepEqual(n[0].args, [{ type: "s", value: "Nova" }, { type: "i", value: 4 }, { type: "f", value: 0.5 }, { type: "s", value: "zwei Worte" }, { type: "T", value: true }]);
  assert.deepEqual(parseArgs("7 abc -2 1,5"), [{ type: "i", value: 7 }, { type: "s", value: "abc" }, { type: "i", value: -2 }, { type: "f", value: 1.5 }]);
});

test("Filter: PC und Team, fehlendes Ziel wird gemeldet", () => {
  const cfg = { targets: [ma3], signale: { cs2: { kill: [
    { id: "1", ziel: "m", befehl: "go", werte: { seq: "1" }, pc: "PC 03", team: "" },
    { id: "2", ziel: "m", befehl: "go", werte: { seq: "2" }, pc: "", team: "T" },
    { id: "3", ziel: "weg", befehl: "go", werte: {}, pc: "", team: "" },
  ] } } };
  const b = befehleFuer(cfg, { spiel: "cs2", type: "kill", pcId: "PC 03", team: "CT" });
  assert.deepEqual(b.map((x) => x.zuweisung.id), ["1", "3"]);
  assert.equal(b[1].fehler, "Ziel fehlt");
  assert.equal(befehleFuer(cfg, { spiel: "cs2", type: "round_end" }).length, 0);
});

test("Jeder Datenbank-Befehl ergibt gültige OSC-Nachrichten", () => {
  for (const t of ZIEL_TYPEN) {
    for (const b of befehleVon(t.id)) {
      const ns = baueNachrichten({ typ: t.id }, { befehl: b.id, werte: {} }, { type: "goal", team: "BLUE", player: "Momo", pcId: "PC 1", round: 1 });
      assert.ok(ns.length > 0, `${t.id}/${b.id}`);
      for (const n of ns) assert.doesNotThrow(() => encodeMessage(n.address, n.args), `${t.id}/${b.id}`);
    }
    assert.doesNotThrow(() => { const n = testNachricht({ typ: t.id }); encodeMessage(n.address, n.args); });
    assert.ok(t.port > 0 && t.einrichten && t.doku, t.id);
  }
});

test("OSC-Kodierung nach Spezifikation", () => {
  const b = encodeMessage("/lan/cs2", [{ type: "s", value: "Go+" }]);
  assert.equal(b.toString("hex"), Buffer.from("/lan/cs2\0\0\0\0,s\0\0Go+\0", "latin1").toString("hex"));
  const i = encodeMessage("/x", [{ type: "i", value: 7 }, { type: "f", value: 0.5 }]);
  assert.equal(i.length, 4 + 4 + 8);
  assert.equal(i.readInt32BE(8), 7);
  assert.equal(i.readFloatBE(12), 0.5);
  assert.throws(() => encodeMessage("ohne-slash"));
});

test("Einstellungen: nach Neustart nie scharf, Modus bleibt", () => {
  const k = standardKonfig();
  assert.equal(k.modus, null);
  k.modus = "gamepc";
  k.regie.armed = true;
  const m = migrateKonfig(k);
  assert.equal(m.regie.armed, false);
  assert.equal(m.modus, "gamepc");
  assert.equal(m.gamepc.gsiToken, k.gamepc.gsiToken);
  assert.equal(migrateKonfig({ version: 1, armed: true }).modus, null);
  assert.equal("spiel" in m.gamepc, false);
});

test("Einstellungen vor Version 5: Ziele werden allgemeine OSC-Geräte, alte An/Aus-Signale entfallen", () => {
  const alt = { version: 4, regie: { targets: [{ id: "a", name: "MA", host: "10.0.0.5", port: 8000 }], signale: { cs2: { kill: false } } } };
  const m = migrateKonfig(alt);
  assert.equal(m.version, 5);
  assert.deepEqual(m.regie.targets, [{ id: "a", typ: "osc", name: "MA", host: "10.0.0.5", port: 8000, optionen: {} }]);
  assert.deepEqual(m.regie.signale, {});
  const neu = migrateKonfig({ ...m, regie: { ...m.regie, signale: { rl: { goal: [{ id: "x", ziel: "a", befehl: "eigene", werte: { adresse: "/x" } }] } } } });
  assert.equal(neu.regie.signale.rl.goal[0].werte.adresse, "/x");
});

test("GSI-cfg zeigt auf die App auf demselben PC", () => {
  const s = gsiCfg({ port: 3000, token: "abc" });
  assert.match(s, /"uri"\t\t"http:\/\/127\.0\.0\.1:3000\/gsi"/);
  assert.match(s, /"token"\t"abc"/);
});
