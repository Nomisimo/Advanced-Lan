// Planer: Plätze, Platzhalter {nr} {plan} und Rechnen, allgemeine Signale, Zuordnung echter Rechner, Game-PC-Vorlage
const test = require("node:test");
const assert = require("node:assert/strict");
const { einsetzen, nutzt } = require("../src/core/platzhalter");
const { standardPlan, migratePlan, plaetzeAnlegen, platzVon, planWert, zuordnen, rechnerPasst } = require("../src/core/plan");
const { befehleFuer, zeigeNachricht } = require("../src/core/signal");
const { aktionVon, modus, AKTIONEN } = require("../src/core/aktionen");
const { SPIEL_BY_ID } = require("../src/core/spiele");
const { standardKonfig, migrateKonfig, standardRegie } = require("../src/core/defaults");
const { showDaten, showInfo, showAnwenden, alsGespeichert, vorlageAus, vorlageAnwenden, vorlageStand, paketDatei, leseShow } = require("../src/core/show");
const { Regie } = require("../src/core/regie");

const ma3 = { id: "m", typ: "ma3", name: "MA3", host: "10.0.0.5", port: 8000, optionen: { prefix: "gma3" } };
const plan10 = () => plaetzeAnlegen(standardPlan(), 10);

test("Platzhalter: Werte und Rechnen", () => {
  assert.equal(einsetzen("{100+nr}", { nr: "3" }), "103");
  assert.equal(einsetzen("Seq {nr*10} / {(nr-1)*4+1}", { nr: "3" }), "Seq 30 / 9");
  assert.equal(einsetzen("{nr/4}", { nr: "3" }), "0.75");
  assert.equal(einsetzen("{100+nr}", {}), "", "ohne Wert keine Zahl");
  assert.equal(einsetzen("{100+spieler}", { spieler: "Momo" }), "", "Text rechnet nicht");
  assert.equal(einsetzen("{team}-{gibts nicht \"x\"}", { team: "CT" }), "CT-{gibts nicht \"x\"}", "andere Klammern bleiben");
  assert.equal(einsetzen("{nr/0}", { nr: "3" }), "");
  assert.ok(nutzt("Go {100+nr}", ["nr"]));
  assert.ok(!nutzt("Go {runde}", ["nr", "plan"]));
});

test("Plan: Plätze anlegen, Regel je Ziel, eigene Zellen, simulierte PCs", () => {
  let p = plan10();
  assert.deepEqual(p.pcs.map((x) => x.pcId).slice(0, 3), ["PC 01", "PC 02", "PC 03"]);
  assert.equal(p.pcs.length, 10);
  p.regeln.m = "{100+nr}";
  p.pcs[6].werte.m = "150";
  assert.equal(planWert(p, 3, "m"), "103");
  assert.equal(planWert(p, 7, "m"), "150", "Zelle überschreibt die Regel");
  assert.equal(planWert(p, 4, "x"), "4", "ohne Regel: {nr}");
  assert.equal(platzVon(p, "pc 05").nr, 5, "Groß-/Kleinschreibung egal");
  assert.equal(platzVon(p, "SIM 02").nr, 2, "Simulator spielt Platz 2");
  assert.equal(platzVon(p, "SIM 11"), null);
  assert.equal(platzVon(p, "Gast"), null);
  // Weniger Plätze: hinten fällt weg, vorhandene bleiben
  const kurz = plaetzeAnlegen(p, 4);
  assert.equal(kurz.pcs.length, 4);
  assert.equal(kurz.pcs[0].id, p.pcs[0].id);
  // Migration räumt auf
  const m = migratePlan({ pcs: [{ pcId: " PC 01 ", werte: { m: "" , n: 5 } }, null], regeln: { m: 7 }, vorlage: { name: "x" } });
  assert.deepEqual(m.pcs[0].werte, { n: "5" });
  assert.equal(m.pcs[0].pcId, "PC 01");
  assert.equal(m.regeln.m, "7");
  assert.equal(m.vorlage, null, "Vorlage ohne Daten fällt weg");
});

test("Signale: {plan} und {nr} je PC, PC ohne Platz sendet nichts", () => {
  const cfg = { ...standardRegie(), targets: [ma3], plan: plan10() };
  cfg.plan.regeln.m = "{100+nr}";
  cfg.signale = { cs2: { kill: [{ id: "1", ziel: "m", befehl: "go", werte: { seq: "{plan}" }, pc: "", team: "" }, { id: "2", ziel: "m", befehl: "goto_cue", werte: { seq: "{200+nr}", cue: "{nr2}" }, pc: "", team: "" }] } };
  const b = befehleFuer(cfg, { spiel: "cs2", type: "kill", pcId: "PC 03" });
  assert.deepEqual(b.flatMap((x) => x.nachrichten.map(zeigeNachricht)), ['/gma3/cmd "Go+ Sequence 103"', '/gma3/cmd "Goto Sequence 203 Cue 03"']);
  const sim = befehleFuer(cfg, { spiel: "cs2", type: "kill", pcId: "SIM 10" });
  assert.equal(sim[0].nachrichten.map(zeigeNachricht)[0], '/gma3/cmd "Go+ Sequence 110"');
  const fremd = befehleFuer(cfg, { spiel: "cs2", type: "kill", pcId: "Gast" });
  assert.equal(fremd[0].nachrichten.length, 0);
  assert.match(fremd[0].fehler, /Gast steht nicht im Plan/);
});

test("Allgemein: gilt in jedem Spiel, Spiel ergänzt oder ersetzt", () => {
  // Alle Zuordnungen zeigen auf Events, die es im Spiel gibt
  for (const a of AKTIONEN) for (const [spiel, evs] of Object.entries(a.events)) for (const ev of evs) assert.ok(SPIEL_BY_ID[spiel].events.some((e) => e.id === ev), `${spiel}/${ev}`);
  assert.equal(aktionVon("rl", "demolition").id, "kill");
  assert.equal(aktionVon("cs2", "bomb_defused"), null);
  const cfg = { ...standardRegie(), targets: [ma3] };
  cfg.signale = { allgemein: { kill: [{ id: "a", ziel: "m", befehl: "go", werte: { seq: "1" } }] }, valorant: { kill: [{ id: "v", ziel: "m", befehl: "go", werte: { seq: "2" } }] } };
  const ids = (spiel, type) => befehleFuer(cfg, { spiel, type, pcId: "PC 01" }).map((x) => x.zuweisung.id);
  assert.deepEqual(ids("cs2", "kill"), ["a"], "CS2 erbt");
  assert.deepEqual(ids("rl", "demolition"), ["a"], "Rocket League: Demolition ist der Kill");
  assert.deepEqual(ids("valorant", "kill"), ["a", "v"], "Valorant ergänzt");
  assert.equal(modus(cfg, "cs2", "kill"), "erbt");
  assert.equal(modus(cfg, "valorant", "kill"), "ergaenzt");
  cfg.ersetzt = { valorant: ["kill"], cs2: ["kill"] };
  assert.deepEqual(ids("valorant", "kill"), ["v"], "ersetzt: nur eigene");
  assert.deepEqual(ids("cs2", "kill"), [], "ersetzt ohne eigene: nichts");
  assert.equal(modus(cfg, "valorant", "kill"), "ersetzt");
  assert.equal(modus(cfg, "cs2", "bomb_defused"), "ohne");
  // Migration behält Allgemein und Ersetzt
  const m = migrateKonfig({ ...standardKonfig(), regie: { ...standardRegie(), signale: cfg.signale, ersetzt: { cs2: ["kill", 3] } } });
  assert.equal(m.regie.signale.allgemein.kill.length, 1);
  assert.deepEqual(m.regie.ersetzt, { cs2: ["kill"] });
});

test("Test-Knopf: erster Platz des Plans löst aus", () => {
  const cfg = { ...standardRegie(), targets: [ma3], plan: plan10() };
  cfg.plan.regeln.m = "{100+nr}";
  const regie = new Regie({ getConfig: () => cfg, send: () => Promise.resolve() });
  const k = regie.testeZuweisung("allgemein", "kill", { id: "t", ziel: "m", befehl: "go", werte: { seq: "{plan}" }, pc: "" });
  assert.deepEqual(k.nachrichten, ['/gma3/cmd "Go+ Sequence 101"']);
});

test("Zuordnung: Rechner, PC-ID, freier Platz", () => {
  const p = plan10();
  p.pcs[3].rechner = "GAMER-04";
  p.pcs[4].rechner = "3C:7C:3F:1A:22:05";
  assert.ok(rechnerPasst("gamer-04", { hostname: "GAMER-04" }));
  assert.ok(rechnerPasst("3c-7c-3f-1a-22-05", { mac: "3c:7c:3f:1a:22:05" }));
  assert.ok(!rechnerPasst("", { hostname: "" }));
  assert.deepEqual(zuordnen(p, { pcId: "", geraet: { hostname: "GAMER-04" } }).pcId, "PC 04", "Rechner schlägt eigene PC-ID");
  assert.equal(zuordnen(p, { pcId: "Gast", geraet: { hostname: "x", mac: "3c:7c:3f:1a:22:05" } }).pcId, "PC 05", "MAC");
  const perId = zuordnen(p, { pcId: "pc 02", geraet: { hostname: "GAMER-02" } });
  assert.equal(perId.pcId, "PC 02");
  assert.equal(perId.merken, "GAMER-02", "Platz merkt sich den Rechner");
  assert.deepEqual(zuordnen(p, { pcId: "Gast", geraet: { hostname: "NEU" } }), { pcId: "Gast", platz: null, grund: "eigen" }, "ohne auto: eigene PC-ID");
  assert.equal(zuordnen(p, { pcId: "", geraet: { hostname: "NEU" } }).pcId, "", "ohne PC-ID und ohne Platz: abgelehnt");
  p.auto = true;
  const auto = zuordnen(p, { pcId: "", geraet: { hostname: "NEU" } }, new Set(["PC 01"]));
  assert.equal(auto.pcId, "PC 02", "nächster freier Platz ohne Rechner, PC 01 ist belegt");
  assert.equal(auto.merken, "NEU");
});

test("Game-PC-Vorlage: lokale Werte bleiben, Stand passt nach dem Übernehmen", () => {
  const quelle = standardKonfig();
  quelle.modus = "gamepc";
  Object.assign(quelle.gamepc, { pcId: "PC 09", gsiPort: 3010, passwort: "x", spieler: "Nova" });
  quelle.gamepc.overlay.an = false;
  const v = vorlageAus(showDaten(quelle, "gamepc"), "Turnier");
  assert.equal(v.daten.passwort, undefined, "Passwort gehört nicht in die Vorlage");
  assert.equal(v.daten.regie, undefined);
  const ziel = standardKonfig();
  ziel.modus = "gamepc";
  Object.assign(ziel.gamepc, { pcId: "PC 02", passwort: "geheim", spieler: "Momo", autoVerbinden: true });
  ziel.gamepc.regie = { id: "LAN (REGIE)", session: "LAN", host: "10.0.0.1", port: 47801 };
  const neu = vorlageAnwenden(ziel, v);
  assert.equal(neu.gamepc.gsiPort, 3010);
  assert.equal(neu.gamepc.overlay.an, false);
  assert.equal(neu.gamepc.pcId, "PC 02");
  assert.equal(neu.gamepc.passwort, "geheim");
  assert.equal(neu.gamepc.spieler, "Momo");
  assert.equal(neu.gamepc.autoVerbinden, true);
  assert.equal(neu.gamepc.regie.session, "LAN");
  assert.equal(neu.gamepc.gsiToken, ziel.gamepc.gsiToken);
  assert.equal(vorlageStand(neu), v.stand, "Regie erkennt: Vorlage aktuell");
  assert.equal(showInfo(neu, "gamepc").name, "Turnier");
  // Einrichtungspaket: PC-ID kommt mit
  const datei = paketDatei(v, "PC 07", { appVersion: "0.1.0-beta.10" });
  const d = leseShow(JSON.stringify(datei), ["gamepc"]);
  assert.equal(d.pcId, "PC 07");
  assert.equal(showAnwenden(ziel, "gamepc", d.daten, d.name, { pcId: d.pcId }).gamepc.pcId, "PC 07");
});

test("Regie-Show: ohne Plan unverändert wie vor beta.10, Plan wandert mit", () => {
  let cfg = standardKonfig();
  cfg = alsGespeichert(cfg, "regie", "Alt");
  assert.equal(showDaten(cfg, "regie").plan, undefined);
  assert.equal(showInfo(cfg, "regie").geaendert, false);
  cfg.regie.plan = plan10();
  assert.equal(showInfo(cfg, "regie").geaendert, true);
  const daten = showDaten(cfg, "regie");
  const geladen = showAnwenden(standardKonfig(), "regie", daten, "Mit Plan");
  assert.equal(geladen.regie.plan.pcs.length, 10);
});

test("Session: Regie vergibt die PC-ID aus dem Plan und verteilt die Vorlage", async (t) => {
  const os = require("node:os");
  const { SessionServer } = require("../src/main/session-server");
  const { SessionClient } = require("../src/main/session-client");
  const warte = (bed, ms = 3000) => new Promise((res, rej) => {
    const t0 = Date.now();
    const i = setInterval(() => { if (bed()) { clearInterval(i); res(); } else if (Date.now() - t0 > ms) { clearInterval(i); rej(new Error("Zeitüberschreitung")); } }, 20);
  });
  const cfg = { ...standardRegie(), session: { name: "Plan-Test", passwort: "pw", port: 0, offen: true }, plan: plan10() };
  cfg.plan.pcs[2].rechner = os.hostname();
  const quelle = standardKonfig();
  quelle.gamepc.gsiPort = 3333;
  cfg.plan.vorlage = vorlageAus(showDaten(quelle, "gamepc"), "LAN-Vorlage");
  const regie = new Regie({ getConfig: () => cfg, send: () => Promise.resolve() });
  const gemerkt = [];
  const server = new SessionServer({ regie, getConfig: () => cfg, onMerken: (id, r) => gemerkt.push([id, r]) });
  let gp = standardKonfig();
  const client = new SessionClient({
    vorlage: () => vorlageStand(gp),
    onPcId: (id) => { gp.gamepc.pcId = id; },
    onEinrichtung: async (m) => { gp = vorlageAnwenden(gp, { name: m.name, daten: m.daten }); return vorlageStand(gp); },
  });
  t.after(async () => { client.trennen(); await server.schliessen(); });
  assert.equal(await server.oeffnen(), true);
  client.verbinden({ host: "127.0.0.1", port: server.port, passwort: "pw", pcId: "", spiele: ["cs2"] });
  await warte(() => client.zustand === "verbunden");
  assert.equal(gp.gamepc.pcId, "PC 03", "Rechner steht auf Platz 3");
  assert.ok(regie.pcs.get("PC 03")?.verbunden);
  // Vorlage kam beim Verbinden automatisch
  await warte(() => regie.pcs.get("PC 03").vorlage === cfg.plan.vorlage.stand);
  assert.equal(gp.gamepc.gsiPort, 3333);
  assert.equal(gp.gamepc.pcId, "PC 03", "PC-ID bleibt beim Übernehmen");
  // Im Plan neu zugeordnet: Platz 5 bekommt den Rechner, der PC meldet sich neu an
  cfg.plan.pcs[2].rechner = "";
  cfg.plan.pcs[4].rechner = os.hostname();
  server.neuAnmelden("PC 03");
  await warte(() => gp.gamepc.pcId === "PC 05" && client.zustand === "verbunden");
  assert.ok(regie.pcs.get("PC 05")?.verbunden);
  assert.equal(server.einrichten(), 1, "An alle verteilen");
  assert.deepEqual(gemerkt, []);
});

test("Hochzählen: Startzahl vor {nr} wird gerechnet, nicht angehängt", () => {
  const { zaehlen } = require("../src/core/platzhalter");
  assert.equal(zaehlen("10{nr}"), "{100+nr}");
  assert.equal(zaehlen("10{nr2}"), "{1000+nr}");
  assert.equal(zaehlen("Seq 10{nr}"), "Seq 10{nr}", "nur der ganze Wert");
  const p = plan10();
  p.pcs.push(...plaetzeAnlegen(p, 11).pcs.slice(10));
  p.regeln.m = "10{nr}";
  assert.deepEqual([1, 9, 10, 11].map((n) => planWert(p, n, "m")), ["101", "109", "110", "111"]);
  p.regeln.m = "10{nr2}";
  assert.deepEqual([1, 10].map((n) => planWert(p, n, "m")), ["1001", "1010"]);
  const cfg = { ...standardRegie(), targets: [ma3], plan: plan10(), signale: { cs2: { kill: [{ id: "1", ziel: "m", befehl: "go", werte: { seq: "20{nr}" } }] } } };
  assert.equal(befehleFuer(cfg, { spiel: "cs2", type: "kill", pcId: "PC 10" })[0].nachrichten.map(zeigeNachricht)[0], '/gma3/cmd "Go+ Sequence 210"');
});
