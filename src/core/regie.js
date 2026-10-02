"use strict";
// Regie: nimmt Ereignisse der Game-PCs an, lässt nur das aktive Spiel durch, entdoppelt und sendet OSC-Signale an alle Ziele.
// Ohne Netzwerk: Senden und Melden kommen von außen (Main-Prozess oder Browser-Vorschau).

const { Dedupe } = require("./events");
const { eventInfo } = require("./spiele");
const { oscAdresse, oscArgs, freigegeben } = require("./signal");
const { Statistik } = require("./statistik");

const LOG_MAX = 300;

class Regie {
  constructor({ getConfig, send, emit, now = Date.now }) {
    this.getConfig = getConfig;
    this.send = send; // ({ ziel, address, args }) → Promise
    this.emit = emit || (() => {}); // (typ, daten)
    this.now = now;
    this.pcs = new Map(); // pcId → { pcId, spiele, spiel (zuletzt gemeldet), verbunden, remote, sim, t, status, stand }
    this.stand = null; // letzter Spielstand des aktiven Spiels
    this.log = [];
    this.dedupe = new Dedupe();
    this.zaehler = { ereignisse: 0, verworfen: 0, gesendet: 0, fehler: 0 };
    this.nr = 0;
    this.statistik = new Statistik();
  }

  aktiv() { return this.getConfig().aktivesSpiel; }

  pcVerbunden(pcId, { spiele = [], remote = "", sim = false } = {}) {
    const alt = this.pcs.get(pcId) || {};
    this.pcs.set(pcId, { ...alt, pcId, spiele, remote, sim, verbunden: true, t: this.now() });
    this.emit("status");
  }

  pcGetrennt(pcId) {
    const p = this.pcs.get(pcId);
    if (p) { p.verbunden = false; this.emit("status"); }
  }

  pcPing(pcId, ms) {
    const p = this.pcs.get(pcId);
    if (p) { p.ping = ms; p.pingT = this.now(); }
  }

  pcEntfernen(pcId) { this.pcs.delete(pcId); this.emit("status"); }

  // Status-Meldung eines Game-PCs (Spieler, Leben, Spielstand)
  pcStatus(pcId, { spiel, status, stand }) {
    const p = this.pcs.get(pcId);
    if (!p) return;
    Object.assign(p, { spiel: spiel || p.spiel, status: status || p.status, t: this.now() });
    if (stand) { p.stand = stand; if (p.spiel === this.aktiv()) this.stand = { ...stand, spiel: p.spiel, t: this.now() }; }
    this.emit("status");
  }

  // Ereignis eines Game-PCs. Nur das aktive Spiel erzeugt Signale, alles andere wird verworfen.
  pcEvent(pcId, spiel, ev) {
    const p = this.pcs.get(pcId);
    if (p) { p.t = this.now(); p.spiel = spiel; }
    if (spiel !== this.aktiv()) { this.zaehler.verworfen++; this.emit("status"); return null; }
    const e = { ...ev, spiel, pc: pcId, pcId };
    if (!this.dedupe.accept(e, this.now())) return null; // mehrere PCs melden dieselbe Runde
    return this.fire(e, p?.sim ? "sim" : "pc");
  }

  // Neutrales Signal an alle Ziele. Gesperrte Ereignisse (Tab „Signale“) werden nur angezeigt.
  fire(ev, quelle = "pc") {
    const cfg = this.getConfig(), now = this.now();
    this.zaehler.ereignisse++;
    const an = freigegeben(cfg, ev.spiel, ev.type);
    const s = this.signal(ev);
    const eintrag = { id: ++this.nr, t: now, ev, quelle, scharf: !!cfg.armed, gesperrt: !an, address: s.address, args: s.args.map((a) => a.value), ziele: (cfg.targets || []).length, fehler: [] };
    if (cfg.armed && an) this.ausgeben(s, eintrag);
    if (ev.spiel === this.aktiv()) this.statistik.add(ev);
    this.log.unshift(eintrag);
    if (this.log.length > LOG_MAX) this.log.length = LOG_MAX;
    this.emit("event", eintrag);
    this.emit("status");
    return eintrag;
  }

  signal(ev) {
    const spieler = !!eventInfo(ev.spiel, ev.type)?.spieler;
    return { address: oscAdresse(ev, spieler), args: oscArgs(ev, spieler) };
  }

  // Test-Knopf: sendet sofort, unabhängig von „scharf“ und Freigabe
  testeSignal(spiel, type) {
    const s = this.signal({ type, spiel, team: "CT", player: "Testspieler", pc: "Regie", pcId: "test", round: 1 });
    const k = { address: s.address, args: s.args.map((a) => a.value), fehler: [] };
    this.ausgeben(s, k);
    return k;
  }

  ausgeben(s, k) {
    for (const ziel of this.getConfig().targets || []) {
      this.zaehler.gesendet++;
      Promise.resolve(this.send({ ziel, address: s.address, args: s.args })).catch((e) => {
        this.zaehler.fehler++;
        k.fehler.push(`${ziel.host}:${ziel.port}: ${e.message}`);
        this.emit("fehler", `${ziel.name || ziel.host}: ${e.message}`);
      });
    }
  }

  snapshot() {
    return { pcs: [...this.pcs.values()], stand: this.stand, zaehler: { ...this.zaehler }, aktivesSpiel: this.aktiv(), statistik: this.statistik.json() };
  }
}

module.exports = { Regie };
