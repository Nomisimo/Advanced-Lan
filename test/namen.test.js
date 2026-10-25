const test = require("node:test");
const assert = require("node:assert/strict");
const { NamensWaechter, migrateNamensAbfrage, SPIELSTART_PAUSE, ABSTAND } = require("../src/core/namen");
const { leseSpieler } = require("../src/core/protokoll");
const { Regie } = require("../src/core/regie");
const { statsEvents } = require("../src/core/stats-screen");
const { standardRegie, migrateKonfig } = require("../src/core/defaults");

const AN = { spielstart: true, leerlaufMin: 15 };

test("Spielstart fragt beim ersten Spieldatum und nach einer Pause, höchstens alle 15 Minuten", () => {
  let t = 1_000_000;
  const w = new NamensWaechter({ now: () => t });
  assert.equal(w.spielDaten(AN), "spielstart");
  w.gefragt();
  t += 1000;
  assert.equal(w.spielDaten(AN), "", "laufendes Spiel fragt nicht nochmal");
  t += SPIELSTART_PAUSE + 1;
  assert.equal(w.spielDaten(AN), "", "neues Spiel, aber eben erst gefragt");
  t += ABSTAND;
  assert.equal(w.spielDaten(AN), "spielstart");
  assert.equal(new NamensWaechter({ now: () => t }).spielDaten({ ...AN, spielstart: false }), "");
});

test("Leerlauf: weg nach der eingestellten Zeit, zurück bei der nächsten Eingabe", () => {
  let t = 5_000_000;
  const w = new NamensWaechter({ now: () => t });
  assert.equal(w.leerlauf(10 * 60, AN), "");
  assert.equal(w.leerlauf(15 * 60, AN), "weg");
  assert.equal(w.leerlauf(20 * 60, AN), "", "nur einmal weg");
  assert.equal(w.leerlauf(2, AN), "zurueck");
  assert.equal(w.leerlauf(2, AN), "");
  assert.equal(w.leerlauf(99 * 60, { ...AN, leerlaufMin: 0 }), "", "aus");
});

test("Leerlauf: ein laufendes Spiel gilt als belegt (Gamepads zählen nicht als Eingabe)", () => {
  let t = 5_000_000;
  const w = new NamensWaechter({ now: () => t });
  w.spielDaten(AN);
  assert.equal(w.leerlauf(30 * 60, AN), "");
  t += 2 * 60_000;
  assert.equal(w.leerlauf(30 * 60, AN), "weg");
});

test("Spielername wird gekürzt und bereinigt, Einstellungen mit Standard", () => {
  assert.equal(leseSpieler("  Momo   der  Große "), "Momo der Große");
  assert.equal(leseSpieler("x".repeat(50)).length, 32);
  assert.equal(leseSpieler(42), "");
  assert.deepEqual(migrateNamensAbfrage(null), { spielstart: true, leerlaufMin: 15 });
  assert.deepEqual(migrateNamensAbfrage({ spielstart: false, leerlaufMin: 999 }), { spielstart: false, leerlaufMin: 240 });
  const g = migrateKonfig({ version: 5, gamepc: { spieler: " Lena ", pcId: "PC 3" } }).gamepc;
  assert.equal(g.spieler, "Lena");
  assert.deepEqual(g.namensAbfrage, { spielstart: true, leerlaufMin: 15 });
});

function regieMit(aktivesSpiel = "cs2") {
  const cfg = { ...standardRegie(), aktivesSpiel };
  let t = 0;
  return new Regie({ getConfig: () => cfg, send: () => {}, now: () => (t += 100) });
}

test("Stats-Screen: Spielername statt Name im Spiel, ohne Namen die PC-ID", () => {
  const r = regieMit();
  r.pcVerbunden("PC 1", { spiele: ["cs2"], spieler: "Momo" });
  r.pcVerbunden("PC 2", { spiele: ["cs2"] });
  r.pcStatus("PC 1", { spiel: "cs2", status: { spieler: "xX_Sniper_Xx" } });
  r.pcStatus("PC 2", { spiel: "cs2", status: { spieler: "Steamname2" } });
  r.pcEvent("PC 1", "cs2", { type: "kill", player: "xX_Sniper_Xx", team: "CT", kills: 1, round: 1 });
  r.pcEvent("PC 2", "cs2", { type: "kill", player: "Steamname2", team: "T", kills: 1, round: 1 });
  r.pcEvent("PC 2", "cs2", { type: "mvp", player: "Steamname2", team: "T", round: 1 });
  const s = r.snapshot();
  assert.deepEqual(s.statistik.top.map((p) => p.name).sort(), ["Momo", "PC 2"]);
  assert.equal(s.statistik.runde.mvp, "PC 2");
  assert.deepEqual(statsEvents(r.alleLogs(), "cs2", 8, s.namen).map((e) => e.ev.player), ["PC 2", "PC 2", "Momo"]);
  assert.equal(r.alleLogs().at(-1).ev.player, "xX_Sniper_Xx", "Log und OSC behalten den Namen aus dem Spiel");
});

test("Neuer Spielername gilt auch für das, was vorher gezählt wurde", () => {
  const r = regieMit();
  r.pcVerbunden("PC 1", { spiele: ["cs2"] });
  r.pcStatus("PC 1", { spiel: "cs2", status: { spieler: "abc" } });
  r.pcEvent("PC 1", "cs2", { type: "kill", player: "abc", team: "CT", kills: 1, round: 1 });
  assert.equal(r.snapshot().statistik.top[0].name, "PC 1");
  r.pcSpieler("PC 1", "  Lena ");
  const top = r.snapshot().statistik.top;
  assert.equal(top.length, 1);
  assert.deepEqual([top[0].name, top[0].kills], ["Lena", 1]);
});

test("Rocket League: Mitspieler, die kein PC als sich selbst meldet, behalten den Namen aus dem Spiel", () => {
  const r = regieMit("rl");
  r.pcVerbunden("PC 1", { spiele: ["rl"], spieler: "Momo" });
  r.pcStatus("PC 1", { spiel: "rl", status: { spieler: "", team: "" } });
  r.pcEvent("PC 1", "rl", { type: "goal", player: "Gegner", team: "ORANGE", round: 0 });
  const s = r.snapshot();
  assert.equal(s.statistik.top[0].name, "Gegner");
  assert.equal(s.statistik.match.letztesTor.spieler, "Gegner");
});
