"use strict";
// Regie: nimmt Ereignisse der Game-PCs an, lässt nur das aktive Spiel durch, entdoppelt und löst Cues aus.
// Ohne Netzwerk: Senden und Melden kommen von außen (Main-Prozess oder Browser-Vorschau).

const { Dedupe } = require("./events");
const { Router, nachricht } = require("./router");

const LOG_MAX = 300;

class Regie {
  constructor({ getConfig, send, emit, now = Date.now }) {
    this.getConfig = getConfig;
    this.send = send; // ({ ziel, address, args }) → Promise
    this.emit = emit || (() => {}); // (typ, daten)
    this.now = now;
    this.pcs = new Map(); // pcId → { pcId, spiel, verbunden, remote, sim, t, status, stand }
    this.stand = null; // letzter Spielstand des aktiven Spiels
    this.log = [];
    this.dedupe = new Dedupe();
    this.router = new Router();
    this.zaehler = { ereignisse: 0, verworfen: 0, gesendet: 0, fehler: 0 };
    this.nr = 0;
  }

  aktiv() { return this.getConfig().aktivesSpiel; }

  pcVerbunden(pcId, { spiel, remote = "", sim = false } = {}) {
    const alt = this.pcs.get(pcId) || {};
    this.pcs.set(pcId, { ...alt, pcId, spiel, remote, sim, verbunden: true, t: this.now() });
    this.emit("status");
  }

  pcGetrennt(pcId) {
    const p = this.pcs.get(pcId);
    if (p) { p.verbunden = false; this.emit("status"); }
  }

  pcEntfernen(pcId) { this.pcs.delete(pcId); this.emit("status"); }

  // Status-Meldung eines Game-PCs (Spieler, Leben, Spielstand)
  pcStatus(pcId, { spiel, status, stand }) {
    const p = this.pcs.get(pcId);
    if (!p) return;
    Object.assign(p, { spiel: spiel || p.spiel, status: status || p.status, t: this.now() });
    if (stand) { p.stand = stand; if (p.spiel === this.aktiv()) this.stand = { ...stand, t: this.now() }; }
    this.emit("status");
  }

  // Ereignis eines Game-PCs. Nur das aktive Spiel erzeugt Cues, alles andere wird verworfen.
  pcEvent(pcId, spiel, ev) {
    const p = this.pcs.get(pcId);
    if (p) p.t = this.now();
    if (spiel !== this.aktiv()) { this.zaehler.verworfen++; this.emit("status"); return null; }
    const e = { ...ev, spiel, pc: pcId, pcId };
    if (!this.dedupe.accept(e, this.now())) return null; // mehrere PCs melden dieselbe Runde
    return this.fire(e, p?.sim ? "sim" : "pc");
  }

  fire(ev, quelle = "pc") {
    const cfg = this.getConfig(), now = this.now();
    this.zaehler.ereignisse++;
    const ergebnisse = this.router.route(cfg, ev, now);
    const eintrag = { id: ++this.nr, t: now, ev, quelle, scharf: !!cfg.armed, sends: ergebnisse.map(kurz) };
    if (cfg.armed) ergebnisse.forEach((s, i) => this.ausgeben(s, eintrag.sends[i]));
    this.log.unshift(eintrag);
    if (this.log.length > LOG_MAX) this.log.length = LOG_MAX;
    this.emit("event", eintrag);
    this.emit("status");
    return eintrag;
  }

  // Einzelne Regel sofort senden (Test-Knopf), unabhängig von „scharf“, Filter und Cooldown
  testeRegel(regelId) {
    const cfg = this.getConfig();
    const r = cfg.rules.find((x) => x.id === regelId);
    if (!r) return null;
    const s = nachricht(cfg, r, { type: r.event, spiel: r.spiel, team: r.team || "CT", player: "Testspieler", pc: "Regie", round: 1, map: "de_test", kills: 1 });
    const k = kurz(s);
    this.ausgeben(s, k);
    return k;
  }

  ausgeben(s, k) {
    if (!s.ziel) return;
    this.zaehler.gesendet++;
    Promise.resolve(this.send(s)).catch((e) => {
      this.zaehler.fehler++;
      k.fehler = e.message;
      this.emit("fehler", `${s.ziel.name}: ${e.message}`);
    });
  }

  snapshot() {
    return { pcs: [...this.pcs.values()], stand: this.stand, zaehler: { ...this.zaehler }, aktivesSpiel: this.aktiv() };
  }
}

const kurz = (s) => (s.ziel ? { regel: s.regel, ziel: s.ziel.name, zielId: s.ziel.id, an: `${s.ziel.host}:${s.ziel.port}`, address: s.address, args: s.args.map((a) => a.value) } : { ...s });

module.exports = { Regie };
