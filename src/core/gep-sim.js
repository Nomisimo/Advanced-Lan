"use strict";
// Simuliert Matches der Overwolf-Spiele (GEP). Erzeugt GEP-Nachrichten { gep, an, art, feature, key, value }, wie sie
// die App auf jedem Game-PC bekommt: an = Token des PCs (nur dieser PC), null = alle PCs im Match.
// Sie laufen durch dieselbe Erkennung (GepQuelle) wie echte Daten.

const { zufall } = require("./gsi-sim");
const { GEP_BY_ID } = require("./gep-spiele");

const NAMEN = ["Momo", "Kira", "Jax", "Nova", "Pixel", "Rex", "Vex", "Zed", "Echo", "Frost", "Blitz", "Ghost"];
const BOTS = ["Raven", "Lynx", "Orca", "Mamba", "Falke", "Puma", "Kobra", "Wolf", "Bär", "Hai"];
const pad = (i) => String(i).padStart(2, "0");

const nachricht = (an, art, feature, key, value = null) => ({ gep: true, an, art, feature, key, value });
const E = (an, feature, key, value) => nachricht(an, "event", feature, key, value);
const I = (an, feature, key, value) => nachricht(an, "info", feature, key, typeof value === "object" && value ? JSON.stringify(value) : value);

// Spielnamen der GEP-Schlüssel je Spiel
const K = {
  ow2: {
    start: (a) => E(a, "match_info", "match_start"), ende: (a) => E(a, "match_info", "match_end"),
    rStart: (a) => E(a, "match_info", "round_start"), rEnde: (a) => E(a, "match_info", "round_end"),
    kill: (p) => E(p.token, "kill", "elimination", String(p.kills)), death: (p) => E(p.token, "death", "death", String(p.deaths)),
    assist: (p) => E(p.token, "assist", "assist", String(p.assists)), respawn: (p) => E(p.token, "match_info", "respawn"),
    ich: (p, i) => [I(p.token, "game_info", "battle_tag", `${p.name}#${1000 + i}`), I(p.token, "roster", `roster_${pad(i)}`, { player_name: p.name, is_local: true, team: p.team, kills: 0, deaths: 0, is_teammate: true })],
    id: (m) => I(null, "match_info", "match_id", m), ergebnis: (p, sieg) => I(p.token, "match_info", "match_outcome", sieg ? "victory" : "defeat"),
  },
  mr: {
    start: (a) => E(a, "match_info", "match_start"), ende: (a) => E(a, "match_info", "match_end"),
    rStart: (a) => E(a, "match_info", "round_start"), rEnde: (a) => E(a, "match_info", "round_end"),
    kill: (p) => E(p.token, "match_info", "kill", p.kills), death: (p) => E(p.token, "match_info", "death", p.deaths),
    assist: (p) => E(p.token, "match_info", "assist", p.assists),
    ich: (p, i) => [I(p.token, "game_info", "player_name", p.name), I(p.token, "match_info", `roster_${i}`, { uid: String(1000 + i), name: p.name, team: p.team, is_local: true, is_teammate: true, kills: 0, deaths: 0 })],
    id: (m) => I(null, "match_info", "match_id", m), ergebnis: (p, sieg) => I(p.token, "match_info", "match_outcome", sieg ? "Victory" : "Defeat"),
  },
  fn: {
    start: (a) => E(a, "match", "matchStart"), ende: (a) => E(a, "match", "matchEnd"),
    kill: (p) => E(p.token, "kill", "kill", p.kills), knock: (p, opfer) => E(p.token, "kill", "knockout", opfer),
    knocked: (p, wer) => E(p.token, "death", "knockedout", wer), death: (p, wer) => E(p.token, "killer", "killer", wer),
    ich: (p) => [I(p.token, "me", "name", p.name)], id: (m) => I(null, "match_info", "matchID", m),
    uebrig: (n) => I(null, "rank", "total_players", String(n)), platz: (p, n) => I(p.token, "rank", "rank", String(n)),
  },
  apex: {
    start: (a) => E(a, "match_state", "match_start"), ende: (a) => E(a, "match_state", "match_end"),
    kill: (p) => E(p.token, "kill", "kill", p.kills), knock: (p) => E(p.token, "kill", "knockdown"), assist: (p) => E(p.token, "kill", "assist", p.assists),
    knocked: (p) => E(p.token, "death", "knocked_out"), death: (p) => E(p.token, "death", "death"),
    ich: (p) => [I(p.token, "me", "name", p.name)], id: (m) => I(null, "match_info", "pseudo_match_id", m),
    uebrig: (n, teams) => I(null, "match_info", "tabs", { players: n, teams, kills: 0, assists: 0, damage: 0 }),
    platz: (p, n) => n === 1 ? I(p.token, "rank", "victory", "true") : I(p.token, "match_summary", "match_summary", { rank: String(n), teams: "20", squadKills: "0" }),
    raus: (p) => I(p.token, "team", "team_info", { team_state: "eliminated" }),
  },
  pubg: {
    start: (a) => E(a, "match", "matchStart"), ende: (a) => E(a, "match", "matchEnd"),
    kill: (p) => E(p.token, "kill", "kill", p.kills), headshot: (p) => E(p.token, "kill", "headshot"),
    death: (p, wer) => [E(p.token, "death", "death"), E(p.token, "killer", "killer", wer)],
    ich: (p) => [I(p.token, "me", "name", p.name)], id: (m) => I(null, "match", "match_id", m),
    uebrig: (n) => I(null, "rank", "total", String(n)), platz: (p, n) => I(p.token, "rank", "me", String(n)),
  },
  r6: {
    start: (a) => E(a, "match_info", "match_start"), ende: (a) => E(a, "match_info", "match_end"),
    rStart: (a) => E(a, "match", "roundStart"), rEnde: (a) => E(a, "match", "roundEnd"),
    kill: (p) => E(p.token, "kill", "kill"), headshot: (p) => E(p.token, "kill", "headshot"),
    knocked: (p) => E(p.token, "death", "knockedout"), death: (p) => E(p.token, "death", "death"),
    ich: (p, i, rolle) => [I(p.token, "me", "name", p.name), I(p.token, "roster", `roster_${pad(i)}`, { player: p.name, is_anonymous: false, suffix: 0, is_local: true, team: "Blue", role: rolle, operator: "SENTRY", kills: p.kills, deaths: p.deaths })],
    id: (m) => I(null, "match_info", "match_id", m),
  },
};

class GepSimMatch {
  constructor({ spiel, clients, seed = Date.now() }) {
    this.spiel = spiel;
    this.def = GEP_BY_ID[spiel];
    this.k = K[spiel];
    this.rnd = zufall(seed);
    this.matchId = `SIM-${(seed >>> 0).toString(16).toUpperCase()}`;
    this.runde = 0;
    this.score = [0, 0];
    this.ende = false;
    this.gestartet = false;
    const squad = this.def.squad || 1;
    this.spieler = clients.map((c, i) => ({ token: c.token, name: NAMEN[i % NAMEN.length], team: this.def.art === "br" ? Math.floor(i / squad) : i % 2, kills: 0, deaths: 0, assists: 0, lebt: true, nieder: false }));
    this.uebrig = this.def.lobby || 0;
  }

  vorbei() { return this.ende; }
  ziehe(l) { return l[Math.floor(this.rnd() * l.length)]; }
  team(t) { return this.spieler.filter((p) => p.team === t); }
  // Rainbow Six: Team 1 greift in den ersten drei Runden an, danach wird getauscht
  rolle(p) { const angriff = (this.runde <= 3 ? 0 : 1) === p.team; return angriff ? "attacker" : "defender"; }
  anzeige() {
    if (this.def.art === "br") return { text: this.gestartet ? `Zone ${this.runde} · ${this.uebrig} Spieler übrig` : "noch nicht gestartet", einheit: "Zonen" };
    return { teams: [["TEAM 1", this.score[0]], ["TEAM 2", this.score[1]]], einheit: "Runden", text: this.spiel === "r6" && this.runde ? `Team 1 ${this.runde <= 3 ? "greift an" : "verteidigt"}` : "" };
  }

  naechsteRunde() {
    const s = [];
    const schritt = (dt, ...p) => s.push({ dt, payloads: p.flat(4).filter(Boolean) });
    if (!this.gestartet) {
      this.gestartet = true;
      const rolle = (p) => this.spiel === "r6" ? [this.rolle({ ...p })] : [];
      this.runde = this.spiel === "r6" ? 1 : 0;
      schritt(600, this.k.id(this.matchId), this.spieler.map((p, i) => this.k.ich(p, i, ...rolle(p))), this.k.start(null));
      if (this.def.art === "br") schritt(800, this.k.uebrig?.(this.uebrig, Math.ceil(this.uebrig / (this.def.squad || 1))));
      this.runde = 0;
      if (this.def.art === "br") return s;
    }
    if (this.def.art === "br") this.zone(schritt);
    else if (this.spiel === "r6") this.r6Runde(schritt);
    else this.teamRunde(schritt);
    return s;
  }

  // Overwatch 2, Marvel Rivals: Runde mit Kämpfen, wer zuerst 2 Runden gewinnt
  teamRunde(schritt) {
    this.runde++;
    schritt(2500, this.k.rStart(null));
    const kaempfe = 4 + Math.floor(this.rnd() * 4);
    for (let i = 0; i < kaempfe; i++) {
      const t = this.rnd() < 0.5 ? 0 : 1, a = this.ziehe(this.team(t)), b = this.ziehe(this.team(1 - t));
      a.kills++; b.deaths++;
      const out = [this.k.kill(a), this.k.death(b)];
      if (this.rnd() < 0.6) { const h = this.ziehe(this.team(t).filter((p) => p !== a)); h.assists++; out.push(this.k.assist(h)); }
      schritt(1100, out);
      if (this.k.respawn) schritt(400, this.k.respawn(b));
    }
    const sieger = this.rnd() < 0.5 ? 0 : 1;
    this.score[sieger]++;
    schritt(1200, this.k.rEnde(null));
    if (this.score[sieger] >= 2) {
      this.ende = true;
      schritt(1500, this.k.ende(null), this.spieler.map((p) => this.k.ergebnis(p, p.team === sieger)));
    }
  }

  // Rainbow Six Siege: Angriff gegen Verteidigung, wer zuerst 4 Runden gewinnt
  r6Runde(schritt) {
    this.runde++;
    for (const p of this.spieler) { p.lebt = true; }
    schritt(4000, I(null, "match", "number", String(this.runde)), this.spieler.map((p, i) => this.k.ich(p, i, this.rolle(p))), this.k.rStart(null));
    const sieger = this.rnd() < 0.5 ? 0 : 1, verlierer = 1 - sieger;
    const angreifer = this.spieler.find((p) => this.rolle(p) === "attacker").team;
    // Bombe: Angreifer gewinnen oft durch Legen, Verteidiger entschärfen manchmal
    const legen = angreifer === sieger ? this.rnd() < 0.5 : this.rnd() < 0.3;
    let grund = "team_has_been_eliminated";
    const toteVerlierer = legen && angreifer === sieger ? 2 + Math.floor(this.rnd() * 3) : 5;
    for (let i = 0; i < toteVerlierer; i++) {
      const lebend = this.team(verlierer).filter((p) => p.lebt);
      if (!lebend.length) break;
      const b = this.ziehe(lebend), a = this.ziehe(this.team(sieger));
      a.kills++; b.deaths++; b.lebt = false;
      const out = [this.k.kill(a)];
      if (this.rnd() < 0.4) out.push(this.k.headshot(a));
      if (this.rnd() < 0.25) out.push(this.k.knocked(b));
      out.push(this.k.death(b));
      schritt(1000, out);
      if (i === 1 && legen) {
        schritt(900, E(null, "defuser", "defuser_planted"));
        if (angreifer !== sieger) { schritt(1500, E(null, "defuser", "defuser_disabled")); grund = "bomb_deactivated"; }
        else grund = "bomb_detonated";
      }
    }
    this.score[sieger]++;
    schritt(1200, I(null, "match_info", "round_outcome_type", grund),
      this.spieler.map((p) => [E(p.token, "match", "roundOutcome", p.team === sieger ? "victory" : "defeat"), I(p.token, "match", "score", { blue: String(this.score[p.team]), orange: String(this.score[1 - p.team]) })]),
      this.k.rEnde(null));
    if (this.score[sieger] >= 4) {
      this.ende = true;
      schritt(1500, this.spieler.map((p) => E(p.token, "match", "matchOutcome", p.team === sieger ? "victory" : "defeat")), this.k.ende(null));
    }
  }

  // Battle Royale: eine Zone, die LAN-Spieler holen Kills gegen andere, manche fallen raus
  zone(schritt) {
    this.runde++;
    const squads = [...new Set(this.spieler.map((p) => p.team))];
    const lebendeSquads = () => squads.filter((t) => this.team(t).some((p) => p.lebt));
    const aktionen = 3 + Math.floor(this.rnd() * 4);
    for (let i = 0; i < aktionen; i++) {
      const lebend = this.spieler.filter((p) => p.lebt);
      const a = this.ziehe(lebend), opfer = this.ziehe(BOTS);
      if (this.rnd() < 0.75 || lebendeSquads().length < 2) {
        // LAN-Spieler schaltet einen Gegner aus
        a.kills++;
        const out = [];
        if (this.k.knock) out.push(this.k.knock(a, opfer));
        out.push(this.k.kill(a));
        if (this.k.headshot && this.rnd() < 0.35) out.push(this.k.headshot(a));
        if (this.k.assist && this.rnd() < 0.5) { const h = this.team(a.team).find((p) => p !== a && p.lebt); if (h) { h.assists++; out.push(this.k.assist(h)); } }
        this.uebrig = Math.max(this.spieler.filter((p) => p.lebt).length + 1, this.uebrig - 1);
        schritt(1100, out);
      } else {
        // LAN-Spieler wird erwischt (nie das letzte lebende Squad)
        const sq = this.team(a.team).filter((p) => p.lebt);
        if (lebendeSquads().length === 1 && sq.length === 1) continue;
        a.deaths++;
        const out = [];
        if (this.k.knocked && this.def.squad > 1) out.push(this.k.knocked(a, opfer));
        schritt(900, out);
        a.lebt = false;
        this.uebrig = Math.max(1, this.uebrig - 1);
        schritt(1100, this.k.death(a, opfer));
        if (this.k.raus && !this.team(a.team).some((p) => p.lebt)) schritt(600, this.team(a.team).map((p) => this.k.raus(p)));
        if (!this.team(a.team).some((p) => p.lebt)) for (const p of this.team(a.team)) schritt(200, this.k.platz(p, Math.max(2, this.uebrig)));
      }
    }
    // Die Zone zieht sich zu: viele andere scheiden aus
    this.uebrig = Math.max(this.spieler.filter((p) => p.lebt).length, Math.floor(this.uebrig * (0.45 + this.rnd() * 0.2)));
    schritt(1000, this.k.uebrig(this.uebrig, Math.max(1, Math.ceil(this.uebrig / (this.def.squad || 1)))));
    if (this.runde >= 5 || this.uebrig <= (this.def.squad || 1) * 2) {
      // Finale: ein LAN-Squad gewinnt, das andere wird Zweiter
      const sieger = this.ziehe(lebendeSquads());
      for (const p of this.spieler.filter((x) => x.lebt && x.team !== sieger)) { p.lebt = false; p.deaths++; schritt(800, this.k.death(p, this.ziehe(this.team(sieger)).name)); }
      for (const t of lebendeSquads().filter((t) => t !== sieger)) if (this.k.raus) schritt(400, this.team(t).map((p) => this.k.raus(p)));
      this.uebrig = this.team(sieger).filter((p) => p.lebt).length;
      schritt(1500, this.k.uebrig(this.uebrig, 1), this.team(sieger).map((p) => this.k.platz(p, 1)));
      schritt(1500, this.spieler.filter((p) => p.team !== sieger && p.deaths === 0).map((p) => this.k.platz(p, 2)), this.k.ende(null));
      this.ende = true;
    }
  }
}

module.exports = { GepSimMatch };
