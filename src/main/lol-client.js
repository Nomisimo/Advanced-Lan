// Game-PC: fragt Riots Live Client Data API von League of Legends ab (https://127.0.0.1:2999, siehe core/lol.js).
// Nur auf diesem PC. Das Zertifikat ist von Riot selbst signiert, deshalb ohne Prüfung, aber nur für 127.0.0.1.
const https = require('https');
const { LOL_URL, lolZustand, lolAuswerten } = require('../core/lol');

const TAKT = 1000;
const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

class LolClient {
  constructor({ onNachricht, onTeam, onChange }) {
    this.onNachricht = onNachricht;
    this.onTeam = onTeam || (() => {});
    this.onChange = onChange || (() => {});
    this.timer = null;
    this.z = lolZustand();
    this.verbunden = false;
    this.letzte = 0;
    this.fehler = '';
  }

  start() { if (!this.timer) { this.timer = setInterval(() => this.abfragen(), TAKT); this.abfragen(); } }
  stop() { clearInterval(this.timer); this.timer = null; this.setVerbunden(false); }

  setVerbunden(v) { if (v !== this.verbunden) { this.verbunden = v; if (!v) this.z = lolZustand(); this.onChange(); } }

  abfragen() {
    if (this.laeuft) return;
    this.laeuft = true;
    const req = https.get(LOL_URL, { agent, timeout: 800 }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => {
        this.laeuft = false;
        // 404 während des Ladebildschirms: Spiel läuft, Daten noch nicht da
        if (res.statusCode !== 200) { this.setVerbunden(false); return; }
        let d;
        try { d = JSON.parse(text); } catch { return; }
        this.setVerbunden(true);
        const vorher = this.z.team;
        const r = lolAuswerten(d, this.z);
        if (r.team && r.team !== vorher) this.onTeam(r.team);
        if (r.nachrichten.length) this.letzte = Date.now();
        for (const n of r.nachrichten) this.onNachricht(n);
      });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => { this.laeuft = false; this.setVerbunden(false); });
  }

  status() { return { laeuft: !!this.timer, verbunden: this.verbunden, team: this.z.team, ich: this.z.ich, letzte: this.letzte }; }
}

module.exports = { LolClient };
