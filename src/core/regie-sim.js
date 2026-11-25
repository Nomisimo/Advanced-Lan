"use strict";
// Simulator in der Regie: virtuelle Game-PCs spielen das aktive Spiel. Jeder hat seine eigene Quelle wie ein echter Game-PC
// und meldet Events und Status an die Regie, als käme es über das Netzwerk.
// CS2 und Dota 2: 10 PCs (5 gegen 5), jeder bekommt seine eigenen GSI-Daten. Rocket League: 6 PCs (3 gegen 3), alle bekommen dieselben Stats-API-Nachrichten.
// Valorant (Bilderkennung): jeder PC bekommt, was sein Bildschirm zeigt, dazu Nachrichten an alle (an = null).
// Sind Game-PCs über die Session verbunden, spielt der Simulator mit genau diesen PCs statt mit virtuellen.

const { SimRunner } = require("./sim-runner");
const { SimMatch } = require("./gsi-sim");
const { RlSimMatch } = require("./rl-sim");
const { DotaSimMatch } = require("./dota-sim");
const { ValSimMatch } = require("./val-sim");
const { CsQuelle } = require("./cs-quelle");
const { RlQuelle } = require("./rl-quelle");
const { DotaQuelle } = require("./dota");
const { BildQuelle } = require("./bild-spiele");
const { QUELLEN, SPIEL_BY_ID } = require("./spiele");

const simId = (i) => `SIM ${String(i + 1).padStart(2, "0")}`;
// RL: alle Spieler des Matches als Namen je Team (Blau, Orange); ohne Spielerliste die Namen des Simulators
const rlNamen = (spieler) => (spieler ? [0, 1].map((t) => spieler.filter((p) => p.team === t).map((p) => p.name)) : undefined);
const SPIELE = {
  cs2: { anzahl: 10, quelle: () => new CsQuelle(), match: (spieler) => new SimMatch({ clients: spieler }) },
  rl: { anzahl: 6, quelle: () => new RlQuelle(), match: (spieler, echt) => new RlSimMatch({ namen: echt ? rlNamen(spieler) : undefined }) },
  dota2: { anzahl: 10, quelle: () => new DotaQuelle(), match: (spieler) => new DotaSimMatch({ clients: spieler }) },
  valorant: { anzahl: 10, quelle: () => new BildQuelle("valorant"), match: (spieler) => new ValSimMatch({ clients: spieler }) },
};

// Session-PCs, die der Simulator spielen lässt: über das Netzwerk verbunden, nicht simuliert, nicht der PC der Regie selbst
const istSessionPc = (p) => p.verbunden && !p.sim && p.remote !== "dieser PC";
const teamNr = (spiel, team) => {
  const i = (SPIEL_BY_ID[spiel]?.teams || []).findIndex((t) => t.toLowerCase() === String(team || "").toLowerCase());
  return i < 0 ? null : i;
};

// Spieler des simulierten Matches aus den Session-PCs: Name = Spielername (sonst PC-ID), Team = zuletzt gemeldetes Team
// in diesem Spiel, sonst ins kleinere Team. Bots füllen beide Teams bis zur Matchgröße auf, damit das Match normal läuft.
// Bots haben keinen PC: Was nur sie sehen, meldet niemand (wie bei Spielern, die nicht in der Session sind).
function sessionSpieler(echte, spiel) {
  const n = [0, 0];
  const spieler = echte.map((p, i) => ({ pcId: p.pcId, token: `sim${i}`, name: p.spieler || p.pcId, team: p.spiel === spiel ? teamNr(spiel, p.status?.team) : null }));
  for (const s of spieler) if (s.team != null) n[s.team]++;
  for (const s of spieler) if (s.team == null) { s.team = n[0] <= n[1] ? 0 : 1; n[s.team]++; }
  const proTeam = Math.max(SPIELE[spiel].anzahl / 2, n[0], n[1]);
  let b = 0;
  for (const t of [0, 1]) while (n[t] < proTeam) { n[t]++; spieler.push({ token: `bot${b}`, name: `Bot ${++b}`, team: t, bot: true }); }
  // Reihenfolge wie die Simulatoren sie erwarten: erst Team 0, dann Team 1 (Dota, Valorant), Teams stehen in team
  return spieler.sort((a, c) => a.team - c.team);
}

// Für welche PCs ist eine Nachricht? GSI: Token in auth, Valorant: an (null = alle), Rocket League: alle
const fuer = (pcs, payload) => {
  const token = payload?.auth?.token ?? payload?.an;
  return token == null ? pcs : pcs.filter((p) => p.token === token);
};

class RegieSim {
  constructor({ regie, onChange }) {
    this.regie = regie;
    this.onChange = onChange || (() => {});
    this.spiel = "cs2";
    this.pcs = []; // { pcId, token, quelle, echt } die PCs, in deren Namen der Simulator meldet
    this.spieler = []; // alle Spieler des Matches, auch Bots
    this.echt = false; // true = Session-PCs, false = virtuelle SIM-PCs
    this.schluessel = "";
    this.sicherung = new Map(); // pcId → { spiel, status, stand } der Session-PCs vor dem Simulator
    this.runner = new SimRunner({
      neuesMatch: () => SPIELE[this.spiel].match(this.spieler, this.echt),
      onChange: () => this.onChange(),
      deliver: (payload) => {
        for (const pc of fuer(this.pcs, payload)) {
          const p = this.regie.pcs.get(pc.pcId);
          if (!p || (pc.echt && !p.verbunden)) continue; // PC hat die Session verlassen
          if (pc.echt && !this.sicherung.has(pc.pcId)) this.sicherung.set(pc.pcId, { spiel: p.spiel, status: p.status, stand: p.stand });
          const r = pc.quelle.ingest(payload, this.regie.now());
          if (r.status || r.stand) this.regie.pcStatus(pc.pcId, { spiel: this.spiel, status: r.status, stand: r.stand });
          for (const ev of r.events) this.regie.pcEvent(pc.pcId, this.spiel, ev, { sim: true });
        }
      },
    });
  }

  // Unterstützt der Simulator dieses Spiel?
  static kann(spiel) { return !!SPIELE[spiel]; }

  // Session-PCs verbunden: der Simulator spielt das Match mit ihnen (ihre PC-IDs, Plätze, Spielernamen und Teams).
  // Sonst virtuelle PCs „SIM 01“ … wie bisher.
  start(modus, spiel = this.spiel) {
    if (!SPIELE[spiel]) return;
    const echte = [...this.regie.pcs.values()].filter(istSessionPc).sort((a, b) => a.pcId.localeCompare(b.pcId, undefined, { numeric: true }));
    const schluessel = `${spiel}|${echte.map((p) => p.pcId).join("|")}`;
    if (schluessel !== this.schluessel || !this.pcs.length) {
      this.neu();
      this.spiel = spiel;
      this.schluessel = schluessel;
      this.echt = echte.length > 0;
      if (this.echt) {
        this.spieler = sessionSpieler(echte, spiel);
        this.pcs = this.spieler.filter((s) => !s.bot).map((s) => ({ pcId: s.pcId, token: s.token, quelle: SPIELE[spiel].quelle(), echt: true }));
      } else {
        this.pcs = Array.from({ length: SPIELE[spiel].anzahl }, (_, i) => ({ pcId: simId(i), token: `sim${i}`, quelle: SPIELE[spiel].quelle() }));
        this.spieler = this.pcs.map((p) => ({ token: p.token }));
      }
    }
    if (!this.echt) for (const p of this.pcs) this.regie.pcVerbunden(p.pcId, { spiele: QUELLEN, remote: "Simulator", sim: true });
    this.runner.start(modus);
  }
  stop() { this.runner.stop(); }
  // Neues Match: simulierte PCs verschwinden aus der Liste, Session-PCs bekommen ihren eigenen Stand zurück
  neu() { this.runner.neu(); this.abmelden(); this.pcs = []; this.spieler = []; this.schluessel = ""; }
  abmelden() {
    for (const p of this.pcs) if (!p.echt) this.regie.pcEntfernen(p.pcId);
    if (!this.sicherung.size) return;
    for (const [pcId, alt] of this.sicherung) { const p = this.regie.pcs.get(pcId); if (p) Object.assign(p, alt); }
    this.sicherung.clear();
    this.regie.matchAktualisieren();
    this.regie.emit("status");
  }
  status() {
    const teams = SPIEL_BY_ID[this.spiel]?.teams || [];
    const pcs = this.echt ? this.spieler.filter((s) => !s.bot).map((s) => ({ pcId: s.pcId, name: s.name, team: teams[s.team] || "" })) : [];
    return { ...this.runner.status(), spiel: this.spiel, echt: this.echt, pcs };
  }
}

module.exports = { RegieSim, SIM_SPIELE: SPIELE, fuer };
