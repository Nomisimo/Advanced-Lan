// Game-PC: WebSocket-Empfang für die Overwolf-App „Automation Overdrive“ (Valorant-Events, siehe core/overdrive.js).
// Lauscht wie deren Touch-Portal-Plugin auf Port 44206, aber nur lokal (127.0.0.1 und ::1, „localhost“ kann beides sein).
const { WebSocketServer } = require('ws');
const { overdriveEvent } = require('../core/overdrive');

class OverdriveServer {
  constructor({ onEvent, onChange }) {
    this.onEvent = onEvent;
    this.onChange = onChange || (() => {});
    this.server = [];
    this.port = null;
    this.fehler = '';
    this.verbunden = 0;
    this.letzte = 0;
  }

  async start(port) {
    if (this.server.length && this.port === port) return;
    await this.stop();
    this.port = port;
    this.fehler = '';
    for (const host of ['127.0.0.1', '::1']) {
      const s = await new Promise((resolve) => {
        const wss = new WebSocketServer({ host, port });
        wss.once('listening', () => resolve(wss));
        wss.once('error', (e) => {
          // ::1 fehlt, wenn IPv6 aus ist: dann reicht 127.0.0.1
          if (host === '127.0.0.1') this.fehler = e.code === 'EADDRINUSE' ? `Port ${port} ist schon belegt` : e.message;
          resolve(null);
        });
      });
      if (!s) continue;
      s.on('error', () => {});
      s.on('connection', (ws) => this.verbindung(ws));
      this.server.push(s);
    }
    if (this.fehler) await this.stop();
    this.onChange();
  }

  verbindung(ws) {
    this.verbunden++;
    this.onChange();
    ws.on('message', (data) => {
      const text = String(data);
      try { ws.send(`v1 received: ${text}`); } catch {} // antwortet wie das Touch-Portal-Plugin
      const ev = overdriveEvent(text);
      if (!ev) return;
      this.letzte = Date.now();
      this.onEvent(ev);
    });
    ws.on('close', () => { this.verbunden = Math.max(0, this.verbunden - 1); this.onChange(); });
    ws.on('error', () => {});
  }

  async stop() {
    const alle = this.server;
    this.server = [];
    this.verbunden = 0;
    await Promise.all(alle.map((s) => new Promise((r) => {
      for (const c of s.clients) { try { c.terminate(); } catch {} }
      s.close(() => r());
    })));
  }

  status() {
    return { laeuft: this.server.length > 0, port: this.port, fehler: this.fehler, verbunden: this.verbunden, letzte: this.letzte };
  }
}

module.exports = { OverdriveServer };
