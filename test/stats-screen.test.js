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
  assert.deepEqual(k.regie.stats, { an: false, aktiv: "haupt", screens: [{ id: "haupt", name: "Haupt-Screen", b: 1920, h: 1080, ndi: false, ndiName: "Advanced LAN Stats", layout: standardLayout() }] });
  k.modus = "standalone";
  // Alte Einstellungen mit genau einem Screen werden zum ersten Screen
  k.regie.stats = { an: true, ndi: true, ndiName: "  Bühne  ", fremd: 1 };
  const m = migrateKonfig(JSON.parse(JSON.stringify(k)));
  assert.equal(m.modus, "standalone");
  assert.deepEqual(m.regie.stats, { an: true, aktiv: "haupt", screens: [{ id: "haupt", name: "Haupt-Screen", b: 1920, h: 1080, ndi: true, ndiName: "Bühne", layout: standardLayout() }] });
  assert.equal(migrateKonfig({ ...k, modus: "quatsch" }).modus, null);
  assert.equal(migrateKonfig({ ...k, regie: { ...k.regie, stats: { an: 1, ndiName: "" } } }).regie.stats.screens[0].ndiName, "Advanced LAN Stats");
});

test("Mehrere Screens: eigene Größe, eindeutige IDs und NDI-Namen, höchstens 8", () => {
  const { migrateStats, neuerScreen, freierNdiName, MAX_SCREENS, GROESSE_MIN, GROESSE_MAX, screenVon, statsHash, leseStatsHash } = require("../src/core/stats-screens");
  const a = neuerScreen({ name: "Score", b: 800, h: 200, vorlage: "spielstand" });
  const s = migrateStats({ an: true, aktiv: "weg", screens: [
    { id: "haupt", name: "Haupt", ndi: true, ndiName: "Stage" },
    { ...a, ndi: true, ndiName: "stage" },
    { id: "haupt", name: "", b: 5, h: 99999, ndiName: "" },
    "quatsch",
  ] });
  assert.equal(s.screens.length, 3);
  assert.equal(s.aktiv, "haupt");
  assert.equal(new Set(s.screens.map((x) => x.id)).size, 3);
  assert.deepEqual(s.screens.map((x) => x.ndiName), ["Stage", "stage 2", "Advanced LAN Stats"]);
  assert.deepEqual([s.screens[2].b, s.screens[2].h], [GROESSE_MIN, GROESSE_MAX]);
  assert.equal(s.screens[2].name, "Screen 3");
  // Layout bleibt in der Fläche des Screens
  const k = s.screens[1];
  assert.deepEqual([k.b, k.h], [800, 200]);
  assert.ok(k.layout.elemente.every((e) => e.x >= 0 && e.y >= 0 && e.x + e.b <= 800 && e.y + e.h <= 200));
  const sicht = k.layout.elemente.filter((e) => e.sichtbar);
  assert.deepEqual(sicht.map((e) => [e.typ, e.x, e.y, e.b, e.h]), [["spielstand", 0, 0, 800, 200]]);
  assert.equal(k.layout.hintergrund, "transparent");
  assert.equal(migrateStats({ screens: Array.from({ length: 12 }, (_, i) => ({ id: `x${i}` })) }).screens.length, MAX_SCREENS);
  assert.equal(migrateStats({ screens: [] }).screens[0].id, "haupt");
  assert.equal(freierNdiName("A", ["a", "A 2"]), "A 3");
  assert.equal(screenVon(s, k.id), k);
  assert.equal(screenVon(s, "gibtsnicht"), s.screens[0]);
  assert.deepEqual(leseStatsHash("#" + statsHash(k.id, true)), { id: k.id, ndi: true });
  assert.deepEqual(leseStatsHash("#stats"), { id: "", ndi: false });
  assert.equal(leseStatsHash("#regie"), null);
});

test("Layout auf kleiner Fläche: Standard anteilig, Einrasten an der Fläche, neue Blöcke passen hinein", () => {
  const { neuerText, neuesBild } = require("../src/core/stats-layout");
  const F = { b: 960, h: 540 };
  const l = standardLayout(F);
  const sp = l.elemente.find((e) => e.typ === "spielstand");
  assert.deepEqual([sp.x, sp.y, sp.b, sp.h], [22, 69, 916, 165]);
  assert.ok(l.elemente.every((e) => e.x + e.b <= 960 && e.y + e.h <= 540));
  const r = einrasten({ x: 455, y: 0, b: 50, h: 50 }, [], { abstand: 8, flaeche: { b: 400, h: 100 } });
  assert.equal(r.x, 350); // rechte Kante an der Fläche (400), sonst nichts in der Nähe
  const t = neuerText({}, { b: 300, h: 60 });
  assert.deepEqual([t.x, t.y, t.b, t.h], [0, 0, 300, 60]);
  const i = neuesBild("b1", { b0: 4, h0: 1, flaeche: { b: 400, h: 100 } });
  assert.deepEqual([i.x, i.y, i.b, i.h], [0, 0, 400, 100]);
  // Gespeicherte Elemente außerhalb kommen in die Fläche
  const m = migrateLayout({ elemente: [{ typ: "text", id: "t1", x: 1500, y: 900, b: 600, h: 120 }] }, { b: 400, h: 100 });
  const tx = m.elemente.find((e) => e.id === "t1");
  assert.deepEqual([tx.x, tx.y, tx.b, tx.h], [0, 0, 400, 100]);
});

test("NDI mit Alpha: vormultiplizierte Pixel werden gerade", () => {
  const { alphaGerade } = require("../src/core/stats-screens");
  const b = Buffer.from([10, 20, 30, 255, 0, 0, 0, 0, 50, 64, 0, 128]);
  alphaGerade(b);
  assert.deepEqual([...b], [10, 20, 30, 255, 0, 0, 0, 0, 100, 128, 0, 128]);
});

test("Screen-Layout: Standard hat jede Anzeige einmal, sichtbar bis auf die optionalen", () => {
  const l = standardLayout();
  assert.deepEqual(l.elemente.map((e) => e.typ), ANZEIGEN.map((a) => a.typ));
  assert.ok(l.elemente.every((e) => e.sichtbar === !ANZEIGEN.find((a) => a.typ === e.typ).aus && e.x + e.b <= B && e.y + e.h <= H));
  assert.deepEqual(l.elemente.filter((e) => !e.sichtbar).map((e) => e.typ), ["teams", "mvp"]);
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

test("Darstellung und eigene Einstellungen für jedes Element", () => {
  const { STIL, neuerText } = require("../src/core/stats-layout");
  const std = standardLayout();
  assert.ok(std.elemente.every((e) => e.deckkraft === 100 && e.kachel === STIL.kachel && e.rahmen === true && e.schrift === ""));
  const l = migrateLayout({ bilder: { b1: PNG }, elemente: [
    { typ: "events", deckkraft: 40, kachel: -10, ecken: 500, rahmen: false, schrift: "#ABCDEF", akzent: "quatsch", anzahl: 99 },
    { typ: "bestenliste", zeilen: 3 },
    { typ: "logo", icon: false },
    { ...neuerText(), deckkraft: 30, kachel: 0 },
    { ...neuesBild("b1"), deckkraft: 55 },
  ] });
  const ev = l.elemente.find((e) => e.typ === "events");
  assert.deepEqual([ev.deckkraft, ev.kachel, ev.ecken, ev.rahmen, ev.schrift, ev.akzent, ev.anzahl], [40, 0, 80, false, "#abcdef", "", 20]);
  assert.equal(l.elemente.find((e) => e.typ === "bestenliste").zeilen, 3);
  assert.equal(l.elemente.find((e) => e.typ === "logo").icon, false);
  assert.deepEqual([l.elemente.find((e) => e.typ === "text").deckkraft, l.elemente.find((e) => e.typ === "text").kachel], [30, 0]);
  assert.equal(l.elemente.find((e) => e.typ === "bild").deckkraft, 55, "Deckkraft alter Bild-Blöcke bleibt");
  // Altes Layout ohne Darstellung: Standard
  const alt = migrateLayout({ elemente: [{ typ: "zahlen", x: 0, y: 0, b: 400, h: 100 }] }).elemente.find((e) => e.typ === "zahlen");
  assert.deepEqual([alt.deckkraft, alt.kachel, alt.ecken, alt.rahmen], [100, STIL.kachel, STIL.ecken, true]);
});

test("Texte je Zustand und Teile ein/aus für jede Anzeige", () => {
  const { OPTIONEN, OPTION_TEXT_MAX } = require("../src/core/stats-layout");
  const std = standardLayout();
  const live = std.elemente.find((e) => e.typ === "live");
  assert.deepEqual([live.textLive, live.textWartet, live.textAn, live.punkt], ["LIVE", "WARTET", true, true]);
  for (const [typ, o] of Object.entries(OPTIONEN)) for (const k of Object.keys(o)) assert.ok(k in std.elemente.find((e) => e.typ === typ), `${typ}.${k}`);
  const l = migrateLayout({ elemente: [
    { typ: "live", textLive: "ON AIR {kurz}", textWartet: "", textAn: false, punkt: false },
    { typ: "spielstand", textWarten: "x".repeat(200), teamnamen: false, textSieger: 5 },
    { typ: "events", zeit: false, textLeer: "" },
  ] });
  const lv = l.elemente.find((e) => e.typ === "live");
  assert.deepEqual([lv.textLive, lv.textWartet, lv.textAn, lv.punkt], ["ON AIR {kurz}", "", false, false]);
  const sp = l.elemente.find((e) => e.typ === "spielstand");
  assert.equal(sp.textWarten.length, OPTION_TEXT_MAX);
  assert.equal(sp.teamnamen, false);
  assert.equal(sp.textSieger, "Sieger", "kein Text: Standard");
  const ev = l.elemente.find((e) => e.typ === "events");
  assert.deepEqual([ev.zeit, ev.textLeer, ev.spieler], [false, "", true]);
});

test("Hintergrund: eigener Verlauf hinter oder vor dem Bild", () => {
  // ältere Versionen: verlaufDrueber
  const alt = migrateLayout({ hintergrund: "bild", hg: { bild: "b1", verlaufDrueber: true }, bilder: { b1: PNG }, elemente: [] });
  assert.equal(alt.hg.verlaufLage, "vor");
  assert.equal(migrateLayout({ elemente: [] }).hg.verlaufLage, "aus");
  assert.equal(migrateLayout({ hg: { verlaufLage: "hinter", verlaufDrueber: true }, elemente: [] }).hg.verlaufLage, "hinter");
  assert.equal(migrateLayout({ hg: { verlaufLage: "quer" }, elemente: [] }).hg.verlaufLage, "aus");
});

test("Elemente: eigener Verlauf hinter oder vor dem Inhalt", () => {
  const { STIL, elementVerlauf } = require("../src/core/stats-layout");
  assert.equal(STIL.verlaufLage, "aus");
  const std = standardLayout();
  assert.ok(std.elemente.every((e) => e.verlaufLage === "aus" && !e.verlauf), "Standard: kein Verlauf");
  const l = migrateLayout({ elemente: [
    { id: "spielstand", typ: "spielstand", x: 0, y: 0, b: 800, h: 200, verlaufLage: "vor", verlauf: { art: "radial", stopps: [{ farbe: "#FF0000", pos: 0, alpha: 40 }, { farbe: "#00ff00", pos: 100 }] } },
    { id: "logo", typ: "logo", x: 0, y: 0, b: 200, h: 200, verlaufLage: "hinter" },
    { id: "live", typ: "live", x: 0, y: 0, b: 200, h: 200, verlaufLage: "irgendwo", verlauf: "kaputt" },
  ] });
  const sp = l.elemente.find((e) => e.id === "spielstand");
  assert.equal(sp.verlaufLage, "vor");
  assert.deepEqual([sp.verlauf.art, sp.verlauf.stopps[0].farbe, sp.verlauf.stopps[0].alpha, sp.verlauf.stopps[1].alpha], ["radial", "#ff0000", 40, 100]);
  const lo = l.elemente.find((e) => e.id === "logo");
  assert.equal(lo.verlaufLage, "hinter");
  assert.deepEqual(lo.verlauf, elementVerlauf(), "ohne Verlauf: Standard für Elemente");
  const lv = l.elemente.find((e) => e.id === "live");
  assert.equal(lv.verlaufLage, "aus");
  assert.deepEqual(lv.verlauf, elementVerlauf(), "kaputter Verlauf: Standard");
});

test("Neue Elemente: Spieler-Karte und Wert werden geprüft und begrenzt", () => {
  const { neuerSpieler, neuerWert, MAX_SPIELER } = require("../src/core/stats-layout");
  const l = migrateLayout({ elemente: [
    neuerSpieler({ quelle: "PC 03", kills: false }), { ...neuerWert(), wert: "quatsch", rang: 99, farbe: "rot" },
    ...Array.from({ length: 14 }, () => neuerSpieler()),
  ] });
  const sp = l.elemente.filter((e) => e.typ === "spieler");
  assert.equal(sp.length, MAX_SPIELER);
  assert.deepEqual([sp[0].quelle, sp[0].kills, sp[0].tode], ["PC 03", false, true]);
  const w = l.elemente.find((e) => e.typ === "wert");
  assert.deepEqual([w.wert, w.rang, w.farbe], ["score1", 20, "#ffffff"]);
});

test("Stats-Screen: Spieler aus Statistik, Shots Fired und PC-Status; Teams aus ui_team_order", () => {
  const { spielerDaten, spielerWahl, teamListen, wertVon } = require("../src/core/stats-screen");
  const { SPIEL_BY_ID } = require("../src/core/spiele");
  const val = SPIEL_BY_ID.valorant;
  const [t1, t2] = val.teams;
  const status = {
    namen: { "PC 01": "Momo" },
    statistik: { spiel: "valorant", alle: [{ id: "PC 01", name: "Momo", team: t1, kills: 7, tode: 2, headshots: 3, assists: 1 }], match: { kills: 9, tode: 5 }, runde: { nr: 8 } },
    pcs: [
      { pcId: "PC 01", spiel: "valorant", verbunden: true, stand: { sf: { team: t1, seite: "Angriff", verbuendete: ["Momo", "Kira"], gegner: ["Rex", "Juno"], kills: 6, agent: "Jett", waffe: "Vandal" } } },
      { pcId: "PC 02", spiel: "valorant", verbunden: true, status: { team: t2, kills: 2, deaths: 4 }, stand: { sf: { kills: 3, deaths: 1, headshots: 2 } } },
      { pcId: "PC 03", spiel: "cs2", verbunden: true },
    ],
  };
  const l = spielerDaten(status, "valorant");
  assert.deepEqual(l.map((p) => [p.name, p.team, p.seite, p.kills, p.tode, p.headshots]), [["Momo", t1, "Angriff", 7, 2, 3], ["PC 02", t2, "", 3, 1, 2]]);
  assert.equal(spielerWahl(l, "rang", 2).name, "PC 02");
  assert.equal(spielerWahl(l, "PC 01").name, "Momo");
  assert.equal(spielerWahl(l, "rang", 5), null);
  const teams = teamListen(status, val);
  assert.deepEqual(teams.map((t) => [t.name, t.spieler.map((p) => p.name)]), [[t1, ["Momo", "Kira"]], [t2, ["Rex", "Juno"]]]);
  assert.equal(teams[0].spieler[0].kills, 7);
  // Ohne Listen: nach Team
  const ohne = { ...status, pcs: status.pcs.map((p) => ({ ...p, stand: { sf: { ...p.stand?.sf, verbuendete: [], gegner: [] } } })) };
  assert.deepEqual(teamListen(ohne, val).map((t) => [t.name, t.spieler.map((p) => p.name)]), [[t1, ["Momo"]], [t2, ["PC 02"]]]);
  assert.equal(wertVon("runde", { statistik: status.statistik }), "8");
  assert.equal(wertVon("kills", { statistik: status.statistik }), "9");
  assert.equal(wertVon("sp.kd", { sp: l[0] }), "3.50");
  assert.equal(wertVon("sp.seite", { sp: l[1] }), "–");
  assert.equal(wertVon("sp.agent", { sp: l[0] }), "Jett");
  assert.equal(wertVon("sp.waffe", { sp: l[0] }), "Vandal");
  assert.equal(wertVon("sp.waffe", { sp: l[1] }), "–");
  assert.equal(teams[0].spieler[0].agent, "Jett");
  assert.equal(wertVon("score1", { d: { teams: [{ name: "A", score: 4 }] } }), "4");
});

test("MVP-Endscreen: Ranking nach Punkten (Kills, Headshots, Assists, MVPs, Tode)", () => {
  const { ranking } = require("../src/core/stats-screen");
  const { SPIEL_BY_ID } = require("../src/core/spiele");
  const status = { statistik: { spiel: "cs2", alle: [
    { name: "A", team: "CT", kills: 10, tode: 8, headshots: 2, assists: 0, mvps: 0 },
    { name: "B", team: "T", kills: 9, tode: 2, headshots: 6, assists: 0, mvps: 2 },
    { name: "C", team: "T", kills: 0, tode: 0, headshots: 0, assists: 0, mvps: 0 },
  ] } };
  const r = ranking(status, SPIEL_BY_ID.cs2);
  assert.deepEqual(r.map((p) => [p.name, p.punkte, p.kd, p.hsQuote]), [["B", 9*100 + 6*30 + 2*150 - 2*50, "4.50", 67], ["A", 10*100 + 2*30 - 8*50, "1.25", 20], ["C", 0, "0", 0]]);
  assert.deepEqual(ranking({}, SPIEL_BY_ID.cs2), []);
});

test("Anzeigen mehrfach: hinzugefügte Kopien mit eigener ID und eigenen Einstellungen", () => {
  const { neueAnzeige, MAX_KOPIEN } = require("../src/core/stats-layout");
  const n = neueAnzeige("spielstand", { name1: "ROT" }, { b: 800, h: 200 });
  assert.ok(n.id !== "spielstand" && n.sichtbar && n.typ === "spielstand");
  assert.ok(n.x + n.b <= 800 && n.y + n.h <= 200, "in der Fläche");
  assert.equal(neueAnzeige("gibtsnicht"), null);
  const l = migrateLayout({ elemente: [
    { id: "a1", typ: "spielstand", x: 0, y: 0, b: 500, h: 200, benennung: "spiel", farbe1: "#FF0000" },
    { id: "spielstand", typ: "spielstand", x: 0, y: 0, b: 500, h: 200 },
    { id: "spielstand", typ: "spielstand", x: 10, y: 10, b: 500, h: 200 }, // doppelte Basis: fällt weg
    { id: "a1", typ: "spielstand", x: 10, y: 10, b: 500, h: 200 }, // doppelte ID einer Kopie: neue ID
    ...Array.from({ length: MAX_KOPIEN + 5 }, (_, i) => ({ id: `k${i}`, typ: "logo", x: 0, y: 0, b: 300, h: 80 })),
  ] });
  const staende = l.elemente.filter((e) => e.typ === "spielstand");
  assert.equal(staende.length, 3);
  assert.equal(staende.filter((e) => e.id === "spielstand").length, 1, "nur eine Basis-Anzeige");
  const a1 = staende.find((e) => e.id === "a1");
  assert.deepEqual([a1.benennung, a1.farbe1, a1.name1], ["spiel", "#ff0000", ""]);
  assert.equal(new Set(l.elemente.map((e) => e.id)).size, l.elemente.length, "IDs eindeutig");
  assert.equal(l.elemente.filter((e) => e.id !== e.typ && e.typ !== "text").length, MAX_KOPIEN, "höchstens MAX_KOPIEN Kopien");
  assert.ok(l.elemente.some((e) => e.id === "logo"), "Basis-Logo bleibt (ausgeblendet)");
});

test("Teams: Benennung nach Spiel, Namen von Hand, Farbe je Team", () => {
  const { teamSeiten, teamAnzeige } = require("../src/core/stats-screen");
  const { SPIEL_BY_ID } = require("../src/core/spiele");
  const val = SPIEL_BY_ID.valorant;
  // Shots Fired meldet Team und Seite eines PCs
  const s1 = teamSeiten({ pcs: [{ spiel: "valorant", stand: { sf: { team: "TEAM B", seite: "Angriff" } } }] }, val);
  assert.deepEqual(s1, { "TEAM B": "Angriff", "TEAM A": "Verteidigung" });
  // Ohne Shots Fired: aus der Runde (TEAM A beginnt im Angriff)
  assert.deepEqual(teamSeiten({ statistik: { spiel: "valorant", runde: { nr: 3 } } }, val), { "TEAM A": "Angriff", "TEAM B": "Verteidigung" });
  assert.deepEqual(teamSeiten({ statistik: { spiel: "valorant", runde: { nr: 14 } } }, val), { "TEAM A": "Verteidigung", "TEAM B": "Angriff" });
  assert.deepEqual(teamSeiten({ statistik: { spiel: "valorant", runde: { nr: 26 } } }, val), {}, "Verlängerung: unsicher");
  assert.deepEqual(teamSeiten({}, SPIEL_BY_ID.cs2), {});
  const el = { benennung: "auto", name1: "", name2: "", textAngriff: "ATTACK", textVerteidigung: "DEFENSE", farbe1: "", farbe2: "" };
  assert.deepEqual(teamAnzeige(el, "TEAM A", 0, s1), { name: "DEFENSE", farbe: "#3fd4c0" });
  assert.deepEqual(teamAnzeige(el, "TEAM B", 1, s1), { name: "ATTACK", farbe: "#ff4655" });
  assert.deepEqual(teamAnzeige({ ...el, benennung: "spiel" }, "TEAM B", 1, s1), { name: "TEAM B", farbe: "" });
  assert.deepEqual(teamAnzeige({ ...el, name2: "Rot", farbe2: "#00ff00" }, "TEAM B", 1, s1), { name: "Rot", farbe: "#00ff00" }, "von Hand überschreibt");
  assert.deepEqual(teamAnzeige(el, "CT", 0, {}), { name: "CT", farbe: "" });
  assert.deepEqual(teamAnzeige(undefined, "CT", 0), { name: "CT", farbe: "" }, "ohne Einstellungen");
});

test("Screen-Layout: jedes Element außer Text und Einzelwert hat eine Überschrift, auch leer", () => {
  const { neuerSpieler, neuesBild } = require("../src/core/stats-layout");
  const l = standardLayout();
  for (const e of l.elemente) assert.equal(typeof e.titel, "string", e.typ);
  assert.equal(l.elemente.find((e) => e.typ === "spielstand").titel, "");
  assert.equal(l.elemente.find((e) => e.typ === "bestenliste").titel, "Beste Spieler");
  // Alte Layouts ohne Feld: Standard bleibt; leer bleibt leer; eigener Text bei Anzeigen ohne Standard bleibt erhalten
  const m = migrateLayout({ elemente: [{ typ: "bestenliste" }, { typ: "events", titel: "" }, { typ: "spielstand", titel: "Score {spiel}" },
    { typ: "spieler", id: "p1", titel: "Bester Spieler" }, { typ: "spieler", id: "p2" }] });
  const von = (id) => m.elemente.find((e) => e.id === id);
  assert.equal(von("bestenliste").titel, "Beste Spieler");
  assert.equal(von("events").titel, "");
  assert.equal(von("spielstand").titel, "Score {spiel}");
  assert.equal(von("p1").titel, "Bester Spieler");
  assert.equal(von("p2").titel, "");
  assert.equal(neuerSpieler().titel, "");
  assert.equal(neuesBild("b1").titel, "");
});

test("Stats-Screen Valorant: Spielstand aus Shots Fired statt gezählter Rundenenden", () => {
  const { statsDaten } = require("../src/core/stats-screen");
  const { SPIEL_BY_ID } = require("../src/core/spiele");
  const statistik = { spiel: "valorant", match: { siege: { "TEAM A": 5, "TEAM B": 9 }, runden: 16 }, runde: { nr: 17 }, top: [] };
  const stand = { spiel: "valorant", sf: { team: "TEAM B", score: { won: 10, lost: 6 } } };
  assert.deepEqual(statsDaten(SPIEL_BY_ID.valorant, statistik, stand).teams.map((t) => t.score), [6, 10]);
  assert.deepEqual(statsDaten(SPIEL_BY_ID.valorant, statistik, { spiel: "valorant" }).teams.map((t) => t.score), [5, 9], "ohne Shots Fired: gezählt");
});
