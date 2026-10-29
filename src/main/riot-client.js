// Game-PC: Valorant-Team über den Riot Client erkennen (siehe core/riot-team.js).
// Nur lesend und nur mit der Anmeldung, die der Riot Client auf diesem PC schon hat: lockfile → lokale Schnittstelle
// (Token, PUUID, Version) → Riot-Server dieser Region (Agentenwahl oder laufendes Match) → TeamID des Spielers.
// Inoffiziell: Riot kann die Schnittstellen ändern. Dann bleibt das Team aus dem Setup.
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { parseLockfile, parseGlz, valorantVersion, eigeneTeamId, appTeam, CLIENT_PLATFORM } = require('../core/riot-team');

const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const LOCKFILE = path.join(LOCAL, 'Riot Games', 'Riot Client', 'Config', 'lockfile');
const SHOOTER_LOG = path.join(LOCAL, 'VALORANT', 'Saved', 'Logs', 'ShooterGame.log');
const PLATTFORM = Buffer.from(JSON.stringify(CLIENT_PLATFORM)).toString('base64');
// Der Riot Client hat ein selbst ausgestelltes Zertifikat: nur für 127.0.0.1 ohne Prüfung
const lokalAgent = new https.Agent({ rejectUnauthorized: false });

function holen(url, headers, agent) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, agent, timeout: 5000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        let json = null;
        try { json = body ? JSON.parse(body) : null; } catch { /* kein JSON */ }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('timeout', () => req.destroy(new Error('Zeitüberschreitung')));
    req.on('error', reject);
  });
}

class RiotClient {
  constructor({ onTeam, onChange }) {
    this.onTeam = onTeam || (() => {});
    this.onChange = onChange || (() => {});
    this.timer = null;
    this.lauf = 0; // jede Abfrageschleife hat eine Nummer: nach stop() endet die alte, auch mitten in einer Anfrage
    this.reset();
  }

  reset() {
    // zustand: aus | kein-client | kein-match | erkannt | fehler
    this.s = { zustand: 'aus', team: '', teamId: '', phase: '', detail: '', letzte: 0 };
    this.glz = null;
    this.matchId = '';
  }

  status() { return { ...this.s }; }

  start() {
    if (this.s.zustand !== 'aus' || process.platform !== 'win32') return;
    this.s.zustand = 'kein-client';
    this.runde(++this.lauf);
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = null;
    this.lauf++;
    this.reset();
    this.onChange();
  }

  async runde(lauf) {
    let neu;
    try { neu = await this.abfragen(); } catch (e) { neu = { zustand: 'fehler', detail: e.message }; }
    if (lauf !== this.lauf) return; // inzwischen gestoppt
    const vorher = this.s;
    this.s = { ...vorher, team: '', teamId: '', phase: '', detail: '', ...neu };
    if (this.s.team) this.s.letzte = Date.now();
    if (this.s.team && this.s.team !== vorher.team) this.onTeam(this.s.team);
    if (JSON.stringify({ ...this.s, letzte: 0 }) !== JSON.stringify({ ...vorher, letzte: 0 })) this.onChange();
    // Im Match ändert sich das Team nicht: dann seltener fragen
    this.timer = setTimeout(() => this.runde(lauf), this.s.team ? 15000 : 5000);
  }

  async abfragen() {
    let lock;
    try { lock = parseLockfile(await fs.promises.readFile(LOCKFILE, 'utf8')); } catch { lock = null; }
    if (!lock) { this.glz = null; return { zustand: 'kein-client', detail: 'Riot Client läuft nicht' }; }
    const basis = `https://127.0.0.1:${lock.port}`;
    const auth = { Authorization: `Basic ${Buffer.from(`riot:${lock.passwort}`).toString('base64')}` };

    const tok = await holen(`${basis}/entitlements/v1/token`, auth, lokalAgent);
    if (tok.status !== 200 || !tok.json?.accessToken) return { zustand: 'kein-client', detail: 'Riot Client: nicht angemeldet' };
    const { accessToken, token, subject: puuid } = tok.json;

    const ses = await holen(`${basis}/product-session/v1/external-sessions`, auth, lokalAgent);
    const version = valorantVersion(ses.json);
    if (!version) return { zustand: 'kein-client', detail: 'Valorant läuft nicht' };

    if (!this.glz) {
      try { this.glz = parseGlz(await fs.promises.readFile(SHOOTER_LOG, 'utf8')); } catch { this.glz = null; }
      if (!this.glz) return { zustand: 'fehler', detail: 'Region nicht gefunden (ShooterGame.log)' };
    }
    const glz = `https://glz-${this.glz.region}-1.${this.glz.shard}.a.pvp.net`;
    const h = { Authorization: `Bearer ${accessToken}`, 'X-Riot-Entitlements-JWT': token, 'X-Riot-ClientPlatform': PLATTFORM, 'X-Riot-ClientVersion': version };

    // Erst das laufende Match, dann die Agentenwahl
    for (const [art, phase] of [['core-game', 'Match läuft'], ['pregame', 'Agentenwahl']]) {
      const p = await holen(`${glz}/${art}/v1/players/${puuid}`, h);
      if (p.status !== 200 || !p.json?.MatchID) continue;
      const m = await holen(`${glz}/${art}/v1/matches/${p.json.MatchID}`, h);
      if (m.status !== 200) continue;
      const teamId = eigeneTeamId(m.json, puuid), team = appTeam(teamId);
      if (!team) return { zustand: 'kein-match', phase, detail: teamId ? `unbekanntes Team ${teamId}` : 'Zuschauer oder Coach' };
      return { zustand: 'erkannt', team, teamId, phase };
    }
    return { zustand: 'kein-match', detail: 'Valorant läuft, gerade kein Match' };
  }
}

module.exports = { RiotClient };
