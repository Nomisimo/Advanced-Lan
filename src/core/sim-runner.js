"use strict";
// Spielt simulierte Runden in Echtzeit ab. deliver(payload) schickt eine Nachricht an den Empfang.

class SimRunner {
  // neuesMatch(): ein Match mit naechsteRunde(), vorbei() und anzeige() (CS2: SimMatch, Rocket League: RlSimMatch, Dota 2: DotaSimMatch, GEP-Spiele: GepSimMatch)
  constructor({ deliver, neuesMatch, onChange = () => {} }) {
    this.deliver = deliver;
    this.neuesMatch = neuesMatch;
    this.onChange = onChange;
    this.match = null;
    this.timer = null;
    this.modus = null; // "runde" | "match"
  }

  get laeuft() { return !!this.modus; }

  start(modus = "runde") {
    this.stop();
    if (!this.match || this.match.vorbei()) this.match = this.neuesMatch();
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

  status() {
    const m = this.match;
    // anzeige: { teams: [[Team, Punkte], …], text, einheit } für die Simulator-Tabs
    return { laeuft: this.laeuft, modus: this.modus, runde: m?.runde ?? 0, ct: m?.score?.CT ?? 0, t: m?.score?.T ?? 0, blau: m?.blau ?? 0, orange: m?.orange ?? 0, anzeige: m?.anzeige?.() || null };
  }
}

module.exports = { SimRunner };
