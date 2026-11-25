const test = require("node:test");
const assert = require("node:assert/strict");
const { verpacken, lesePaket, Zusammensetzer, cfgAuszug, statusAuszug, versionVon, NUTZLAST } = require("../src/core/stats-sync");
const { migrateSync, migrateStatsPc, standardSync, DATEN_PORT, GRUPPE } = require("../src/core/stats-sync-cfg");
const { migrateKonfig, MODI } = require("../src/core/defaults");

test("Stats-Sync: kleine Nachricht in einem Datagramm", () => {
  const p = verpacken("status", 7, 1, { a: 1 });
  assert.equal(p.length, 1);
  const l = lesePaket(p[0]);
  assert.deepEqual([l.art, l.weg, l.sender, l.nummer, l.teil, l.teile], ["status", "multicast", 7, 1, 0, 1]);
  assert.deepEqual(new Zusammensetzer().nimm(l).obj, { a: 1 });
  assert.equal(lesePaket(Buffer.from("quatsch")), null);
  assert.equal(lesePaket(Buffer.alloc(40)), null);
});

test("Stats-Sync: große Nachricht in Teilen, jede Reihenfolge, doppelt nur einmal, unvollständig verfällt", () => {
  const gross = { bild: require("crypto").randomBytes(6000).toString("base64"), liste: Array.from({ length: 50 }, (_, i) => ({ i })) };
  const p = verpacken("cfg", 9, 42, gross, "unicast");
  assert.ok(p.length > 3 && p.every((b) => b.length <= NUTZLAST + 18), "jedes Datagramm unter der MTU");
  const z = new Zusammensetzer(1000);
  const umgedreht = [...p].reverse().map((b) => lesePaket(b));
  let fertig = null;
  for (const x of umgedreht) fertig = z.nimm(x, 0) || fertig;
  assert.equal(fertig.weg, "unicast");
  assert.deepEqual(fertig.obj, gross);
  assert.equal(z.nimm(lesePaket(p[0]), 0), null, "schon fertig: nicht noch einmal");
  // Ein Teil fehlt: nichts, nach Ablauf aufgeräumt
  const z2 = new Zusammensetzer(1000);
  for (const x of p.slice(1)) assert.equal(z2.nimm(lesePaket(x), 0), null);
  z2.nimm(lesePaket(verpacken("status", 1, 1, {})[0]), 5000);
  assert.equal(z2.offen.size, 0, "unvollständige Nachricht verfallen");
});

test("Stats-Sync: Auszüge und Version", () => {
  const cfg = migrateKonfig(null);
  const a = cfgAuszug(cfg);
  assert.deepEqual(Object.keys(a.regie).sort(), ["aktivesSpiel", "session", "spiele", "stats"]);
  assert.equal(a.regie.session.passwort, undefined, "kein Passwort an die Stats-PCs");
  assert.equal(versionVon(a), versionVon(JSON.parse(JSON.stringify(a))));
  assert.notEqual(versionVon(a), versionVon({ ...a, x: 1 }));
  const s = statusAuszug({ pcs: [], stats: { fenster: true }, sim: {}, aktivesSpiel: "cs2" }, Array.from({ length: 50 }, (_, i) => ({ id: i })));
  assert.deepEqual(Object.keys(s.status), ["pcs", "aktivesSpiel"]);
  assert.equal(s.log.length, 30);
  assert.equal(statusAuszug(null), null);
});

test("Stats-Sync: Einstellungen und Modus", () => {
  assert.ok(MODI.includes("stats"));
  assert.deepEqual(migrateSync(null), standardSync());
  assert.deepEqual(migrateSync({ an: false, gruppe: "10.0.0.1", port: 80 }), { an: false, gruppe: GRUPPE, port: DATEN_PORT, netz: "" });
  assert.equal(migrateSync({ gruppe: "239.1.2.3", port: 50000 }).gruppe, "239.1.2.3");
  const pc = migrateStatsPc({ regie: " 192.168.1.5 ", fenster: ["haupt", 3], vollbild: false });
  assert.deepEqual([pc.regie, pc.fenster, pc.vollbild], ["192.168.1.5", ["haupt"], false]);
  const k = migrateKonfig({ version: 5, modus: "stats", statspc: { regie: "x" }, regie: { statsSync: { an: false } } });
  assert.deepEqual([k.modus, k.statspc.regie, k.regie.statsSync.an], ["stats", "x", false]);
});

test("Stats-Sync: Regie und Stats-PC über UDP (Unicast an der Adresse von Hand)", async () => {
  const { StatsSender, StatsEmpfaenger } = require("../src/main/stats-sync");
  const port = 40000 + Math.floor(Math.random() * 10000) * 2;
  const tx = new StatsSender({ einstellungen: () => ({ an: true, gruppe: GRUPPE, port }), ip: () => "", name: () => "LAN" });
  const got = { cfg: null, status: null, events: [] };
  const rx = new StatsEmpfaenger({ einstellungen: () => ({ regie: "127.0.0.1", gruppe: GRUPPE, port }), ip: () => "",
    onCfg: (c) => { got.cfg = c; }, onStatus: (s) => { got.status = s; }, onEvent: (e) => got.events.push(e) });
  await tx.start(); await rx.start();
  try {
    assert.ok(tx.laeuft(), tx.fehler);
    tx.setCfg({ regie: { stats: { an: true, screens: [{ id: "haupt" }] } } });
    tx.status({ status: { aktivesSpiel: "cs2" }, log: [] });
    const bis = async (f, ms = 4000) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 25)); } return true; };
    // Anmeldung → Unicast; Lebenszeichen → Layout anfragen
    assert.ok(await bis(() => tx.info().empfaenger.length === 1), "Stats-PC angemeldet");
    assert.ok(await bis(() => got.cfg), "Layout angekommen");
    assert.equal(got.cfg.regie.stats.screens[0].id, "haupt");
    assert.ok(await bis(() => got.status?.status?.aktivesSpiel === "cs2"), "Stand angekommen");
    tx.event({ id: 5, ev: { type: "kill" } });
    assert.ok(await bis(() => got.events.length >= 1));
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(got.events.length, 1, "Event dreimal gesendet, einmal angekommen");
    const i = rx.info();
    assert.ok(i.verbunden && i.layout, JSON.stringify(i));
    // Neues Layout: Version im Lebenszeichen, Stats-PC holt es
    tx.setCfg({ regie: { stats: { an: true, screens: [{ id: "neu" }] } } });
    assert.ok(await bis(() => got.cfg.regie.stats.screens[0].id === "neu"), "neues Layout");
  } finally { await rx.stop(); await tx.stop(); }
});

test("Stats-Sync: ohne Multicast geht alles per Unicast", async () => {
  const { StatsSender, StatsEmpfaenger } = require("../src/main/stats-sync");
  const port = 40001 + Math.floor(Math.random() * 10000) * 2;
  // Stats-PC in einer anderen Gruppe: bekommt den Multicast der Regie nie
  const tx = new StatsSender({ einstellungen: () => ({ an: true, gruppe: "239.255.47.99", port }), ip: () => "", name: () => "LAN" });
  const got = { cfg: null, status: null };
  const rx = new StatsEmpfaenger({ einstellungen: () => ({ regie: "127.0.0.1", gruppe: "239.255.47.98", port }), ip: () => "",
    onCfg: (c) => { got.cfg = c; }, onStatus: (s) => { got.status = s; } });
  await tx.start(); await rx.start();
  try {
    tx.setCfg({ regie: { stats: { screens: [{ id: "u" }] } } });
    tx.status({ status: { aktivesSpiel: "rl" }, log: [] });
    const bis = async (f, ms = 5000) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 25)); } return true; };
    assert.ok(await bis(() => got.cfg && got.status), JSON.stringify(rx.info()));
    assert.equal(rx.info().weg, "unicast");
    assert.equal(tx.info().empfaenger[0].multicast, false);
  } finally { await rx.stop(); await tx.stop(); }
});
