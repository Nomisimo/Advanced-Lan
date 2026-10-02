"use strict";
// Simulator in der Regie: virtuelle Game-PCs spielen das aktive Spiel. Jeder hat seine eigene Quelle wie ein echter Game-PC
// und meldet Events und Status an die Regie, als käme es über das Netzwerk.
// CS2: 10 PCs (5 gegen 5), jeder bekommt seine eigenen GSI-Daten. Rocket League: 6 PCs (3 gegen 3), alle bekommen dieselben Stats-API-Nachrichten.

const { SimRunner } = require("./sim-runner");
const { SimMatch } = require("./gsi-sim");
const { RlSimMatch } = require("./rl-sim");
const { CsQuelle } = require("./cs-quelle");
const { RlQuelle } = require("./rl-quelle");

const simId = (i) => `SIM ${String(i + 1).padStart(2, "0")}`;
const SPIELE = {
  cs2: { anzahl: 10, quelle: () => new CsQuelle(), match: (pcs) => new SimMatch({ clients: pcs }) },
  rl: { anzahl: 6, quelle: () => new RlQuelle(), match: () => new RlSimMatch() },
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
        // CS2: Nachricht gehört zu genau einem PC (Token). Rocket League: alle PCs im Match bekommen sie.
        const ziele = this.spiel === "cs2" ? this.pcs.filter((p) => p.token === payload.auth?.token) : this.pcs;
        for (const pc of ziele) {
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
    for (const p of this.pcs) this.regie.pcVerbunden(p.pcId, { spiele: ["cs2", "rl"], remote: "Simulator", sim: true });
    this.runner.start(modus);
  }
  stop() { this.runner.stop(); }
  // Neues Match: simulierte PCs verschwinden aus der Liste
  neu() { this.runner.neu(); this.abmelden(); this.pcs = []; }
  abmelden() { for (const p of this.pcs) this.regie.pcEntfernen(p.pcId); }
  status() { return { ...this.runner.status(), spiel: this.spiel }; }
}

module.exports = { RegieSim };
