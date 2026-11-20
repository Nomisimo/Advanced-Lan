// Game-PC: HTTP-Empfang (Webhook) für die Overwolf-App „Shots Fired“ (Valorant-Events, siehe core/shotsfired.js).
// Lauscht nur lokal (127.0.0.1 und ::1) auf Port 44207 und nimmt jede Anfrage an, egal welcher Pfad oder welche Methode.
// Die letzten Anfragen bleiben im Speicher (status().roh), damit man im Setup sieht, was Shots Fired wirklich schickt.
const http = require('http');
const { shotsfiredEvents, sfZustand } = require('../core/shotsfired');

const MAX_ROH = 30;
const MAX_BODY = 64 * 1024;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': '*' };

class ShotsFiredServer {
  constructor({ onEvent, onChange }) {
    this.onEvent = onEvent;
    this.onChange = onChange || (() => {});
    this.server = [];
    this.port = null;
    this.fehler = '';
    this.letzte = 0;
    this.anfragen = 0;
    this.roh = [];
    this.z = sfZustand();
  }

  async start(port) {
    if (this.server.length && this.port === port) return;
    await this.stop();
    this.port = port;
    this.fehler = '';
    for (const host of ['127.0.0.1', '::1']) {
      const s = await new Promise((resolve) => {
        const srv = http.createServer((req, res) => this.anfrage(req, res));
        srv.once('listening', () => resolve(srv));
        srv.once('error', (e) => {
          // ::1 fehlt, wenn IPv6 aus ist: dann reicht 127.0.0.1
          if (host === '127.0.0.1') this.fehler = e.code === 'EADDRINUSE' ? `Port ${port} ist schon belegt` : e.message;
          resolve(null);
        });
        srv.listen(port, host);
      });
      if (!s) continue;
      s.on('error', () => {});
      this.server.push(s);
    }
    if (this.fehler) await this.stop();
    this.onChange();
  }

  anfrage(req, res) {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
    let body = '', zuGross = false;
    req.on('data', (c) => { if (body.length + c.length > MAX_BODY) zuGross = true; else body += c; });
    req.on('end', () => {
      res.writeHead(zuGross ? 413 : 200, { ...CORS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: !zuGross }));
      if (zuGross) return;
      // GET ohne Body: Werte aus der Adresse (?event=spike_planted)
      let daten = body;
      if (!body.trim()) {
        try { daten = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams); } catch { daten = {}; }
      }
      this.verarbeiten(daten, { methode: req.method, pfad: req.url });
    });
    req.on('error', () => {});
  }

  verarbeiten(daten, { methode = 'POST', pfad = '/' } = {}) {
    const nachrichten = shotsfiredEvents(daten, this.z);
    this.anfragen++;
    const text = typeof daten === 'string' ? daten : JSON.stringify(daten);
    this.roh.unshift({ t: Date.now(), methode, pfad: String(pfad).slice(0, 200), body: text.slice(0, 2000), events: nachrichten.map((n) => n.event + (n.seite === 'gegner' ? ' (Gegner)' : '')) });
    this.roh.length = Math.min(this.roh.length, MAX_ROH);
    if (nachrichten.length) this.letzte = Date.now();
    for (const n of nachrichten) this.onEvent(n);
    this.onChange();
  }

  async stop() {
    const alle = this.server;
    this.server = [];
    await Promise.all(alle.map((s) => new Promise((r) => { s.close(() => r()); s.closeAllConnections?.(); })));
  }

  status() {
    return { laeuft: this.server.length > 0, port: this.port, fehler: this.fehler, letzte: this.letzte, anfragen: this.anfragen, roh: this.roh.slice(0, 10) };
  }
}

module.exports = { ShotsFiredServer };
