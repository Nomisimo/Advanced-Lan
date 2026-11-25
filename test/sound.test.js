const test = require("node:test");
const assert = require("node:assert/strict");
const { migrateSound, eventVonOrdner, dateienAufnehmen, nachEvent, soundFuer, istSound } = require("../src/core/sound");
const { migrateKonfig } = require("../src/core/defaults");

const datei = (ordner, name) => ({ pfad: `/s/valorant/${ordner}/${name}`, url: `file:///s/valorant/${ordner}/${name}`, name, ordner });

test("Sound: Ordnernamen werden Events zugeordnet", () => {
  assert.equal(eventVonOrdner("valorant", "kill"), "kill");
  assert.equal(eventVonOrdner("valorant", "spike_planted"), "spike_planted");
  assert.equal(eventVonOrdner("valorant", "Spike Defused"), "spike_defused");
  assert.equal(eventVonOrdner("valorant", "victory"), "match_won");
  assert.equal(eventVonOrdner("valorant", "headshots"), "headshot");
  assert.equal(eventVonOrdner("valorant", "round_info"), "");
  assert.equal(eventVonOrdner("valorant", "defeat"), "");
  assert.equal(eventVonOrdner("cs2", "spike_planted"), "", "nur Events des Spiels");
  assert.ok(istSound("a.WAV") && istSound("b.mp3") && !istSound("README.md"));
});

test("Sound: Ordner aufnehmen, neue Dateien sind aus, bekannte bleiben", () => {
  let s = dateienAufnehmen(undefined, "valorant", [datei("kill", "k1.wav"), datei("ace", "a.wav"), datei("round_info", "r.wav"), { pfad: "/s/README.md", ordner: "" }]);
  assert.equal(s.neu, 3);
  assert.deepEqual(s.dateien.map((d) => [d.event, d.an]), [["kill", false], ["ace", false], ["", false]]);
  s.dateien[0].an = true;
  s = dateienAufnehmen(s, "valorant", [datei("kill", "k1.wav"), datei("kill", "k2.wav")]);
  assert.equal(s.neu, 1);
  assert.equal(s.dateien.find((d) => d.name === "k1.wav").an, true, "Einstellung bleibt");
  // Gruppen nach Event in Spielreihenfolge, ohne Zuordnung am Ende
  assert.deepEqual(nachEvent(s, "valorant").map((g) => [g.event, g.dateien.length]), [["kill", 2], ["ace", 1], ["", 1]]);
});

test("Sound: welches Event welche Datei spielt", () => {
  const s = migrateSound({ an: true, nurScharf: true, dateien: [
    { pfad: "/k1", url: "file:///k1", spiel: "valorant", event: "kill", an: true },
    { pfad: "/k2", url: "file:///k2", spiel: "valorant", event: "kill", an: true },
    { pfad: "/k3", url: "file:///k3", spiel: "valorant", event: "kill", an: false },
    { pfad: "/c", url: "file:///c", spiel: "cs2", event: "kill", an: true },
  ] });
  const e = (type, x = {}) => ({ id: 1, scharf: true, ev: { type, spiel: "valorant" }, ...x });
  assert.equal(soundFuer(s, e("kill"), 0).pfad, "/k1");
  assert.equal(soundFuer(s, e("kill"), 0.99).pfad, "/k2", "zufällig unter den eingeschalteten");
  assert.equal(soundFuer(s, e("ace")), null);
  assert.equal(soundFuer(s, e("kill", { scharf: false })), null, "Ausgabe nicht scharf");
  assert.equal(soundFuer({ ...s, nurScharf: false }, e("kill", { scharf: false }), 0).pfad, "/k1");
  assert.equal(soundFuer(s, e("kill", { verworfen: "anderes Spiel" })), null);
  assert.equal(soundFuer({ ...s, an: false }, e("kill")), null);
  assert.equal(soundFuer(s, { id: 2, scharf: true, ev: { type: "kill", spiel: "cs2" } }, 0).pfad, "/c");
});

test("Sound: Migration und Standard in der Konfiguration", () => {
  assert.deepEqual(migrateSound(null), { an: false, nurScharf: true, geraet: "", geraetName: "", lautstaerke: 1, abbrechen: true, dateien: [] });
  const m = migrateSound({ an: true, lautstaerke: 3, dateien: [{ pfad: "/a.wav", spiel: "valorant", event: "kill", an: true }, { kaputt: 1 }] });
  assert.equal(m.lautstaerke, 1);
  assert.equal(m.dateien.length, 1);
  assert.equal(m.dateien[0].name, "a.wav");
  assert.ok(m.dateien[0].id);
  assert.equal(migrateKonfig(null).regie.sound.an, false);
});
