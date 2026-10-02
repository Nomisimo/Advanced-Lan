"use strict";
// Kleine Spielstatistik der Regie: aktuelle Runde und laufendes Match, gebaut aus den (entdoppelten) Ereignissen des aktiven Spiels.

const neueRunde = (nr) => ({ nr: nr ?? null, phase: "", kills: 0, headshots: 0, tode: 0, bombe: "", sieger: "", mvp: "", vorbei: false });
const neuesMatch = () => ({ runden: 0, kills: 0, headshots: 0, tode: 0, multikills: 0, aces: 0, bomben: 0, siege: { CT: 0, T: 0 }, vorbei: false, sieger: "",
  // Rocket League
  tore: { BLUE: 0, ORANGE: 0 }, schuesse: 0, paraden: 0, demos: 0, anstoesse: 0, overtime: false, letztesTor: null });

class Statistik {
  constructor() { this.reset(""); }

  reset(spiel) {
    this.spiel = spiel;
    this.runde = neueRunde(null);
    this.letzteRunde = null;
    this.match = neuesMatch();
    this.spieler = new Map(); // Name → { name, team, kills, tode, headshots, mvps }
    this.rundenKills = new Map(); // Spieler:Runde → bisher gezählte Kills (Kill-Ereignisse tragen die Kills der Runde)
  }

  sp(ev) {
    const name = ev.player || ev.pc || "?";
    if (!this.spieler.has(name)) this.spieler.set(name, { name, team: "", kills: 0, tode: 0, headshots: 0, mvps: 0, tore: 0, vorlagen: 0, paraden: 0, schuesse: 0, demos: 0 });
    const s = this.spieler.get(name);
    if (ev.team) s.team = ev.team;
    return s;
  }

  add(ev) {
    if (ev.spiel !== this.spiel || ev.type === "match_live" || (ev.spiel === "rl" && ev.type === "match_start")) this.reset(ev.spiel);
    const r = this.runde, m = this.match;
    if (ev.spiel === "rl") return this.addRl(ev, m);
    switch (ev.type) {
      case "freezetime":
      case "round_live": {
        const neu = r.vorbei || (ev.round != null && r.nr != null && ev.round !== r.nr);
        if (neu) { this.letzteRunde = r; this.runde = neueRunde(ev.round); }
        else if (r.nr == null) r.nr = ev.round ?? null;
        this.runde.phase = ev.type === "freezetime" ? "freezetime" : "live";
        break;
      }
      case "round_end":
        if (r.vorbei) break;
        Object.assign(r, { vorbei: true, phase: "over", sieger: ev.team || "" });
        m.runden++;
        if (m.siege[ev.team] != null) m.siege[ev.team]++;
        break;
      case "bomb_planted": case "bomb_defused": case "bomb_exploded":
        r.bombe = ev.type.slice(5);
        if (ev.type === "bomb_planted") m.bomben++;
        break;
      case "kill": {
        const key = `${ev.player}:${ev.round ?? r.nr}`;
        const n = Number(ev.kills) || 0, vorher = this.rundenKills.get(key) || 0;
        const delta = n > vorher ? n - vorher : 1;
        this.rundenKills.set(key, Math.max(n, vorher + delta));
        r.kills += delta; m.kills += delta; this.sp(ev).kills += delta;
        break;
      }
      case "headshot": r.headshots++; m.headshots++; this.sp(ev).headshots++; break;
      case "death": r.tode++; m.tode++; this.sp(ev).tode++; break;
      case "multikill_3": case "multikill_4": m.multikills++; break;
      case "ace": m.aces++; break;
      case "mvp": r.mvp = ev.player || ""; this.sp(ev).mvps++; break;
      case "match_end": m.vorbei = true; m.sieger = ev.team || ""; break;
    }
  }

  addRl(ev, m) {
    switch (ev.type) {
      case "kickoff": m.anstoesse++; break;
      case "overtime": m.overtime = true; break;
      case "goal": if (m.tore[ev.team] != null) m.tore[ev.team]++; this.sp(ev).tore++; m.letztesTor = { spieler: ev.player || "", team: ev.team || "", speed: ev.speed || 0 }; break;
      case "assist": this.sp(ev).vorlagen++; break;
      case "shot": m.schuesse++; this.sp(ev).schuesse++; break;
      case "save": case "epic_save": m.paraden++; this.sp(ev).paraden++; break;
      case "demolition": m.demos++; this.sp(ev).demos++; break;
      case "mvp": this.sp(ev).mvps++; break;
      case "match_end": m.vorbei = true; m.sieger = ev.team || ""; break;
    }
  }

  json() {
    const wert = this.spiel === "rl" ? (p) => p.tore * 100 + p.vorlagen * 50 + p.paraden * 50 + p.schuesse * 20 + p.demos * 10 : (p) => p.kills * 1000 - p.tode;
    const top = [...this.spieler.values()].sort((a, b) => wert(b) - wert(a) || a.name.localeCompare(b.name)).slice(0, this.spiel === "rl" ? 6 : 5);
    return { spiel: this.spiel, runde: { ...this.runde }, letzteRunde: this.letzteRunde && { ...this.letzteRunde }, match: { ...this.match, siege: { ...this.match.siege }, tore: { ...this.match.tore } }, top };
  }
}

module.exports = { Statistik };
