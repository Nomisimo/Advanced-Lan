// Game-PC: HTTP-Empfang für CS2 Game State Integration. CS2 schickt seinen Zustand per POST an diese App.
const http = require('http');

const MAX_BODY = 2 * 1024 * 1024;

class GsiServer {
  constructor({ onPayload, onStatus }) {
    this.onPayload = onPayload;
    this.onStatus = onStatus || (() => {});
    this.server = null;
    this.port = null;
    this.fehler = '';
  }

  // host 127.0.0.1: nur CS2 auf demselben PC darf senden
  async start(port, host = '127.0.0.1') {
    if (this.server && this.port === port) return;
    await this.stop();
    this.port = port;
    this.fehler = '';
    const server = http.createServer((req, res) => this.handle(req, res));
    server.keepAliveTimeout = 30000;
    this.server = server;
    await new Promise((resolve) => {
      server.once('error', (e) => {
        this.fehler = e.code === 'EADDRINUSE' ? `Port ${port} ist schon belegt` : e.message;
        this.server = null;
        resolve();
      });
      server.listen(port, host, resolve);
    });
    this.onStatus(this.status());
  }

  async stop() {
    const s = this.server;
    this.server = null;
    if (s) await new Promise((r) => s.close(() => r()));
  }

  status() {
    return { laeuft: !!this.server && !this.fehler, port: this.port, fehler: this.fehler };
  }

  handle(req, res) {
    if (req.method !== 'POST') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Advanced LAN: CS2-Empfang läuft. CS2 schickt hierher per POST.\n');
      return;
    }
    const chunks = [];
    let len = 0;
    req.on('data', (c) => {
      len += c.length;
      if (len > MAX_BODY) { req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      // CS2 wartet auf eine 2xx-Antwort, sonst schickt es dieselben Daten erneut
      res.writeHead(200);
      res.end();
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return; }
      this.onPayload(body, (req.socket.remoteAddress || '').replace(/^::ffff:/, ''));
    });
  }
}

module.exports = { GsiServer };
