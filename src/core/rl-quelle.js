"use strict";
// Game-PC: macht aus den Nachrichten der Rocket-League-Stats-API Events und einen kurzen Stand für die Regie.
const { Dedupe } = require("./events");
const { detectRlEvents, spielStandRl, daten } = require("./rl-events");

class RlQuelle {
  constructor() {
    this.prev = null;
    this.stand = null;
    this.dedupe = new Dedupe();
  }
  ingest(m, now = Date.now()) {
    if (!m || typeof m.Event !== "string") return { events: [], status: null, stand: this.stand };
    const events = detectRlEvents(m, this.prev).filter((e) => this.dedupe.accept(e, now));
    if (m.Event === "UpdateState") { const d = daten(m); this.prev = d; this.stand = spielStandRl(d); }
    if (m.Event === "MatchDestroyed") { this.prev = null; this.stand = null; }
    return { events, status: { spieler: "", team: "", spielerImMatch: this.stand?.spieler ?? 0 }, stand: this.stand };
  }
}

module.exports = { RlQuelle };
