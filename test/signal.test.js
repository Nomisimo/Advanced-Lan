const test = require("node:test");
const assert = require("node:assert/strict");
const { oscAdresse, oscArgs, freigegeben, slug } = require("../src/core/signal");
const { encodeMessage } = require("../src/core/osc");
const { standardKonfig, migrateKonfig } = require("../src/core/defaults");
const { gsiCfg } = require("../src/core/cfg");

test("Neutrale Adressen: Spiel und Ereignis, bei Spieler-Ereignissen die PC-ID", () => {
  assert.equal(oscAdresse({ spiel: "cs2", type: "round_end", pcId: "PC 03" }, false), "/lan/cs2/round_end");
  assert.equal(oscAdresse({ spiel: "cs2", type: "kill", pcId: "PC 03" }, true), "/lan/cs2/pc03/kill");
  assert.equal(oscAdresse({ spiel: "cs2", type: "kill" }, true), "/lan/cs2/kill");
  assert.equal(slug("Tisch-Ä 1"), "tischa1");
  assert.equal(slug(""), "x");
});

test("Argumente: team, spieler, pc, runde", () => {
  assert.deepEqual(oscArgs({ team: "CT", player: "Nova", pcId: "PC 03", round: 4 }).map((a) => [a.type, a.value]), [["s", "CT"], ["s", "Nova"], ["s", "PC 03"], ["i", 4]]);
  assert.deepEqual(oscArgs({}).map((a) => a.value), ["", "", "", 0]);
  assert.equal(oscArgs({ team: "CT", pcId: "PC 03", round: 4 }, false)[2].value, "", "Runden-Ereignis ohne PC");
});

test("Signale sind freigegeben, bis sie gesperrt werden", () => {
  const cfg = { signale: { cs2: { kill: false } } };
  assert.equal(freigegeben(cfg, "cs2", "kill"), false);
  assert.equal(freigegeben(cfg, "cs2", "round_end"), true);
  assert.equal(freigegeben({}, "valorant", "kill"), true);
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

test("GSI-cfg zeigt auf die App auf demselben PC", () => {
  const s = gsiCfg({ port: 3000, token: "abc" });
  assert.match(s, /"uri"\t\t"http:\/\/127\.0\.0\.1:3000\/gsi"/);
  assert.match(s, /"token"\t"abc"/);
});
