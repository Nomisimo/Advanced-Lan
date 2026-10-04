"use strict";
// Simuliert ein Dota-2-Match (5 gegen 5): erzeugt GSI-Nachrichten, wie sie jeder spielende PC bekommt
// (eigener Spieler, Karte, Uhr, Roshan und die Gebäude des eigenen Teams). Sie laufen durch dieselbe Erkennung wie echte Daten.

const { zufall } = require("./gsi-sim");

const NAMEN = ["Momo", "Kira", "Jax", "Nova", "Pixel", "Rex", "Vex", "Zed", "Echo", "Frost"];
const HELDEN = ["juggernaut", "pudge", "lina", "axe", "crystal_maiden", "invoker", "sniper", "lion", "phantom_assassin", "tiny"];
const SEITE = ["radiant", "dire"];
const TUERME = (s) => {
  const p = s === "radiant" ? "goodguys" : "badguys";
  return ["top", "mid", "bot"].flatMap((l) => [1, 2, 3].map((n) => `dota_${p}_tower${n}_${l}`)).concat(["top", "mid", "bot"].map((l) => `${p}_melee_rax_${l}`), [`dota_${p}_tower4_top`, `dota_${p}_tower4_bot`]);
};
const ABSCHNITT = 300; // Sekunden Spielzeit je Abschnitt (ein Tag oder eine Nacht)

class DotaSimMatch {
  constructor({ clients, seed = Date.now() }) {
    this.rnd = zufall(seed);
    this.matchid = String(7000000000 + Math.floor(this.rnd() * 99999999));
    this.uhr = -90;
    this.zustand = "DOTA_GAMERULES_STATE_HERO_SELECTION";
    this.sieger = "none";
    this.roshan = "alive";
    this.ereignisse = [];
    this.runde = 0; // Abschnitte
    this.gestartet = false;
    this.spieler = clients.map((c, i) => ({ token: c.token, steamid: `7656119800000${String(i).padStart(4, "0")}`, name: NAMEN[i % NAMEN.length], seite: SEITE[i < 5 ? 0 : 1], held: HELDEN[i % HELDEN.length], kills: 0, deaths: 0, assists: 0, streak: 0 }));
    this.gebaeude = { radiant: new Set(TUERME("radiant")), dire: new Set(TUERME("dire")) };
  }

  get kills() { return { radiant: this.spieler.filter((p) => p.seite === "radiant").reduce((n, p) => n + p.kills, 0), dire: this.spieler.filter((p) => p.seite === "dire").reduce((n, p) => n + p.kills, 0) }; }
  vorbei() { return this.sieger !== "none"; }
  anzeige() { const k = this.kills; return { teams: [["RADIANT", k.radiant], ["DIRE", k.dire]], text: `Minute ${Math.max(0, Math.floor(this.uhr / 60))} · Punkte = Kills`, einheit: "Abschnitten" }; }

  payload(p) {
    const tag = this.uhr < 0 || Math.floor(Math.max(0, this.uhr) / ABSCHNITT) % 2 === 0;
    const k = this.kills;
    const bauten = {};
    for (const n of this.gebaeude[p.seite]) bauten[n] = { health: 1500, max_health: 1500 };
    return {
      provider: { name: "Dota 2", appid: 570, version: 47, timestamp: Math.floor(Date.now() / 1000) },
      map: { name: "start", matchid: this.matchid, game_time: this.uhr + 90, clock_time: this.uhr, daytime: tag, nightstalker_night: false, game_state: this.zustand, paused: false, win_team: this.sieger, customgamename: "", radiant_score: k.radiant, dire_score: k.dire, roshan_state: this.roshan, roshan_state_end_seconds: 0 },
      player: { steamid: p.steamid, name: p.name, activity: "playing", kills: p.kills, deaths: p.deaths, assists: p.assists, last_hits: 0, denies: 0, kill_streak: p.streak, team_name: p.seite, gold: 600 },
      hero: { name: `npc_dota_hero_${p.held}`, level: 1 + Math.min(29, Math.floor(Math.max(0, this.uhr) / 90)), alive: true },
      buildings: { [p.seite]: bauten },
      events: this.ereignisse.slice(-10),
      auth: { token: p.token },
    };
  }
  bild() { return this.spieler.map((p) => this.payload(p)); }

  ziehe(l) { return l[Math.floor(this.rnd() * l.length)]; }
  team(s) { return this.spieler.filter((p) => p.seite === s); }

  // Ein Abschnitt: 5 Minuten Spielzeit mit Kämpfen, Türmen und vielleicht Roshan. Schritte: { dt, payloads }
  naechsteRunde() {
    const s = [];
    const schritt = (dt) => s.push({ dt, payloads: this.bild() });
    if (!this.gestartet) {
      this.gestartet = true;
      schritt(500);
      this.zustand = "DOTA_GAMERULES_STATE_STRATEGY_TIME"; schritt(1200);
      this.zustand = "DOTA_GAMERULES_STATE_PRE_GAME"; schritt(1200);
      this.uhr = 0; this.zustand = "DOTA_GAMERULES_STATE_GAME_IN_PROGRESS"; schritt(1500);
      return s;
    }
    this.runde++;
    const ende = this.uhr + ABSCHNITT;
    const kaempfe = 3 + Math.floor(this.rnd() * 4);
    for (let i = 0; i < kaempfe; i++) {
      this.uhr = Math.min(this.uhr + Math.floor((ABSCHNITT - 30) / kaempfe), ende - 20);
      const s1 = this.rnd() < 0.5 ? "radiant" : "dire", s2 = s1 === "radiant" ? "dire" : "radiant";
      const held = this.ziehe(this.team(s1));
      // Teamkampf: ein Held holt 1 bis 3 Kills kurz hintereinander, manchmal mehr
      const n = this.rnd() < 0.6 ? 1 : this.rnd() < 0.7 ? 2 : this.rnd() < 0.8 ? 3 : 5;
      const opfer = [...this.team(s2)].sort(() => this.rnd() - 0.5).slice(0, Math.min(5, n));
      for (const o of opfer) {
        held.kills++; held.streak++; o.deaths++; o.streak = 0;
        const helfer = this.ziehe(this.team(s1).filter((p) => p !== held));
        if (this.rnd() < 0.7) helfer.assists++;
        this.uhr = Math.min(this.uhr + 3, ende - 1);
        schritt(500);
      }
      schritt(700);
      // Turm fällt
      if (this.rnd() < 0.45) {
        const liste = [...this.gebaeude[s2]];
        const t = liste.find((x) => /tower1/.test(x)) || liste.find((x) => /tower2/.test(x)) || liste.find((x) => /tower3|rax/.test(x)) || liste[0];
        if (t) { this.gebaeude[s2].delete(t); schritt(900); }
      }
    }
    // Roshan ab Minute 15
    if (this.uhr >= 900 && this.roshan === "alive" && this.rnd() < 0.6) {
      this.roshan = "respawn_base";
      this.ereignisse.push({ game_time: this.uhr + 90, event_type: "roshan_killed", team: this.rnd() < 0.5 ? "radiant" : "dire" });
      schritt(800);
      this.ereignisse.push({ game_time: this.uhr + 91, event_type: "aegis_picked_up", player_name: this.ziehe(this.spieler).name });
      schritt(800);
    } else if (this.roshan !== "alive" && this.rnd() < 0.5) this.roshan = "alive";
    this.uhr = ende;
    schritt(1000); // Tag/Nacht wechselt
    // Ende: ein Team hat kaum noch Türme oder die Zeit ist um
    const rest = { radiant: this.gebaeude.radiant.size, dire: this.gebaeude.dire.size };
    if (this.uhr >= 2400 || Math.min(rest.radiant, rest.dire) <= 6) {
      const k = this.kills;
      this.sieger = rest.radiant !== rest.dire ? (rest.radiant > rest.dire ? "radiant" : "dire") : k.radiant >= k.dire ? "radiant" : "dire";
      this.uhr += 40;
      schritt(1500);
      this.zustand = "DOTA_GAMERULES_STATE_POST_GAME";
      schritt(1500);
    }
    return s;
  }
}

module.exports = { DotaSimMatch };
