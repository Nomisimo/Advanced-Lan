"use strict";
// Simulator in der Regie: 10 virtuelle Game-PCs spielen CS2. Jeder hat seine eigene CsQuelle wie ein echter Game-PC
// und meldet Ereignisse und Status an die Regie, als käme es über das Netzwerk.

const { SimRunner } = require("./sim-runner");
const { CsQuelle } = require("./cs-quelle");

const ANZAHL = 10;
const simId = (i) => `SIM ${String(i + 1).padStart(2, "0")}`;

class RegieSim {
  constructor({ regie, onChange }) {
    this.regie = regie;
    this.pcs = Array.from({ length: ANZAHL }, (_, i) => ({ pcId: simId(i), token: `sim${i}`, quelle: new CsQuelle() }));
    this.runner = new SimRunner({
      getClients: () => this.pcs,
      onChange: () => onChange && onChange(),
      deliver: (payload) => {
        const pc = this.pcs.find((p) => p.token === payload.auth?.token);
        if (!pc) return;
        const r = pc.quelle.ingest(payload, this.regie.now());
        this.regie.pcStatus(pc.pcId, { spiel: "cs2", status: r.status, stand: r.stand });
        for (const ev of r.events) this.regie.pcEvent(pc.pcId, "cs2", ev);
      },
    });
  }

  start(modus) {
    for (const p of this.pcs) this.regie.pcVerbunden(p.pcId, { spiele: ["cs2"], remote: "Simulator", sim: true });
    this.runner.start(modus);
  }
  stop() { this.runner.stop(); }
  // Neues Match: simulierte PCs verschwinden aus der Liste
  neu() { this.runner.neu(); for (const p of this.pcs) p.quelle = new CsQuelle(); this.abmelden(); }
  abmelden() { for (const p of this.pcs) this.regie.pcEntfernen(p.pcId); }
  status() { return this.runner.status(); }
}

module.exports = { RegieSim };
