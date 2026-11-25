const test = require("node:test");
const assert = require("node:assert/strict");
const { migrateSound, eventVonOrdner, dateienAufnehmen, nachEvent, istSound, soundAktion, vorschlagFuer, dateiListe, dateiWert, zielEinstellung } = require("../src/core/sound");
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

test("Sound: Migration und Standard in der Konfiguration", () => {
  assert.deepEqual(migrateSound(null), { an: false, nurScharf: true, geraet: "", geraetName: "", lautstaerke: 1, abbrechen: true, beimTest: true, umgezogen: true, dateien: [] });
  const m = migrateSound({ an: true, lautstaerke: 3, dateien: [{ pfad: "/a.wav", spiel: "valorant", event: "kill", an: true }, { kaputt: 1 }] });
  assert.equal(m.lautstaerke, 1);
  assert.equal(m.dateien.length, 1);
  assert.equal(m.dateien[0].name, "a.wav");
  assert.ok(m.dateien[0].id);
  assert.equal(migrateKonfig(null).regie.sound.an, false);
});

test("Local Sound: Nachricht → Datei aus der Bibliothek, mehrere zufällig", () => {
  const s = migrateSound({ dateien: [
    { pfad: "/a.wav", url: "file:///a.wav", spiel: "valorant", event: "round_end" },
    { pfad: "/b.wav", url: "file:///b.wav", spiel: "valorant", event: "round_end" },
  ] });
  const play = (wert) => ({ address: "/sound/play", args: [{ type: "s", value: wert }] });
  assert.equal(soundAktion(s, play("/a.wav")).datei.pfad, "/a.wav");
  assert.equal(soundAktion(s, play("/a.wav\n/b.wav"), 0.99).datei.pfad, "/b.wav");
  assert.equal(soundAktion(s, play("/a.wav\n/b.wav"), 0).datei.pfad, "/a.wav");
  assert.equal(soundAktion(s, play("")).art, "fehler");
  assert.match(soundAktion(s, play("/weg/x.wav")).text, /x\.wav/);
  assert.equal(soundAktion(s, { address: "/sound/stop" }).art, "stopp");
  assert.equal(soundAktion(s, { address: "/sound/test" }).art, "test");
  assert.deepEqual(vorschlagFuer(s, "valorant", "round_end"), ["/a.wav", "/b.wav"]);
  assert.deepEqual(dateiListe(dateiWert(["/a.wav", "/a.wav", "/b.wav"])), ["/a.wav", "/b.wav"]);
  assert.deepEqual(zielEinstellung({ optionen: { lautstaerke: "50", abbrechen: "nein", geraet: "x" } }), { geraet: "x", geraetName: "", lautstaerke: 0.5, abbrechen: false });
  assert.equal(zielEinstellung({}).lautstaerke, 1);
});

test("Local Sound: Befehl über die Signale, mit Seiten-Filter", () => {
  const { befehleFuer, seiteVon } = require("../src/core/signal");
  const ziel = { id: "snd", typ: "sound", name: "Local Sound", optionen: {} };
  const cfg = { targets: [ziel], signale: { valorant: { round_end: [
    { id: "1", ziel: "snd", befehl: "abspielen", werte: { datei: "/att.wav" }, pc: "", team: "", seite: "Angriff" },
    { id: "2", ziel: "snd", befehl: "abspielen", werte: { datei: "/def.wav" }, pc: "", team: "", seite: "Verteidigung" },
  ] } } };
  const datei = (ev) => befehleFuer(cfg, { type: "round_end", spiel: "valorant", ...ev }).map((b) => b.nachrichten[0].args[0].value);
  assert.deepEqual(datei({ team: "TEAM A", round: 3 }), ["/att.wav"]); // TEAM A greift in Runde 1–12 an
  assert.deepEqual(datei({ team: "TEAM A", round: 15 }), ["/def.wav"]);
  assert.deepEqual(datei({ team: "TEAM B", round: 3 }), ["/def.wav"]);
  assert.deepEqual(datei({ team: "TEAM B", round: 26, seiteTeam: "Angriff" }), ["/att.wav"]); // Seite vom Game-PC (Verlängerung)
  assert.deepEqual(datei({ team: "TEAM B", round: 26 }), []); // Verlängerung ohne Angabe: unbekannt
  assert.equal(seiteVon({ spiel: "cs2", team: "CT", round: 1 }), "");
});

test("Local Sound: alte Sound-Einstellungen ziehen ins Ziel und in die Signale um", () => {
  const alt = { regie: { targets: [], signale: {}, sound: { an: true, geraet: "dante", geraetName: "Dante", lautstaerke: 0.8, abbrechen: false, dateien: [
    { pfad: "/k1.wav", spiel: "valorant", event: "kill", an: true },
    { pfad: "/k2.wav", spiel: "valorant", event: "kill", an: true },
    { pfad: "/k3.wav", spiel: "valorant", event: "kill", an: false },
    { pfad: "/r.wav", spiel: "valorant", event: "", an: true },
  ] } } };
  const r = migrateKonfig({ version: 5, ...alt }).regie;
  const ziel = r.targets.find((t) => t.typ === "sound");
  assert.deepEqual(ziel.optionen, { geraet: "dante", geraetName: "Dante", lautstaerke: "80", abbrechen: "nein" });
  assert.deepEqual(r.signale.valorant.kill.map((z) => [z.ziel, z.befehl, z.werte.datei]), [[ziel.id, "abspielen", "/k1.wav\n/k2.wav"]]);
  assert.equal(r.sound.umgezogen, true);
  assert.equal(r.sound.dateien.length, 4, "Bibliothek bleibt");
  // Nur einmal
  const r2 = migrateKonfig({ version: 5, regie: r }).regie;
  assert.equal(r2.targets.filter((t) => t.typ === "sound").length, 1);
  assert.equal(r2.signale.valorant.kill.length, 1);
  // Sounds waren aus: nur das Ziel
  const r3 = migrateKonfig({ version: 5, regie: { sound: { ...alt.regie.sound, an: false } } }).regie;
  assert.equal(r3.targets.length, 1);
  assert.equal(r3.signale.valorant, undefined);
});
