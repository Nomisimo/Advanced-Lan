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

const { verlaufCss, farbeBei, inhaltsSkala, neuesBild, bilderAufraeumen, MAX_BILDER } = require("../src/core/stats-layout");
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("Screen-Layout: eigener Hintergrund und Verlauf werden geprüft", () => {
  const l = migrateLayout({ hintergrund: "eigen", hg: { farbe: "lila", verlauf: { art: "quatsch", winkel: 999, stopps: [{ farbe: "#FF0000", pos: 80, alpha: 50 }, { farbe: "#0000ff", pos: -5 }, null] } }, elemente: [] });
  assert.equal(l.hintergrund, "eigen");
  assert.equal(l.hg.farbe, "#1b1922");
  assert.deepEqual(l.hg.verlauf.stopps, [{ farbe: "#0000ff", pos: 0, alpha: 100 }, { farbe: "#ff0000", pos: 80, alpha: 50 }]);
  assert.equal(l.hg.verlauf.art, "linear");
  assert.equal(l.hg.verlauf.winkel, 360);
  // Ein Stopp reicht nicht: Standardverlauf
  assert.equal(migrateLayout({ hg: { verlauf: { stopps: [{ farbe: "#000000", pos: 0 }] } }, elemente: [] }).hg.verlauf.stopps.length, 3);
  // Bild-Hintergrund ohne gültiges Bild fällt auf den Standard zurück
  assert.equal(migrateLayout({ hintergrund: "bild", hg: { bild: "b1" }, bilder: { b1: "data:image/svg+xml;base64,PHN2Zz4=" }, elemente: [] }).hintergrund, "verlauf");
  const mitBild = migrateLayout({ hintergrund: "bild", hg: { bild: "b1", abdunkeln: 40 }, bilder: { b1: PNG, b2: PNG }, elemente: [] });
  assert.equal(mitBild.hintergrund, "bild");
  assert.deepEqual(Object.keys(mitBild.bilder), ["b1"], "ungenutzte Bilder fliegen raus");
});

test("Verlauf: CSS und Farbe zwischen zwei Stopps", () => {
  const v = { art: "linear", winkel: 90, stopps: [{ farbe: "#000000", pos: 0, alpha: 100 }, { farbe: "#ffffff", pos: 100, alpha: 0 }] };
  assert.equal(verlaufCss(v), "linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(255,255,255,0) 100%)");
  assert.equal(verlaufCss({ ...v, art: "radial", x: 20, y: 30 }), "radial-gradient(ellipse farthest-corner at 20% 30%, rgba(0,0,0,1) 0%, rgba(255,255,255,0) 100%)");
  assert.ok(verlaufCss({ ...v, art: "konisch" }).startsWith("conic-gradient(from 90deg at 50% 50%"));
  assert.deepEqual(farbeBei(v, 50), { farbe: "#808080", alpha: 50 });
  assert.deepEqual(farbeBei(v, 0), { farbe: "#000000", alpha: 100 });
});

test("Bild-Blöcke: geprüft, begrenzt, Bilder ohne Block fliegen raus", () => {
  const b = neuesBild("b1", { b0: 1000, h0: 1000 });
  assert.deepEqual([b.b, b.h], [480, 480]);
  assert.deepEqual([neuesBild("b1", { b0: 1920, h0: 1080 }).b, neuesBild("b1", { b0: 1920, h0: 1080 }).h], [640, 360]);
  const l = migrateLayout({ bilder: { b1: PNG, kaputt: "data:text/html;base64,PGI+" }, elemente: [
    { ...b, deckkraft: 500, radius: -3, passung: "irgendwie" },
    { ...neuesBild("kaputt"), id: "x2" },
    { ...neuesBild("fehlt"), id: "x3" },
  ] });
  const bl = l.elemente.filter((e) => e.typ === "bild");
  assert.equal(bl.length, 1);
  assert.deepEqual([bl[0].deckkraft, bl[0].radius, bl[0].passung], [100, 0, "einpassen"]);
  assert.deepEqual(Object.keys(l.bilder), ["b1"]);
  const viele = migrateLayout({ bilder: { b1: PNG }, elemente: Array.from({ length: MAX_BILDER + 3 }, () => neuesBild("b1")) });
  assert.equal(viele.elemente.filter((e) => e.typ === "bild").length, MAX_BILDER);
  // Aufräumen nach dem Löschen
  const ohne = bilderAufraeumen({ ...l, elemente: l.elemente.filter((e) => e.typ !== "bild") });
  assert.deepEqual(ohne.bilder, {});
  assert.equal(bilderAufraeumen(l), l, "nichts zu tun: gleiches Objekt");
});

test("Blöcke skalieren: Inhalt wächst mit der Blockgröße, Zoom obendrauf", () => {
  const sp = standardLayout().elemente.find((e) => e.typ === "spielstand"); // 1832 × 330
  assert.deepEqual(inhaltsSkala(sp), { f: 1, b: 1832, h: 330 });
  const halb = inhaltsSkala({ ...sp, b: 916, h: 165 });
  assert.equal(halb.f, 0.5);
  assert.deepEqual([halb.b, halb.h], [1832, 330]);
  // Nur schmaler: kleinere Seite zählt, der Inhalt bekommt mehr Höhe
  const schmal = inhaltsSkala({ ...sp, b: 916 });
  assert.equal(schmal.f, 0.5);
  assert.deepEqual([schmal.b, schmal.h], [1832, 660]);
  assert.equal(inhaltsSkala({ ...sp, zoom: 150 }).f, 1.5);
  assert.equal(inhaltsSkala({ ...sp, b: 916, skalieren: false }).f, 1);
  // Texte und Bilder skalieren selbst
  assert.equal(inhaltsSkala({ typ: "text", b: 10, h: 10 }).f, 1);
  // Altes Layout ohne die neuen Felder: skaliert, Zoom 100
  const alt = migrateLayout({ elemente: [{ typ: "events", x: 0, y: 0, b: 380, h: 205 }] }).elemente.find((e) => e.typ === "events");
  assert.deepEqual([alt.skalieren, alt.zoom, inhaltsSkala(alt).f], [true, 100, 0.5]);
});
