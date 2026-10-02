"use strict";
// Game-PC: macht aus den GSI-Nachrichten des lokalen CS2 Ereignisse und einen kurzen Status für die Regie.
const { detectEvents, Dedupe } = require("./events");

class CsQuelle {
  constructor() {
    this.prev = null;
    this.dedupe = new Dedupe();
  }
  ingest(body, now = Date.now()) {
    const events = detectEvents(this.prev, body).filter((e) => this.dedupe.accept(e, now));
    this.prev = body;
    return { events, status: spielerStatus(body), stand: spielStand(body) };
  }
}

function spielerStatus(b) {
  const p = b.player || {}, st = p.state || {}, ms = p.match_stats || {};
  const eigen = !!(p.steamid && b.provider && p.steamid === b.provider.steamid);
  if (!eigen) return { spieler: "", team: "", zuschauer: p.name || "", health: null, armor: null, roundKills: 0, kills: 0, deaths: 0, observer: !!b.allplayers };
  return { spieler: p.name || "", team: p.team || "", zuschauer: "", health: st.health ?? null, armor: st.armor ?? null, roundKills: st.round_kills ?? 0, kills: ms.kills ?? 0, deaths: ms.deaths ?? 0, observer: !!b.allplayers };
}

function spielStand(b) {
  if (!b.map) return null;
  const m = b.map, r = b.round || {};
  return { map: m.name || "", phase: m.phase || "", runde: m.round ?? 0, ct: m.team_ct?.score ?? 0, tt: m.team_t?.score ?? 0, rundenPhase: r.phase || "", bombe: r.bomb || "", sieger: r.win_team || "" };
}

module.exports = { CsQuelle, spielerStatus, spielStand };
