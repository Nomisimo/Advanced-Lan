const test = require("node:test");
const assert = require("node:assert/strict");
const { statsDaten, statsEvents } = require("../src/core/stats-screen");
const { Statistik } = require("../src/core/statistik");
const { SPIEL_BY_ID } = require("../src/core/spiele");
const { migrateKonfig, standardKonfig } = require("../src/core/defaults");
const { standardLayout, migrateLayout, textEinsetzen, einrasten, ANZEIGEN, B, H } = require("../src/core/stats-layout");
const { statsBeispiel } = require("../src/core/stats-beispiel");

test("Stats-Screen ohne Daten: leer, mit Teams für CS2", () => {
  const d = statsDaten(SPIEL_BY_ID.cs2, null, null);
  assert.equal(d.leer, true);
  assert.deepEqual(d.teams.map((t) => t.name), ["CT", "T"]);
  assert.equal(statsDaten(undefined, null, null).leer, true);
});

test("Stats-Screen CS2: Spielstand aus dem Stand, Bestenliste aus der Statistik", () => {
  const s = new Statistik();
  s.add({ spiel: "cs2", type: "round_live", round: 3 });
  s.add({ spiel: "cs2", type: "kill", player: "Momo", team: "CT", kills: 2, round: 3 });
  s.add({ spiel: "cs2", type: "headshot", player: "Momo", team: "CT" });
  const d = statsDaten(SPIEL_BY_ID.cs2, s.json(), { spiel: "cs2", ct: 7, tt: 5, map: "de_mirage", rundenPhase: "live" });
  assert.equal(d.leer, false);
  assert.deepEqual(d.teams.map((t) => [t.name, t.score]), [["CT", 7], ["T", 5]]);
  assert.equal(d.mitte.gross, "Runde 3");
  assert.equal(d.mitte.klein, "Runde läuft");
  assert.ok(d.chips.includes("de_mirage"));
  assert.equal(d.top[0].name, "Momo");
  assert.equal(d.top[0].kills, 2);
  assert.deepEqual(d.zahlen.find(([l]) => l === "HS-Quote"), ["HS-Quote", "50%"]);
});

test("Stats-Screen Rocket League: Tore, Spielzeit, Verlängerung", () => {
  const d = statsDaten(SPIEL_BY_ID.rl, null, { spiel: "rl", blau: 2, orange: 3, zeit: 65, overtime: true, arena: "DFH Stadium" });
  assert.deepEqual(d.teams.map((t) => t.score), [2, 3]);
  assert.equal(d.mitte.gross, "+1:05");
  assert.equal(d.mitte.klein, "Verlängerung");
});

test("Stats-Screen Dota 2 und Valorant", () => {
  const dota = statsDaten(SPIEL_BY_ID.dota2, null, { spiel: "dota2", score: { RADIANT: 12, DIRE: 9 }, zeit: 754, phase: "GAME_IN_PROGRESS", tag: false });
  assert.deepEqual(dota.teams.map((t) => t.score), [12, 9]);
  assert.equal(dota.mitte.gross, "12:34");
  assert.ok(dota.chips.includes("Nacht"));
  assert.ok(dota.spalten.some(([k]) => k === "assists"));
  const s = new Statistik();
  s.add({ spiel: "valorant", type: "round_start", round: 1 });
  s.add({ spiel: "valorant", type: "kill", player: "Kira", steamid: "k", team: "TEAM A" });
  s.add({ spiel: "valorant", type: "ace", player: "Kira", steamid: "k", team: "TEAM A" });
  s.add({ spiel: "valorant", type: "spike_planted" });
  const val = statsDaten(SPIEL_BY_ID.valorant, s.json(), { spiel: "valorant", runde: 1, score: {}, laeuft: true });
  assert.deepEqual(val.teams.map((t) => t.name), ["TEAM A", "TEAM B"]);
  assert.equal(val.mitte.gross, "Runde 1");
  assert.ok(val.chips.includes("Spike gelegt"));
  assert.deepEqual(val.zahlen.filter(([k]) => k === "Aces" || k === "Spikes"), [["Aces", 1], ["Spikes", 1]]);
  s.add({ spiel: "valorant", type: "round_end", team: "TEAM A" });
  assert.deepEqual(statsDaten(SPIEL_BY_ID.valorant, s.json(), null).teams.map((t) => t.score), [1, 0]);
});

test("Stats-Screen: Statistik eines anderen Spiels zählt nicht", () => {
  const s = new Statistik();
  s.add({ spiel: "rl", type: "goal", player: "X", team: "BLUE" });
  const d = statsDaten(SPIEL_BY_ID.cs2, s.json(), null);
  assert.equal(d.leer, true);
  assert.equal(d.top.length, 0);
});

test("Stats-Screen: letzte Events nur echte des aktiven Spiels", () => {
  const log = [
    { id: 4, ev: { spiel: "cs2", type: "kill" } },
    { id: 3, ev: { spiel: "rl", type: "goal" } },
    { id: 2, ev: { spiel: "cs2", type: "kill" }, verworfen: "doppelt" },
    { id: 1, ev: { spiel: "cs2", type: "ace" } },
  ];
  assert.deepEqual(statsEvents(log, "cs2").map((e) => e.id), [4, 1]);
  assert.equal(statsEvents(log, "cs2", 1).length, 1);
});

test("Einstellungen: Standalone-Modus und Stats-Screen", () => {
  const k = standardKonfig();
  assert.deepEqual(k.regie.stats, { an: false, ndi: false, ndiName: "Advanced LAN Stats", layout: standardLayout() });
  k.modus = "standalone";
  k.regie.stats = { an: true, ndi: true, ndiName: "  Bühne  ", fremd: 1 };
  const m = migrateKonfig(JSON.parse(JSON.stringify(k)));
  assert.equal(m.modus, "standalone");
  assert.deepEqual(m.regie.stats, { an: true, ndi: true, ndiName: "Bühne", layout: standardLayout() });
  assert.equal(migrateKonfig({ ...k, modus: "quatsch" }).modus, null);
  assert.equal(migrateKonfig({ ...k, regie: { ...k.regie, stats: { an: 1, ndiName: "" } } }).regie.stats.ndiName, "Advanced LAN Stats");
});

test("Screen-Layout: Standard hat jede Anzeige einmal, sichtbar", () => {
  const l = standardLayout();
  assert.deepEqual(l.elemente.map((e) => e.typ), ANZEIGEN.map((a) => a.typ));
  assert.ok(l.elemente.every((e) => e.sichtbar && e.x + e.b <= B && e.y + e.h <= H));
  assert.deepEqual(migrateLayout(l), l);
  assert.deepEqual(migrateLayout(null), l);
});

test("Screen-Layout: gespeichertes Layout wird geprüft", () => {
  const l = migrateLayout({ hintergrund: "lila", elemente: [
    { typ: "events", x: 1800, y: -50, b: 500, h: 20, titel: "Feed" },
    { typ: "events", x: 0, y: 0, b: 100, h: 100 },
    { typ: "quatsch" }, null,
    { typ: "text", id: "t1", x: 10, y: 10, b: 300, h: 80, text: "Hallo {spiel}", groesse: 9999, farbe: "rot", ausrichtung: "oben" },
    { typ: "text", id: "t1", text: "doppelte ID" },
  ] });
  assert.equal(l.hintergrund, "verlauf");
  const ev = l.elemente.find((e) => e.typ === "events");
  assert.deepEqual([ev.x, ev.y, ev.b, ev.h, ev.titel], [B - 500, 0, 500, 40, "Feed"]);
  assert.equal(l.elemente.filter((e) => e.typ === "events").length, 1);
  const t = l.elemente.filter((e) => e.typ === "text");
  assert.equal(t.length, 2);
  assert.notEqual(t[0].id, t[1].id);
  assert.deepEqual([t[0].groesse, t[0].farbe, t[0].ausrichtung], [400, "#ffffff", "mitte"]);
  // Fehlende Anzeigen kommen ausgeblendet dazu
  assert.equal(l.elemente.find((e) => e.typ === "spielstand").sichtbar, false);
});

test("Screen-Layout: Platzhalter in Texten", () => {
  assert.equal(textEinsetzen("{team1} {score1}:{score2} {team2}", { team1: "CT", team2: "T", score1: 9, score2: 0 }), "CT 9:0 T");
  assert.equal(textEinsetzen("Live: {session}", {}), "Live: ");
  assert.equal(textEinsetzen("{tippfehler}", {}), "{tippfehler}");
});

test("Screen-Layout: Einrasten an Raster, Kanten und Mitte", () => {
  // Raster
  assert.deepEqual((({ x, y }) => [x, y])(einrasten({ x: 103, y: 47, b: 200, h: 100 }, [], { raster: 20, abstand: 0 })), [100, 40]);
  // Mitte der Fläche: Element 200 breit, Mitte bei 955 → rastet auf 960
  const m = einrasten({ x: 855, y: 300, b: 200, h: 100 }, [], { abstand: 8 });
  assert.equal(m.x, 860);
  assert.ok(m.linien.some((l) => l.achse === "x" && l.pos === B / 2));
  // Kante eines anderen Elements
  const k = einrasten({ x: 505, y: 600, b: 100, h: 100 }, [{ x: 0, y: 0, b: 500, h: 300 }], { abstand: 8 });
  assert.equal(k.x, 500);
  // Größe ändern: rechte Kante rastet, links bleibt
  const r = einrasten({ x: 100, y: 100, b: 396, h: 100 }, [{ x: 0, y: 0, b: 500, h: 50 }], { abstand: 8, kanten: ["r"] });
  assert.deepEqual([r.x, r.b], [100, 400]);
  // Bleibt in der Fläche
  const a = einrasten({ x: 1900, y: 1070, b: 200, h: 100 }, [], { abstand: 0 });
  assert.deepEqual([a.x, a.y], [B - 200, H - 100]);
});

test("Screen-Editor: Beispieldaten füllen den Screen für jedes Spiel", () => {
  for (const sp of Object.values(SPIEL_BY_ID)) {
    const { regie, log } = statsBeispiel(sp, 1000);
    const d = statsDaten(sp, regie.statistik, regie.stand);
    assert.equal(d.leer, false, sp.id);
    assert.ok(d.top.length > 0, sp.id);
    assert.ok(statsEvents(log, sp.id).length > 0, sp.id);
  }
});
