const test = require("node:test");
const assert = require("node:assert/strict");
const { verpacken, lesePaket, Zusammensetzer, cfgAuszug, statusAuszug, versionVon, NUTZLAST, luecken, ausBereichen } = require("../src/core/stats-sync");
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
  const pc = migrateStatsPc({ regie: " 192.168.1.5 ", fenster: ["haupt", 3, "haupt"], vollbild: true, lage: { haupt: { x: -1920, y: 0, b: 1280, h: 720, vollbild: true }, kaputt: { x: 1 }, "a b": { x: 0, y: 0, b: 500, h: 500 } } });
  assert.deepEqual([pc.regie, pc.fenster, pc.vollbildStart], ["192.168.1.5", ["haupt"], false], "bis 1.0.8 war Vollbild an: jetzt normale Fenster");
  assert.deepEqual(pc.lage, { haupt: { x: -1920, y: 0, b: 1280, h: 720, vollbild: true } });
  assert.equal(migrateStatsPc({ vollbildStart: true }).vollbildStart, true);
  const k = migrateKonfig({ version: 5, modus: "stats", statspc: { regie: "x" }, regie: { statsSync: { an: false } } });
  assert.deepEqual([k.modus, k.statspc.regie, k.regie.statsSync.an], ["stats", "x", false]);
  assert.deepEqual(k.statspc.eigene, { an: true, aktiv: "", screens: [] }, "ohne eigene Screens");
  // Eigene Screens: wie die der Regie, ohne NDI, doppelte IDs neu
  const e = migrateKonfig({ version: 5, modus: "stats", statspc: { eigene: { aktiv: "m2", screens: [{ id: "m1", name: "A", b: 800, h: 200, ndi: true }, { id: "m1", name: "B" }, null] } } }).statspc.eigene;
  assert.equal(e.screens.length, 2);
  assert.equal(e.screens[0].ndi, false);
  assert.notEqual(e.screens[1].id, "m1");
  assert.equal(e.aktiv, "m1", "aktiv nur, wenn es den Screen gibt");
  assert.ok(e.screens[0].layout.elemente.length > 0);
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

test("Stats-Sync: Lücken als Bereiche und zurück", () => {
  const t = [1, null, null, 1, null, 1, 1, null];
  assert.deepEqual(luecken(t), [[1, 2], [4, 4], [7, 7]]);
  assert.deepEqual(luecken(t, 2), [[1, 2], [4, 4]]);
  assert.deepEqual(luecken([1, 1]), []);
  assert.deepEqual(ausBereichen([[1, 2], [4, 4], [7, 99], ["x", 1]], 8).sort((a, b) => a - b), [1, 2, 4, 7]);
  assert.deepEqual(ausBereichen("kaputt", 8), []);
  // Nachfrage mit vielen Lücken passt in ein Datagramm
  const viele = Array.from({ length: 16000 }, (_, i) => (i % 3 ? 1 : null));
  assert.equal(verpacken("anfrage", 0, 1, { was: "cfg", id: "abc", nr: 123456, teile: luecken(viele) }).length, 1);
});

test("Stats-Sync: großes Layout mit Bildern kommt trotz verlorener Pakete vollständig an", async () => {
  const { StatsSender, StatsEmpfaenger } = require("../src/main/stats-sync");
  const crypto = require("crypto");
  const port = 40001 + Math.floor(Math.random() * 10000) * 2;
  const tx = new StatsSender({ einstellungen: () => ({ an: true, gruppe: "239.255.47.97", port }), ip: () => "", name: () => "LAN" });
  const got = { cfg: null };
  const rx = new StatsEmpfaenger({ einstellungen: () => ({ regie: "127.0.0.1", gruppe: "239.255.47.96", port }), ip: () => "",
    onCfg: (c) => { got.cfg = c; } });
  // Jedes vierte Layout-Paket geht verloren (überlaufender Puffer, WLAN)
  const echt = rx.paket.bind(rx);
  let n = 0, weg = 0;
  rx.paket = (buf, rinfo) => { const p = lesePaket(buf); if (p?.art === "cfg" && n++ % 4 === 0) { weg++; return; } echt(buf, rinfo); };
  await tx.start(); await rx.start();
  try {
    const bild = "data:image/png;base64," + crypto.randomBytes(1_500_000).toString("base64"); // ~2 MB, lässt sich kaum packen
    const cfg = { regie: { stats: { screens: [{ id: "b", layout: { bilder: { b1: bild } } }] } } };
    tx.setCfg(cfg);
    const bis = async (f, ms = 15000) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 25)); } return true; };
    assert.ok(await bis(() => got.cfg), JSON.stringify(rx.info()));
    assert.equal(got.cfg.regie.stats.screens[0].layout.bilder.b1, bild, "Bild vollständig");
    assert.ok(weg > 100, `Pakete verloren: ${weg}`);
    assert.ok(rx.info().layout);
  } finally { await rx.stop(); await tx.stop(); }
});
