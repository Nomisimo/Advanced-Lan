"use strict";
// Spielt simulierte Runden in Echtzeit ab. deliver(payload) schickt eine Nachricht an den Empfang.

const { SimMatch } = require("./gsi-sim");

class SimRunner {
  constructor({ deliver, getClients, onChange = () => {} }) {
    this.deliver = deliver;
    this.getClients = getClients;
    this.onChange = onChange;
    this.match = null;
    this.timer = null;
    this.modus = null; // "runde" | "match"
  }

  get laeuft() { return !!this.modus; }

  start(modus = "runde") {
    this.stop();
    if (!this.match || this.match.vorbei()) this.match = new SimMatch({ clients: this.getClients() });
    this.modus = modus;
    this.onChange();
    this.spiele(this.match.naechsteRunde());
  }

  neu() { this.stop(); this.match = null; this.onChange(); }

  spiele(schritte) {
    const weiter = () => {
      const s = schritte.shift();
      if (!s) {
        if (this.modus === "match" && !this.match.vorbei()) { this.timer = setTimeout(() => this.spiele(this.match.naechsteRunde()), 1500); return; }
        this.modus = null; this.timer = null; this.onChange(); return;
      }
      this.timer = setTimeout(() => { for (const p of s.payloads) this.deliver(p); weiter(); }, s.dt);
    };
    weiter();
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.modus) { this.modus = null; this.onChange(); }
  }

  status() { return { laeuft: this.laeuft, modus: this.modus, runde: this.match?.runde ?? 0, ct: this.match?.score.CT ?? 0, t: this.match?.score.T ?? 0 }; }
}

module.exports = { SimRunner };
