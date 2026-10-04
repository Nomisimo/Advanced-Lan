"use strict";
// Simulator in der Regie: virtuelle Game-PCs spielen das aktive Spiel. Jeder hat seine eigene Quelle wie ein echter Game-PC
// und meldet Events und Status an die Regie, als käme es über das Netzwerk.
// CS2 und Dota 2: 10 PCs (5 gegen 5), jeder bekommt seine eigenen GSI-Daten. Rocket League: 6 PCs (3 gegen 3), alle bekommen dieselben Stats-API-Nachrichten.
// Overwolf-Spiele (GEP): jeder PC bekommt, was sein Spieler erlebt, dazu Nachrichten an alle (an = null).

const { SimRunner } = require("./sim-runner");
const { SimMatch } = require("./gsi-sim");
const { RlSimMatch } = require("./rl-sim");
const { DotaSimMatch } = require("./dota-sim");
const { GepSimMatch } = require("./gep-sim");
const { CsQuelle } = require("./cs-quelle");
const { RlQuelle } = require("./rl-quelle");
const { DotaQuelle } = require("./dota");
const { GepQuelle, GEP_SPIELE } = require("./gep-spiele");
const { QUELLEN } = require("./spiele");

const simId = (i) => `SIM ${String(i + 1).padStart(2, "0")}`;
const SPIELE = {
  cs2: { anzahl: 10, quelle: () => new CsQuelle(), match: (pcs) => new SimMatch({ clients: pcs }) },
  rl: { anzahl: 6, quelle: () => new RlQuelle(), match: () => new RlSimMatch() },
  dota2: { anzahl: 10, quelle: () => new DotaQuelle(), match: (pcs) => new DotaSimMatch({ clients: pcs }) },
  ...Object.fromEntries(GEP_SPIELE.map((d) => [d.id, { anzahl: d.spieler, quelle: () => new GepQuelle(d.id), match: (pcs) => new GepSimMatch({ spiel: d.id, clients: pcs }) }])),
};

// Für welche PCs ist eine Nachricht? GSI: Token in auth, GEP: an (null = alle), Rocket League: alle
const fuer = (pcs, payload) => {
  const token = payload?.auth?.token ?? payload?.an;
  return token == null ? pcs : pcs.filter((p) => p.token === token);
};

class RegieSim {
  constructor({ regie, onChange }) {
    this.regie = regie;
    this.onChange = onChange || (() => {});
    this.spiel = "cs2";
    this.pcs = [];
    this.runner = new SimRunner({
      neuesMatch: () => SPIELE[this.spiel].match(this.pcs),
      onChange: () => this.onChange(),
      deliver: (payload) => {
        for (const pc of fuer(this.pcs, payload)) {
          const r = pc.quelle.ingest(payload, this.regie.now());
          if (r.status || r.stand) this.regie.pcStatus(pc.pcId, { spiel: this.spiel, status: r.status, stand: r.stand });
          for (const ev of r.events) this.regie.pcEvent(pc.pcId, this.spiel, ev);
        }
      },
    });
  }

  // Unterstützt der Simulator dieses Spiel?
  static kann(spiel) { return !!SPIELE[spiel]; }

  start(modus, spiel = this.spiel) {
    if (!SPIELE[spiel]) return;
    if (spiel !== this.spiel || !this.pcs.length) { this.neu(); this.spiel = spiel; this.pcs = Array.from({ length: SPIELE[spiel].anzahl }, (_, i) => ({ pcId: simId(i), token: `sim${i}`, quelle: SPIELE[spiel].quelle() })); }
    for (const p of this.pcs) this.regie.pcVerbunden(p.pcId, { spiele: QUELLEN, remote: "Simulator", sim: true });
    this.runner.start(modus);
  }
  stop() { this.runner.stop(); }
  // Neues Match: simulierte PCs verschwinden aus der Liste
  neu() { this.runner.neu(); this.abmelden(); this.pcs = []; }
  abmelden() { for (const p of this.pcs) this.regie.pcEntfernen(p.pcId); }
  status() { return { ...this.runner.status(), spiel: this.spiel }; }
}

module.exports = { RegieSim, SIM_SPIELE: SPIELE, fuer };
