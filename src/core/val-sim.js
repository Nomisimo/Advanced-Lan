"use strict";
// Simuliert ein Valorant-Match (5 gegen 5) so, wie es die Bilderkennung jedes Game-PCs sähe:
// Nachrichten { bild, an, event, seite, team, name }. an = Token des PCs (nur dieser PC sieht es), null = alle PCs.
// Sie laufen durch dieselbe Quelle (BildQuelle) wie echte Treffer der Bilderkennung.

const { zufall } = require("./gsi-sim");
const { BILD_BY_ID } = require("./bild-spiele");

const VAL_TEAMS = BILD_BY_ID.valorant.teams;
// Was ein PC sieht → Event und Seite, wie es eine Aktion im Editor zuordnet
const SIEHT = {
  kaufphase: ["round_start", "eigen"], runde_sieg: ["round_end", "eigen"], runde_niederlage: ["round_end", "gegner"],
  spike_gelegt: ["spike_planted", "eigen"], spike_entschaerft: ["spike_defused", "eigen"], kill: ["kill", "eigen"], tod: ["death", "eigen"],
  ace: ["ace", "eigen"], clutch: ["clutch", "eigen"], match_sieg: ["match_won", "eigen"], match_niederlage: ["match_won", "gegner"],
};

const NAMEN = ["Momo", "Kira", "Jax", "Nova", "Pixel", "Rex", "Vex", "Zed", "Echo", "Frost"];
const SIEGRUNDEN = 13;

class ValSimMatch {
  constructor({ clients, seed = Date.now(), siegrunden = SIEGRUNDEN }) {
    this.rnd = zufall(seed);
    this.siegrunden = siegrunden;
    this.runde = 0;
    this.score = [0, 0];
    this.ende = false;
    this.spieler = clients.map((c, i) => ({ token: c.token, name: NAMEN[i % NAMEN.length], team: i < clients.length / 2 ? 0 : 1, lebt: true, kills: 0 }));
  }

  vorbei() { return this.ende; }
  ziehe(l) { return l[Math.floor(this.rnd() * l.length)]; }
  team(t) { return this.spieler.filter((p) => p.team === t); }
  anzeige() { return { teams: [[VAL_TEAMS[0], this.score[0]], [VAL_TEAMS[1], this.score[1]]], einheit: "Runden", text: this.runde ? `Team A ${this.runde <= 12 ? "greift an" : "verteidigt"}` : "" }; }

  an(p, was) { const [event, seite] = SIEHT[was]; return { bild: true, an: p.token, event, seite, team: VAL_TEAMS[p.team], name: p.name }; }
  alle(merkmal) { return this.spieler.map((p) => this.an(p, merkmal)); }

  naechsteRunde() {
    const s = [];
    const schritt = (dt, ...p) => s.push({ dt, payloads: p.flat(3).filter(Boolean) });
    this.runde++;
    for (const p of this.spieler) { p.lebt = true; p.kills = 0; }
    schritt(this.runde === 1 ? 800 : 2500, this.alle("kaufphase"));
    const sieger = this.rnd() < 0.5 ? 0 : 1, verlierer = 1 - sieger;
    // Angriff: Team A in der ersten Hälfte
    const angreifer = this.runde <= 12 ? 0 : 1;
    const legen = angreifer === sieger ? this.rnd() < 0.55 : this.rnd() < 0.35;
    const toteVerlierer = legen && angreifer === sieger ? 2 + Math.floor(this.rnd() * 3) : 5;
    const toteSieger = Math.floor(this.rnd() * 5);
    let geplant = false, entschaerft = false;
    const kills = [...Array(toteVerlierer).fill(verlierer), ...Array(toteSieger).fill(sieger)].sort(() => this.rnd() - 0.5);
    // Die letzten Toten gehören immer den Verlierern, und vom Siegerteam lebt am Ende mindestens einer
    for (let i = 0; i < kills.length; i++) {
      const opferTeam = kills[i];
      const lebend = this.team(opferTeam).filter((p) => p.lebt), taeter = this.team(1 - opferTeam).filter((p) => p.lebt);
      if (!lebend.length || !taeter.length || (opferTeam === sieger && lebend.length === 1)) continue;
      const o = this.ziehe(lebend), a = this.ziehe(taeter);
      o.lebt = false; a.kills++;
      schritt(900, this.an(a, "kill"), this.an(o, "tod"));
      if (a.kills === 5) schritt(600, this.an(a, "ace"));
      if (i === 1 && legen) { geplant = true; schritt(1200, this.alle("spike_gelegt")); }
    }
    if (geplant && angreifer !== sieger) { entschaerft = true; schritt(1500, this.alle("spike_entschaerft")); }
    this.score[sieger]++;
    const rest = this.team(sieger).filter((p) => p.lebt);
    const clutch = rest.length === 1 && rest[0].kills >= 2;
    schritt(entschaerft ? 2000 : 1200, this.spieler.map((p) => this.an(p, p.team === sieger ? "runde_sieg" : "runde_niederlage")), clutch ? this.an(rest[0], "clutch") : null);
    // Verlängerung ausgelassen: wer zuerst 13 Runden hat, gewinnt
    if (this.score[sieger] >= this.siegrunden) {
      this.ende = true;
      schritt(2000, this.spieler.map((p) => this.an(p, p.team === sieger ? "match_sieg" : "match_niederlage")));
    }
    return s;
  }
}

module.exports = { ValSimMatch };
