// Game-PC: findet Sessions im LAN (UDP-Broadcast) und verbindet sich per WebSocket mit der Regie.
const dgram = require('dgram');
const WebSocket = require('ws');
const { leseBeacon, leseNachricht, PROTOKOLL_VERSION } = require('../core/protokoll');
const { PORTS } = require('../core/defaults');
const { beweis } = require('./session-server');

// Hört auf die Ausrufe der Regie-Apps. Sessions, die 5 s nicht mehr rufen, fallen aus der Liste.
class Discovery {
  constructor({ onChange, port = PORTS.discovery }) {
    this.onChange = onChange || (() => {});
    this.port = port;
    this.sessions = new Map(); // "ip:port" → { session, host, ip, port, aktivesSpiel, pcs, t }
    this.sock = null;
    this.timer = null;
    this.fehler = '';
  }
  start() {
    if (this.sock) return;
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    sock.on('error', (e) => { this.fehler = e.message; this.onChange(); });
    sock.on('message', (msg, rinfo) => {
      const b = leseBeacon(msg);
      if (!b) return;
      const key = `${rinfo.address}:${b.port}`;
      const neu = !this.sessions.has(key);
      this.sessions.set(key, { session: b.session, host: b.host, ip: rinfo.address, port: b.port, aktivesSpiel: b.aktivesSpiel, pcs: b.pcs, t: Date.now() });
      if (neu) this.onChange();
    });
    sock.bind(this.port);
    this.sock = sock;
    this.timer = setInterval(() => {
      let weg = false;
      for (const [k, s] of this.sessions) if (Date.now() - s.t > 5000) { this.sessions.delete(k); weg = true; }
      if (weg) this.onChange();
    }, 1000);
  }
  stop() {
    clearInterval(this.timer);
    if (this.sock) { try { this.sock.close(); } catch {} this.sock = null; }
  }
  liste() { return [...this.sessions.values()]; }
}

// Verbindung zur Regie. Verbindet sich nach Abbruch selbst neu, solange nicht bewusst getrennt wurde.
class SessionClient {
  constructor({ onChange, onAntwort }) {
    this.onChange = onChange || (() => {});
    this.onAntwort = onAntwort || (() => {});
    this.ws = null;
    this.ziel = null; // { host, port, passwort, pcId, spiel }
    this.zustand = 'getrennt'; // getrennt | verbinde | verbunden | abgelehnt
    this.grund = '';
    this.session = '';
    this.aktivesSpiel = '';
    this.retry = null;
    this.n = 0;
    this.verworfen = 0;
    this.gesendet = 0;
  }

  verbinden(ziel) {
    this.trennen();
    this.ziel = { ...ziel };
    this.aufbauen();
  }

  aufbauen() {
    if (!this.ziel) return;
    const { host, port } = this.ziel;
    this.setze('verbinde', '');
    let ws;
    try { ws = new WebSocket(`ws://${host}:${port}`, { handshakeTimeout: 4000 }); }
    catch (e) { this.setze('getrennt', e.message); return this.spaeter(); }
    this.ws = ws;
    ws.on('message', (data) => {
      const m = leseNachricht(data);
      if (!m) return;
      if (m.t === 'hallo') {
        this.session = m.session || '';
        this.aktivesSpiel = m.aktivesSpiel || '';
        ws.send(JSON.stringify({ t: 'anmelden', pcId: this.ziel.pcId, spiel: this.ziel.spiel, version: PROTOKOLL_VERSION, beweis: beweis(this.ziel.passwort, m.nonce) }));
      } else if (m.t === 'ok') {
        this.aktivesSpiel = m.aktivesSpiel || this.aktivesSpiel;
        this.setze('verbunden', '');
      } else if (m.t === 'abgelehnt') {
        this.setze('abgelehnt', m.grund || 'abgelehnt');
      } else if (m.t === 'aktivesSpiel') {
        this.aktivesSpiel = m.spiel;
        this.onChange();
      } else if (m.t === 'quittung') {
        if (m.verworfen) this.verworfen++;
        this.onAntwort(m);
      }
    });
    ws.on('close', (code, reason) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.zustand === 'abgelehnt') { this.ziel = null; return this.onChange(); } // falsches Passwort: nicht endlos neu versuchen
      this.setze('getrennt', code === 4002 ? 'Ein anderer PC hat sich mit derselben PC-ID angemeldet' : String(reason || '') || this.grund || 'Verbindung verloren');
      if (code === 4002 || code === 4003) { this.ziel = null; return; }
      this.spaeter();
    });
    ws.on('error', (e) => { this.grund = e.code === 'ECONNREFUSED' ? 'Regie nicht erreichbar' : e.message; });
  }

  spaeter() {
    clearTimeout(this.retry);
    if (this.ziel) this.retry = setTimeout(() => this.aufbauen(), 3000);
  }

  trennen() {
    clearTimeout(this.retry);
    this.ziel = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) { try { ws.close(1000); } catch {} }
    this.setze('getrennt', '');
  }

  setze(zustand, grund) { this.zustand = zustand; this.grund = grund; this.onChange(); }

  // Nicht verbunden: Ereignis geht verloren. Alte Ereignisse später nachzuschicken würde Effekte zur falschen Zeit auslösen.
  sende(m) {
    if (this.zustand !== 'verbunden' || !this.ws || this.ws.readyState !== 1) return false;
    this.ws.send(JSON.stringify(m));
    return true;
  }
  event(spiel, ev) {
    const ok = this.sende({ t: 'event', n: ++this.n, spiel, ev });
    if (ok) this.gesendet++;
    return ok;
  }
  status(spiel, status, stand) { return this.sende({ t: 'status', spiel, status, stand }); }

  info() {
    return { zustand: this.zustand, grund: this.grund, session: this.session, aktivesSpiel: this.aktivesSpiel, ziel: this.ziel && { host: this.ziel.host, port: this.ziel.port }, gesendet: this.gesendet, verworfen: this.verworfen };
  }
}

module.exports = { Discovery, SessionClient };
