const test = require("node:test");
const assert = require("node:assert/strict");
const { SIG_B, SIG_H, SIG_LAENGE, signatur, normiert, aehnlichkeit, bildLeer, kodieren, dekodieren, region, umrechnen, textPasst, BildErkennung } = require("../src/core/bild-erkennung");
const { standardBild, migrateBild, exportDatei, importDatei, erkennungsPlan } = require("../src/core/bild-spiele");

// Testbild: b × h Pixel RGBA, farbe(x, y) → Grauwert
const bild = (b, h, farbe) => {
  const d = new Uint8ClampedArray(b * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < b; x++) { const i = (y * b + x) * 4, g = farbe(x, y); d[i] = d[i + 1] = d[i + 2] = g; d[i + 3] = 255; }
  return d;
};
const streifen = (b, h, n) => signatur(bild(b, h, (x) => (Math.floor((x / b) * n) % 2 ? 230 : 20)), b, h);
const verlauf = (b, h) => signatur(bild(b, h, (x, y) => Math.round((y / h) * 255)), b, h);

test("Bilderkennung: Signatur unabhängig von Größe und Helligkeit, Form zählt", () => {
  const a = streifen(320, 120, 8), b = streifen(64, 24, 8);
  assert.equal(a.length, SIG_LAENGE);
  assert.ok(aehnlichkeit(normiert(a), normiert(b)) > 0.95, "gleiche Form, andere Größe");
  const hell = signatur(bild(320, 120, (x) => (Math.floor((x / 320) * 8) % 2 ? 250 : 120)), 320, 120);
  assert.ok(aehnlichkeit(normiert(a), normiert(hell)) > 0.95, "gleiche Form, andere Helligkeit");
  assert.ok(aehnlichkeit(normiert(a), normiert(verlauf(320, 120))) < 0.3, "andere Form");
  assert.equal(normiert(signatur(bild(SIG_B, SIG_H, () => 90), SIG_B, SIG_H)), null, "einfarbig hat keine Form");
  assert.equal(bildLeer(bild(10, 10, () => 3)), true);
  assert.equal(bildLeer(bild(10, 10, (x) => x * 20)), false);
  assert.deepEqual(dekodieren(kodieren(a)), a);
  assert.deepEqual([...dekodieren(kodieren(new Uint8Array([1, 2, 3, 4])))], [1, 2, 3, 4]);
});

test("Bilderkennung: Treffer nach zwei Bildern, erst wieder nach Verschwinden, Gruppe wählt die ähnlichste", () => {
  const A = streifen(64, 24, 8), B = streifen(64, 24, 3), leer = verlauf(64, 24);
  const e = new BildErkennung({ aktionen: [{ id: "sieg", gruppe: "g", pause: 0 }, { id: "niederlage", gruppe: "g", pause: 0 }, { id: "kill", pause: 5000 }] });
  e.setVorlagen({ sieg: [kodieren(A)], niederlage: [B], kill: [A, B] });
  const ids = (sigs, t) => e.frame(sigs, t).erkannt.map((x) => x.id);
  assert.deepEqual(ids({ sieg: A, niederlage: A, kill: leer }, 0), []);
  assert.deepEqual(ids({ sieg: A, niederlage: A, kill: leer }, 100), ["sieg"], "nur die ähnlichere der Gruppe");
  assert.deepEqual(ids({ sieg: A, niederlage: A }, 200), [], "bleibt stehen: kein zweiter Treffer");
  ids({ sieg: leer, niederlage: leer }, 300);
  ids({ sieg: A, niederlage: A }, 400);
  assert.deepEqual(ids({ sieg: A, niederlage: A }, 500), ["sieg"], "nach Verschwinden wieder scharf");
  // Anderer Frame derselben Aktion (Kill-Banner mit einem Kill mehr) meldet sich neu, aber erst nach der Pause
  ids({ kill: A }, 0); assert.deepEqual(ids({ kill: A }, 100), ["kill"]);
  ids({ kill: B }, 200); assert.deepEqual(ids({ kill: B }, 300), [], "Pause");
  assert.deepEqual(ids({ kill: B }, 5100), ["kill"], "nach der Pause, ohne erneut zu warten");
});

test("Bilderkennung: Text muss zusätzlich passen, auch ohne Frames", () => {
  assert.ok(textPasst("  Runde Gewonnen! ", "ROUND WON|RUNDE GEWONNEN"));
  assert.ok(textPasst("V1CT0RY", "VICTORY"), "0/O und 1/I");
  assert.ok(!textPasst("DEFEAT", "VICTORY"));
  assert.ok(!textPasst("", "VICTORY"));
  const A = streifen(64, 24, 8);
  const e = new BildErkennung({ aktionen: [{ id: "a", text: "SIEG" }, { id: "b", text: "SPIKE|BOMBE" }] });
  e.setVorlagen({ a: [A] });
  e.frame({ a: A }, 0, { a: "Niederlage", b: "Spike gelegt" });
  const r = e.frame({ a: A }, 100, { a: "Niederlage", b: "Spike gelegt" });
  assert.equal(r.werte.a, 0);
  assert.deepEqual(r.erkannt.map((x) => x.id), ["b"]);
  e.frame({ a: A }, 200, { a: "SIEG" });
  assert.deepEqual(e.frame({ a: A }, 300, { a: "SIEG" }).erkannt.map((x) => x.id), ["a"]);
});

test("Bilderkennung: Bereiche bei anderem Seitenverhältnis nach Anker umrechnen", () => {
  assert.deepEqual(region({ x: 2, y: -1, b: 0, h: 5 }), { x: 0.995, y: 0, b: 0.005, h: 1 });
  const nah = (a, b) => Object.keys(a).forEach((k) => assert.ok(Math.abs(a[k] - b[k]) < 1e-6, `${k}: ${a[k]} ≠ ${b[k]}`));
  const von = { b: 1920, h: 1080 }, breit = { b: 2560, h: 1080 };
  // 16:9 → 21:9 bei gleicher Höhe: HUD bleibt gleich groß, rechts verankerte Teile rutschen mit dem Rand
  nah(umrechnen({ x: 0.9, y: 0.1, b: 0.05, h: 0.05 }, von, breit, { h: "rechts", v: "oben" }), { x: (2560 - 192) / 2560, y: 0.1, b: 96 / 2560, h: 0.05 });
  nah(umrechnen({ x: 0.45, y: 0.5, b: 0.1, h: 0.1 }, von, breit, { h: "mitte", v: "mitte" }), { x: (1280 - 96) / 2560, y: 0.5, b: 192 / 2560, h: 0.1 });
  nah(umrechnen({ x: 0.1, y: 0.8, b: 0.1, h: 0.1 }, von, breit, { h: "links", v: "unten" }), { x: 192 / 2560, y: 0.8, b: 192 / 2560, h: 0.1 });
  // Gleiches Seitenverhältnis, andere Auflösung: nichts ändert sich
  nah(umrechnen({ x: 0.9, y: 0.1, b: 0.05, h: 0.05 }, von, { b: 2560, h: 1440 }), { x: 0.9, y: 0.1, b: 0.05, h: 0.05 });
});

test("Spiel-Konfiguration: Migration, Export ohne Team, Import mit Korrektur", () => {
  const sig = kodieren(streifen(64, 24, 8));
  const cfg = migrateBild({ fps: 99, spiele: { valorant: { team: "TEAM B", aufloesung: { b: 1920, h: 1080 }, aktionen: [
    { id: "x1", event: "round_end", seite: "gegner", region: { x: 0.9, y: 0.1, b: 0.05, h: 0.05 }, anker: { h: "rechts", v: "oben" }, vorlagen: [{ sig, bild: "data:image/jpeg;base64,AA" }, { sig: "kaputt" }], schwelle: 2 },
    { event: "gibtsnicht" },
  ] } } });
  assert.equal(cfg.fps, standardBild().fps);
  const v = cfg.spiele.valorant;
  assert.equal(v.team, "TEAM B");
  assert.equal(v.aktionen.length, 1);
  assert.equal(v.aktionen[0].vorlagen.length, 1);
  assert.equal(v.aktionen[0].schwelle, 0.99);
  assert.equal(cfg.spiele.finals.team, "TEAM A");

  const datei = JSON.stringify(exportDatei("valorant", v));
  assert.ok(!datei.includes("TEAM B"), "Team stellt jeder PC selbst ein");
  const gleich = importDatei(datei, { b: 2560, h: 1440 });
  assert.equal(gleich.korrigiert, false);
  assert.deepEqual(gleich.aktionen[0].region, v.aktionen[0].region);
  const breit = importDatei(datei, { b: 2560, h: 1080 });
  assert.equal(breit.korrigiert, true);
  assert.deepEqual(breit.aufloesung, { b: 2560, h: 1080 });
  assert.ok(breit.aktionen[0].region.x > 0.9);
  assert.equal(breit.aktionen[0].seite, "gegner");

  assert.match(importDatei("{kaputt", null).fehler, /JSON/);
  assert.ok(importDatei({ format: "anders" }).fehler);
  assert.ok(importDatei({ format: "advanced-lan-spiel", spiel: "ow2", aktionen: [] }).fehler);
  assert.ok(importDatei({ format: "advanced-lan-spiel", spiel: "finals", aktionen: [] }).fehler);
});

test("Bildquellen: Spielfenster automatisch, mehrere Spiele gleichzeitig, Fenster oder Bildschirm von Hand", () => {
  const sig = kodieren(streifen(64, 24, 8));
  const aktion = { id: "a", event: "kill", region: { x: 0.1, y: 0.1, b: 0.1, h: 0.1 }, vorlagen: [{ sig }] };
  const cfg = migrateBild({ spiele: { valorant: { aktionen: [aktion] }, finals: { aktionen: [aktion] } } });
  const fenster = [{ id: "window:1:0", name: "VALORANT  " }, { id: "window:2:0", name: "THE FINALS  " }, { id: "window:3:0", name: "OBS 31" }];
  assert.deepEqual(erkennungsPlan(cfg, []), {}, "kein Spiel offen: keine Erkennung");
  const plan = erkennungsPlan(cfg, fenster);
  assert.deepEqual(Object.keys(plan), ["valorant", "finals"]);
  assert.deepEqual(plan.valorant, { art: "fenster", id: "window:1:0", name: "VALORANT" });
  assert.equal(plan.finals.id, "window:2:0");
  // Valorant-Launcher oder ein Browser-Tab „Valorant Guide“ zählen nicht als Spielfenster
  assert.deepEqual(erkennungsPlan(cfg, [{ id: "w", name: "Valorant Guide – Chrome" }]), {});
  cfg.spiele.valorant.quelle = "fenster:OBS 31";
  assert.equal(erkennungsPlan(cfg, fenster).valorant.id, "window:3:0");
  cfg.spiele.valorant.quelle = "bildschirm";
  assert.deepEqual(erkennungsPlan(cfg, [], "valorant").valorant, { art: "bildschirm", name: "Bildschirm" }, "Bildschirm: läuft, wenn die Regie das Spiel aktiv hat");
  assert.equal(migrateBild({ spiele: { valorant: { quelle: "irgendwas" } } }).spiele.valorant.quelle, "auto");
  cfg.an = false;
  assert.deepEqual(erkennungsPlan(cfg, fenster), {});
});

test("Texterkennung: alle Tesseract-Kerne sind im Build (Node lädt je nach CPU einen anderen)", () => {
  const pkg = require("../package.json");
  assert.ok(!pkg.build.files.some((f) => f.startsWith("!") && f.includes("tesseract.js-core")), "kein Kern ausgeschlossen");
});
