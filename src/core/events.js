"use strict";
// Erkennt Spielereignisse aus zwei aufeinanderfolgenden CS2-GSI-Zuständen (Valve Game State Integration).
// Reine Funktionen ohne Node-Abhängigkeiten: laufen im Hauptprozess und in der Browser-Vorschau.

// fest: Team, das dieses Event immer hat (Bombe legen immer T); der Simulator setzt es beim Auslösen
const EVENT_TYPES = [
  { id: "match_live", label: "Match startet", gruppe: "Match" },
  { id: "match_end", label: "Match vorbei", gruppe: "Match", team: true },
  { id: "freezetime", label: "Freezetime (Kaufphase)", gruppe: "Runde" },
  { id: "round_live", label: "Runde läuft", gruppe: "Runde" },
  { id: "round_end", label: "Runde gewonnen", gruppe: "Runde", team: true },
  { id: "bomb_planted", label: "Bombe gelegt", gruppe: "Bombe", fest: "T" },
  { id: "bomb_defused", label: "Bombe entschärft", gruppe: "Bombe", fest: "CT" },
  { id: "bomb_exploded", label: "Bombe explodiert", gruppe: "Bombe", fest: "T" },
  { id: "kill", label: "Kill", gruppe: "Spieler", team: true, spieler: true },
  { id: "headshot", label: "Headshot", gruppe: "Spieler", team: true, spieler: true },
  { id: "multikill_3", label: "3 Kills in einer Runde", gruppe: "Spieler", team: true, spieler: true },
  { id: "multikill_4", label: "4 Kills in einer Runde", gruppe: "Spieler", team: true, spieler: true },
  { id: "ace", label: "Ace (5 Kills)", gruppe: "Spieler", team: true, spieler: true },
  { id: "death", label: "Spieler stirbt", gruppe: "Spieler", team: true, spieler: true },
  { id: "flashed", label: "Spieler geblendet", gruppe: "Spieler", team: true, spieler: true },
  { id: "mvp", label: "Runden-MVP", gruppe: "Spieler", team: true, spieler: true },
];
const EVENT_BY_ID = Object.fromEntries(EVENT_TYPES.map((e) => [e.id, e]));
const BOMBE = { planted: ["bomb_planted", "T"], defused: ["bomb_defused", "CT"], exploded: ["bomb_exploded", "T"] };

// Spieler, deren Werte ein Client verlässlich meldet: alle (Observer/GOTV) oder nur der eigene Spieler.
// Ein toter Spieler schaut einem Mitspieler zu, dann steht dessen Block unter "player" – der zählt nicht.
function spielerListe(s) {
  const out = new Map();
  if (!s) return out;
  if (s.allplayers && typeof s.allplayers === "object") {
    for (const [id, p] of Object.entries(s.allplayers)) if (p && p.state) out.set(id, p);
  } else if (s.player && s.provider && s.player.steamid && s.player.steamid === s.provider.steamid && s.player.state) {
    out.set(s.player.steamid, s.player);
  }
  return out;
}

// Mehrfachkill: nur die höchste neu erreichte Stufe (2 → 4 Kills ergibt multikill_4, nicht auch multikill_3)
const stufe = (n) => (n >= 5 ? "ace" : n === 4 ? "multikill_4" : n === 3 ? "multikill_3" : null);
const zahl = (v) => (typeof v === "number" && isFinite(v) ? v : 0);

function detectEvents(prev, cur) {
  const ev = [];
  if (!prev || !cur) return ev; // ohne Vorgänger keine Übergänge (erster Kontakt eines Clients)
  const pm = prev.map || {}, cm = cur.map || {};
  const ctx = { map: cm.name, round: cm.round, score_ct: cm.team_ct?.score, score_t: cm.team_t?.score };
  const push = (type, extra) => ev.push({ type, ...ctx, ...extra });

  if (pm.phase && cm.phase !== pm.phase) {
    if (cm.phase === "live" && pm.phase === "warmup") push("match_live");
    if (cm.phase === "gameover") {
      const ct = zahl(cm.team_ct?.score), t = zahl(cm.team_t?.score);
      push("match_end", { team: ct > t ? "CT" : t > ct ? "T" : "" });
    }
  }

  const pr = prev.round, cr = cur.round;
  if (pr && cr) {
    if (cr.phase !== pr.phase) {
      if (cr.phase === "freezetime") push("freezetime");
      if (cr.phase === "live") push("round_live");
      if (cr.phase === "over") push("round_end", { team: cr.win_team || "" });
    }
    if (cr.bomb !== pr.bomb && BOMBE[cr.bomb]) push(BOMBE[cr.bomb][0], { team: BOMBE[cr.bomb][1] });
  }

  const vorher = spielerListe(prev);
  for (const [id, p] of spielerListe(cur)) {
    const q = vorher.get(id);
    if (!q) continue;
    const s = p.state, r = q.state;
    const extra = { team: p.team || "", player: p.name || "", steamid: id, kills: zahl(s.round_kills) };
    const rk = zahl(s.round_kills), prk = zahl(r.round_kills);
    if (rk > prk) {
      push("kill", extra);
      if (stufe(rk) && stufe(rk) !== stufe(prk)) push(stufe(rk), extra);
    }
    if (zahl(s.round_killhs) > zahl(r.round_killhs)) push("headshot", extra);
    if (zahl(r.health) > 0 && s.health === 0) push("death", extra);
    if (zahl(r.flashed) < 128 && zahl(s.flashed) >= 200) push("flashed", extra);
    if (zahl(p.match_stats?.mvps) > zahl(q.match_stats?.mvps)) push("mvp", extra);
  }
  return ev;
}

// Mehrere Clients melden dieselbe Runde, dieselbe Bombe, denselben Kill. Jedes Ereignis zählt nur einmal.
class Dedupe {
  constructor({ fensterGlobal = 8000, fensterSpieler = 5000 } = {}) {
    this.fensterGlobal = fensterGlobal;
    this.fensterSpieler = fensterSpieler;
    this.seen = new Map();
  }
  // einmal: eindeutiger Schlüssel eines Ereignisses (z. B. ein bestimmter Turm), das mehrere PCs melden
  key(e) {
    if (e.einmal) return `${e.type}:${e.einmal}`;
    return e.steamid ? `${e.type}:${e.steamid}:${e.round ?? ""}:${e.kills ?? ""}` : `${e.type}:${e.team || ""}`;
  }
  accept(e, now) {
    const k = this.key(e), fenster = e.steamid ? this.fensterSpieler : this.fensterGlobal;
    const t = this.seen.get(k);
    if (t !== undefined && now - t < fenster) return false;
    this.seen.set(k, now);
    if (this.seen.size > 500) for (const [kk, tt] of this.seen) if (now - tt > this.fensterGlobal) this.seen.delete(kk);
    return true;
  }
}

module.exports = { EVENT_TYPES, EVENT_BY_ID, detectEvents, spielerListe, Dedupe };
