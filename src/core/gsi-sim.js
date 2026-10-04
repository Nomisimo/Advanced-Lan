"use strict";
// Simuliert ein CS2-Match: erzeugt GSI-Nachrichten, wie sie 10 Spieler-PCs (5 CT, 5 T) schicken würden.
// Die Nachrichten laufen durch dieselbe Pipeline wie echte Daten.

function zufall(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMEN = ["Blitz", "Nova", "Raptor", "Echo", "Viper", "Ghost", "Tank", "Pixel", "Frost", "Zero"];
const SIEG = 13; // MR12

class SimMatch {
  constructor({ clients, seed = Date.now(), map = "de_mirage" }) {
    this.rnd = zufall(seed);
    this.map = map;
    this.phase = "warmup";
    this.runde = 0;
    this.score = { CT: 0, T: 0 };
    this.rundenPhase = "freezetime";
    this.bombe = undefined;
    this.sieger = undefined;
    this.spieler = clients.map((c, i) => ({
      token: c.token, steamid: `765611980000000${String(i).padStart(2, "0")}`, name: NAMEN[i % NAMEN.length],
      team: i % 2 ? "T" : "CT", health: 100, flashed: 0, roundKills: 0, roundHs: 0, kills: 0, deaths: 0, mvps: 0,
    }));
  }

  payload(p, t) {
    return {
      provider: { name: "Counter-Strike 2", appid: 730, version: 14000, steamid: p.steamid, timestamp: Math.floor(t / 1000) },
      map: { mode: "competitive", name: this.map, phase: this.phase, round: this.runde, team_ct: { score: this.score.CT }, team_t: { score: this.score.T } },
      round: { phase: this.rundenPhase, ...(this.bombe ? { bomb: this.bombe } : {}), ...(this.sieger ? { win_team: this.sieger } : {}) },
      player: {
        steamid: p.steamid, name: p.name, team: p.team, activity: "playing",
        state: { health: p.health, armor: p.health ? 100 : 0, helmet: true, flashed: p.flashed, smoked: 0, burning: 0, money: 2400, round_kills: p.roundKills, round_killhs: p.roundHs, equip_value: 4700 },
        match_stats: { kills: p.kills, assists: 0, deaths: p.deaths, mvps: p.mvps, score: p.kills * 2 },
      },
      auth: { token: p.token },
    };
  }

  // Momentaufnahme aller Clients
  bild(t) { return this.spieler.map((p) => this.payload(p, t)); }

  vorbei() { return this.phase === "gameover"; }
  anzeige() { return { teams: [["CT", this.score.CT], ["T", this.score.T]], einheit: "Runden" }; }

  // Schritte einer Runde: [{ dt, payloads }], dt = Abstand zum vorigen Schritt in ms
  naechsteRunde() {
    const schritte = [];
    const schritt = (dt) => schritte.push({ dt, payloads: this.bild(Date.now()) });
    const r = this.rnd;
    const lebend = (team) => this.spieler.filter((p) => p.team === team && p.health > 0);

    if (this.phase === "warmup") { schritt(0); this.phase = "live"; }
    if (this.vorbei()) return schritte;
    this.rundenPhase = "freezetime"; this.bombe = undefined; this.sieger = undefined;
    for (const p of this.spieler) Object.assign(p, { health: 100, roundKills: 0, roundHs: 0, flashed: 0 });
    schritt(schritte.length ? 400 : 0);
    this.rundenPhase = "live";
    schritt(1500);

    const ausgang = ["elim_ct", "elim_t", "explode", "defuse"][Math.floor(r() * 4)];
    const favorit = ausgang === "elim_t" || ausgang === "defuse" ? "CT" : "T";
    let geplant = false, n = 0;
    while (lebend("CT").length && lebend("T").length) {
      n++;
      if (r() < 0.12) { const x = lebend(r() < 0.5 ? "CT" : "T")[0]; if (x) { x.flashed = 255; schritt(500); x.flashed = 0; } }
      const killerTeam = r() < 0.7 ? favorit : favorit === "CT" ? "T" : "CT";
      const killer = lebend(killerTeam), opfer = lebend(killerTeam === "CT" ? "T" : "CT");
      // Bei Bomben-Ausgang überlebt immer mindestens ein Spieler pro Team bis zum Schluss
      if (ausgang === "explode" || ausgang === "defuse") { if (opfer.length <= 1 || killer.length <= 1) break; }
      const k = killer[Math.floor(r() * killer.length)], o = opfer[Math.floor(r() * opfer.length)];
      k.roundKills++; k.kills++;
      if (r() < 0.45) k.roundHs++;
      o.health = 0; o.deaths++;
      schritt(900 + Math.floor(r() * 1400));
      if (!geplant && n >= 2 && (ausgang === "explode" || ausgang === "defuse")) { geplant = true; this.bombe = "planted"; schritt(1200); }
    }
    if (ausgang === "explode" || ausgang === "defuse") {
      if (!geplant) { this.bombe = "planted"; schritt(1200); }
      this.bombe = ausgang === "explode" ? "exploded" : "defused";
      this.sieger = ausgang === "explode" ? "T" : "CT";
    } else {
      this.sieger = lebend("CT").length ? "CT" : "T";
    }
    this.rundenPhase = "over";
    this.score[this.sieger]++;
    this.runde++;
    const mvp = this.spieler.filter((p) => p.team === this.sieger).sort((a, b) => b.roundKills - a.roundKills)[0];
    if (mvp) mvp.mvps++;
    schritt(1600);
    if (this.score.CT >= SIEG || this.score.T >= SIEG) { this.phase = "gameover"; schritt(3000); }
    return schritte;
  }
}

module.exports = { SimMatch, zufall };
