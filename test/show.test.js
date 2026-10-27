const test = require("node:test");
const assert = require("node:assert/strict");
const { migrateKonfig } = require("../src/core/defaults");
const { showDatei, leseShow, showAnwenden, leereShow, alsGespeichert, showInfo, ungesichert, dateiName, arten } = require("../src/core/show");

const kopie = (x) => JSON.parse(JSON.stringify(x));
function regieKonfig() {
  const c = migrateKonfig(null);
  c.modus = "standalone";
  c.regie.targets = [{ id: "z1", typ: "ma3", name: "MA3", host: "10.0.0.5", port: 8000, optionen: {}, netz: "" }];
  c.regie.signale = { cs2: { round_end: [{ id: "s1", ziel: "z1", befehl: "go", werte: {}, pc: "", team: "" }] } };
  c.regie.session = { name: "LAN Herbst", passwort: "geheim", port: 47801, offen: true };
  c.regie.armed = true;
  c.gamepc.pcId = "PC 07";
  c.gamepc.passwort = "geheim";
  c.gamepc.overlay = { an: false, x: 100, y: 200 };
  return c;
}

test("Regie-Show: Datei schreiben und wieder lesen, ohne Ausgabe und Session-Zustand", () => {
  const c = regieKonfig();
  const d = showDatei(c, "regie", "  LAN Herbst  ", { appVersion: "0.1.0-beta.9", jetzt: new Date("2026-10-27T12:00:00Z") });
  assert.equal(d.format, "advanced-lan-show");
  assert.equal(d.name, "LAN Herbst");
  assert.equal(d.daten.armed, undefined);
  assert.equal(d.daten.session.offen, undefined);
  assert.equal(d.daten.session.passwort, "geheim");
  const l = leseShow(JSON.stringify(d), ["regie"]);
  assert.equal(l.art, "regie");
  assert.deepEqual(l.daten.targets, c.regie.targets);
});

test("Show laden: Ausgabe aus, offene Session bleibt offen, Show ist unverändert", () => {
  const quelle = regieKonfig();
  const datei = showDatei(quelle, "regie", "Bühne");
  const ziel = migrateKonfig(null);
  ziel.modus = "regie";
  ziel.regie.session.offen = true;
  ziel.regie.armed = true;
  const neu = showAnwenden(ziel, "regie", leseShow(JSON.stringify(datei)).daten, "Bühne");
  assert.equal(neu.modus, "regie");
  assert.equal(neu.regie.armed, false);
  assert.equal(neu.regie.session.offen, true);
  assert.deepEqual(neu.regie.signale, quelle.regie.signale);
  assert.deepEqual(showInfo(neu, "regie"), { art: "regie", name: "Bühne", geaendert: false });
  // Hin und zurück durch die Einstellungen (wie beim Speichern aus der Oberfläche) bleibt sie unverändert
  assert.equal(showInfo(migrateKonfig(kopie(neu)), "regie").geaendert, false);
  neu.regie.targets[0].port = 9000;
  assert.equal(showInfo(neu, "regie").geaendert, true);
  assert.equal(showInfo(alsGespeichert(neu, "regie", "Bühne"), "regie").geaendert, false);
});

test("Game-PC-Show: PC-ID, Token und Overlay-Position bleiben von diesem PC", () => {
  const quelle = regieKonfig();
  const daten = showDatei(quelle, "gamepc", "Game-PCs").daten;
  assert.equal(daten.pcId, undefined);
  assert.equal(daten.gsiToken, undefined);
  assert.equal(daten.overlay.x, undefined);
  const hier = migrateKonfig(null);
  hier.modus = "gamepc";
  hier.gamepc.pcId = "PC 02";
  hier.gamepc.overlay = { an: true, x: 5, y: 6 };
  const neu = showAnwenden(hier, "gamepc", daten, "Game-PCs");
  assert.equal(neu.gamepc.pcId, "PC 02");
  assert.equal(neu.gamepc.gsiToken, hier.gamepc.gsiToken);
  assert.deepEqual(neu.gamepc.overlay, { an: false, x: 5, y: 6 });
  assert.equal(neu.gamepc.passwort, "geheim");
  assert.equal(neu.regie.session.passwort, hier.regie.session.passwort, "Regie-Teil bleibt");
});

test("Leere Show setzt nur den eigenen Teil zurück", () => {
  const c = regieKonfig();
  const neu = leereShow(c, "regie");
  assert.deepEqual(neu.regie.targets, []);
  assert.equal(neu.regie.session.offen, true);
  assert.equal(neu.gamepc.pcId, "PC 07");
  assert.equal(neu.shows.regie.name, "");
  assert.equal(ungesichert(neu, "regie"), false);
  assert.equal(ungesichert(c, "regie"), true);
  const g = leereShow(c, "gamepc");
  assert.equal(g.gamepc.passwort, "");
  assert.equal(g.gamepc.pcId, "PC 07");
  assert.equal(g.regie.targets.length, 1);
});

test("Falsche Dateien und falscher Modus werden abgelehnt", () => {
  const c = regieKonfig();
  assert.ok(leseShow("kein json").fehler);
  assert.ok(leseShow(JSON.stringify({ format: "advanced-lan", version: 5 })).fehler);
  assert.ok(leseShow(JSON.stringify({ ...showDatei(c, "regie", "x"), version: 99 })).fehler.includes("neueren"));
  assert.match(leseShow(JSON.stringify(showDatei(c, "regie", "x")), ["gamepc"]).fehler, /Regie-Show/);
  assert.deepEqual(arten("regie"), ["regie"]);
  assert.deepEqual(arten("gamepc"), ["gamepc"]);
  assert.deepEqual(arten("standalone"), ["regie", "gamepc"]);
});

test("Dateinamen ohne verbotene Zeichen", () => {
  assert.equal(dateiName("LAN: Herbst/2026?", "regie"), "LAN- Herbst-2026-.alshow");
  assert.equal(dateiName("", "gamepc"), "Game-PC.alshow");
});
