const test = require("node:test");
const assert = require("node:assert/strict");
const { Router, fuellen } = require("../src/core/router");
const { encodeMessage } = require("../src/core/osc");
const { standardKonfig, migrateKonfig } = require("../src/core/defaults");
const { gsiCfg } = require("../src/core/cfg");

const cfg = () => ({
  targets: [{ id: "ma3", name: "grandMA3", host: "10.0.0.5", port: 8000 }],
  rules: [
    { id: "a", aktiv: true, event: "round_end", team: "CT", target: "ma3", address: "/gma3/cmd", argTyp: "s", argWert: "Go+ Sequence 101" },
    { id: "b", aktiv: true, event: "round_end", team: "", target: "ma3", address: "/lan/{event}", argTyp: "i", argWert: "{score_ct}", cooldown: 5000 },
    { id: "c", aktiv: false, event: "round_end", target: "ma3", address: "/aus" },
  ],
});

test("Regeln filtern nach Team, aktiv und Cooldown", () => {
  const r = new Router();
  const s = r.route(cfg(), { type: "round_end", team: "CT", score_ct: 4 }, 0);
  assert.deepEqual(s.map((x) => x.address), ["/gma3/cmd", "/lan/round_end"]);
  assert.deepEqual(s[1].args, [{ type: "i", value: 4 }]);
  const t = r.route(cfg(), { type: "round_end", team: "T" }, 1000);
  assert.equal(t.length, 1);
  assert.equal(t[0].uebersprungen, "Cooldown");
});

test("Platzhalter", () => {
  assert.equal(fuellen("{player} ({team}) {unbekannt}", { player: "Nova", team: "T" }), "Nova (T) {unbekannt}");
});

test("OSC-Kodierung nach Spezifikation", () => {
  const b = encodeMessage("/gma3/cmd", [{ type: "s", value: "Go+" }]);
  assert.equal(b.toString("hex"), Buffer.from("/gma3/cmd\0\0\0,s\0\0Go+\0", "latin1").toString("hex"));
  const i = encodeMessage("/x", [{ type: "i", value: 7 }, { type: "f", value: 0.5 }]);
  assert.equal(i.length, 4 + 4 + 8);
  assert.equal(i.readInt32BE(8), 7);
  assert.equal(i.readFloatBE(12), 0.5);
  assert.throws(() => encodeMessage("ohne-slash"));
});

test("Regeln gelten nur für ihr Spiel", () => {
  const r = new Router();
  const c = cfg();
  c.rules[0].spiel = "valorant";
  assert.deepEqual(r.route(c, { type: "round_end", team: "CT", spiel: "cs2" }, 0).map((x) => x.address), ["/lan/round_end"]);
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
});

test("GSI-cfg zeigt auf die App auf demselben PC", () => {
  const s = gsiCfg({ port: 3000, token: "abc" });
  assert.match(s, /"uri"\t\t"http:\/\/127\.0\.0\.1:3000\/gsi"/);
  assert.match(s, /"token"\t"abc"/);
});
