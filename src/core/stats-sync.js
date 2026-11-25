"use strict";
// Stats-Screen-PCs: die Regie schickt Layout, Stand und Events per UDP an eigene PCs, die nur den Stats-Screen zeigen.
// Schnell: jede Änderung und jedes Event geht sofort raus (ein Datagramm, kein Verbindungsaufbau).
// Robust: Multicast für alle im Netz, dazu Unicast an jeden Stats-PC, der den Multicast nicht bekommt (z. B. gesperrt
// oder anderes Subnetz). Pakete gehen verloren dürfen: der Stand kommt jede Sekunde komplett, Events gehen dreifach raus
// und stehen auch im Stand, das Layout holt sich der Stats-PC selbst, sobald die Version im Lebenszeichen nicht passt.
// Reine Funktionen, laufen im Hauptprozess und in den Tests.

const zlib = require("zlib");
const crypto = require("crypto");

const { DATEN_PORT, GRUPPE, istMulticast } = require("./stats-sync-cfg");
const STEUER_PORT = DATEN_PORT + 1; // Regie lauscht auf Port + 1 (Anmeldung und Anfragen der Stats-PCs)
const NUTZLAST = 1100; // Bytes je Datagramm: bleibt unter jeder üblichen MTU, nichts wird fragmentiert
const MAGIC = Buffer.from("ALS1");
const KOPF = 18; // MAGIC 4, Art 1, Weg 1, Sender 4, Nummer 4, Teil 2, Teile 2
const ARTEN = { status: 1, event: 2, cfg: 3, beacon: 4, abo: 5, anfrage: 6 };
const ART_NAME = Object.fromEntries(Object.entries(ARTEN).map(([k, v]) => [v, k]));
const WEGE = { multicast: 0, unicast: 1 };
const MAX_TEILE = 4096; // höchstens ~4,5 MB je Nachricht (Layout mit Bildern)

// Objekt → Datagramme. weg: über Multicast oder Unicast geschickt (der Stats-PC sieht so, ob der Multicast ankommt)
function verpacken(art, sender, nummer, obj, weg = "multicast") {
  const roh = zlib.deflateRawSync(Buffer.from(JSON.stringify(obj)));
  const teile = Math.max(1, Math.ceil(roh.length / NUTZLAST));
  if (teile > MAX_TEILE) throw new Error("Nachricht zu groß");
  const out = [];
  for (let i = 0; i < teile; i++) {
    const kopf = Buffer.alloc(KOPF);
    MAGIC.copy(kopf, 0);
    kopf.writeUInt8(ARTEN[art], 4);
    kopf.writeUInt8(WEGE[weg] ?? 0, 5);
    kopf.writeUInt32BE(sender >>> 0, 6);
    kopf.writeUInt32BE(nummer >>> 0, 10);
    kopf.writeUInt16BE(i, 14);
    kopf.writeUInt16BE(teile, 16);
    out.push(Buffer.concat([kopf, roh.subarray(i * NUTZLAST, (i + 1) * NUTZLAST)]));
  }
  return out;
}

// Ein Datagramm lesen → { art, weg, sender, nummer, teil, teile, daten } oder null (fremd oder kaputt)
function lesePaket(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < KOPF || !buf.subarray(0, 4).equals(MAGIC)) return null;
  const art = ART_NAME[buf.readUInt8(4)];
  const teil = buf.readUInt16BE(14), teile = buf.readUInt16BE(16);
  if (!art || !teile || teile > MAX_TEILE || teil >= teile) return null;
  return { art, weg: buf.readUInt8(5) === WEGE.unicast ? "unicast" : "multicast", sender: buf.readUInt32BE(6), nummer: buf.readUInt32BE(10), teil, teile, daten: buf.subarray(KOPF) };
}

// Setzt Nachrichten aus ihren Datagrammen zusammen. Unvollständige verfallen nach ttl ms (der nächste Stand heilt das),
// doppelte (über Multicast und Unicast, oder ein Event dreimal) kommen nur einmal heraus.
class Zusammensetzer {
  constructor(ttl = 3000) { this.ttl = ttl; this.offen = new Map(); this.fertig = new Map(); }
  nimm(p, jetzt = Date.now()) {
    if (!p) return null;
    const key = `${p.sender}:${p.art}:${p.nummer}`;
    if (this.fertig.has(key)) return null;
    let m = this.offen.get(key);
    if (!m) { m = { teile: new Array(p.teile), da: 0, t: jetzt }; this.offen.set(key, m); }
    if (m.teile.length !== p.teile) return null;
    if (!m.teile[p.teil]) { m.teile[p.teil] = Buffer.from(p.daten); m.da++; }
    this.aufraeumen(jetzt);
    if (m.da < p.teile) return null;
    this.offen.delete(key);
    this.fertig.set(key, jetzt);
    try { return { art: p.art, weg: p.weg, sender: p.sender, nummer: p.nummer, obj: JSON.parse(zlib.inflateRawSync(Buffer.concat(m.teile)).toString("utf8")) }; }
    catch { return null; }
  }
  aufraeumen(jetzt) {
    for (const [k, m] of this.offen) if (jetzt - m.t > this.ttl) this.offen.delete(k);
    if (this.fertig.size > 500) for (const [k, t] of this.fertig) if (jetzt - t > 30000 || this.fertig.size > 400) this.fertig.delete(k);
  }
}

// Was ein Stats-PC von den Einstellungen der Regie braucht: Screens mit Layouts, Session-Name, aktives Spiel
function cfgAuszug(cfg) {
  const r = cfg?.regie || {};
  return { regie: { stats: r.stats || null, session: { name: r.session?.name || "" }, aktivesSpiel: r.aktivesSpiel || "", spiele: r.spiele || {} } };
}

// Stand der Regie für den Stats-Screen: ohne Fenster-/NDI-Zustand der Regie, dazu die letzten Events
function statusAuszug(regieStatus, log, max = 30) {
  if (!regieStatus) return null;
  const { stats, sim, ...rest } = regieStatus;
  return { status: rest, log: (log || []).slice(0, max) };
}

const versionVon = (obj) => crypto.createHash("sha1").update(JSON.stringify(obj)).digest("hex").slice(0, 12);

module.exports = {
  DATEN_PORT, STEUER_PORT, GRUPPE, NUTZLAST, ARTEN,
  verpacken, lesePaket, Zusammensetzer, cfgAuszug, statusAuszug, versionVon,
};
