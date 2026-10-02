// Regie: öffnet die Session im LAN. Ruft sie per UDP-Broadcast aus und nimmt Game-PCs per WebSocket an.
const crypto = require('crypto');
const dgram = require('dgram');
const os = require('os');
const { WebSocketServer } = require('ws');
const { beacon, leseNachricht, PROTOKOLL_VERSION } = require('../core/protokoll');
const { PORTS } = require('../core/defaults');

const beweis = (passwort, nonce) => crypto.createHmac('sha256', String(passwort)).update(nonce).digest('hex');
const gleich = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

// Broadcast-Adressen aller IPv4-Netze (192.168.1.255 …), dazu 255.255.255.255
function broadcastAdressen() {
  const out = new Set(['255.255.255.255']);
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal || !a.netmask) continue;
      const ip = a.address.split('.').map(Number), m = a.netmask.split('.').map(Number);
      out.add(ip.map((o, i) => (o & m[i]) | (~m[i] & 255)).join('.'));
    }
  return [...out];
}

class SessionServer {
  constructor({ regie, getConfig, onChange, discoveryPort = PORTS.discovery }) {
    this.regie = regie;
    this.getConfig = getConfig; // → Regie-Einstellungen
    this.onChange = onChange || (() => {});
    this.discoveryPort = discoveryPort;
    this.wss = null;
    this.udp = null;
    this.timer = null;
    this.verbindungen = new Map(); // pcId → ws
    this.fehler = '';
    this.port = null;
  }

  get offen() { return !!this.wss; }

  async oeffnen() {
    await this.schliessen();
    const s = this.getConfig().session;
    this.fehler = '';
    if (!s.passwort) { this.fehler = 'Ohne Passwort lässt sich keine Session öffnen.'; this.onChange(); return false; }
    const wss = new WebSocketServer({ port: Number(s.port), maxPayload: 256 * 1024 });
    const ok = await new Promise((resolve) => {
      wss.once('listening', () => resolve(true));
      wss.once('error', (e) => { this.fehler = e.code === 'EADDRINUSE' ? `Port ${s.port} ist schon belegt` : e.message; resolve(false); });
    });
    if (!ok) { wss.close(); this.onChange(); return false; }
    this.wss = wss;
    this.port = Number(s.port);
    wss.on('connection', (ws, req) => this.verbindung(ws, (req.socket.remoteAddress || '').replace(/^::ffff:/, '')));
    this.udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.udp.on('error', () => {});
    this.udp.bind(() => { try { this.udp.setBroadcast(true); } catch {} });
    this.timer = setInterval(() => this.ausrufen(), 1000);
    this.ausrufen();
    this.onChange();
    return true;
  }

  async schliessen() {
    clearInterval(this.timer);
    this.timer = null;
    if (this.udp) { try { this.udp.close(); } catch {} this.udp = null; }
    for (const [pcId, ws] of this.verbindungen) { try { ws.close(4000, 'Session geschlossen'); } catch {} this.regie.pcGetrennt(pcId); }
    this.verbindungen.clear();
    const wss = this.wss;
    this.wss = null;
    if (wss) await new Promise((r) => wss.close(() => r()));
    this.onChange();
  }

  ausrufen() {
    if (!this.udp) return;
    const s = this.getConfig().session;
    const msg = Buffer.from(beacon({ session: s.name, port: this.port, host: os.hostname(), aktivesSpiel: this.getConfig().aktivesSpiel, pcs: this.verbindungen.size }));
    for (const ziel of broadcastAdressen()) this.udp.send(msg, this.discoveryPort, ziel, () => {});
  }

  verbindung(ws, remote) {
    const nonce = crypto.randomBytes(16).toString('hex');
    let pcId = null;
    const senden = (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
    const abweisen = (grund) => { senden({ t: 'abgelehnt', grund }); setTimeout(() => ws.close(4001, grund), 50); };
    const anmeldeFrist = setTimeout(() => !pcId && abweisen('Keine Anmeldung'), 10000);
    senden({ t: 'hallo', session: this.getConfig().session.name, nonce, aktivesSpiel: this.getConfig().aktivesSpiel, v: PROTOKOLL_VERSION });

    ws.on('message', (data) => {
      const m = leseNachricht(data);
      if (!m) return;
      if (!pcId) {
        if (m.t !== 'anmelden') return;
        const id = String(m.pcId || '').trim().slice(0, 40);
        if (!id) return abweisen('PC-ID fehlt');
        if (!gleich(m.beweis, beweis(this.getConfig().session.passwort, nonce))) return abweisen('Falsches Passwort');
        const alt = this.verbindungen.get(id);
        if (alt && alt !== ws) { try { alt.close(4002, 'Gleiche PC-ID hat sich neu angemeldet'); } catch {} }
        clearTimeout(anmeldeFrist);
        pcId = id;
        this.verbindungen.set(id, ws);
        this.regie.pcVerbunden(id, { spiel: String(m.spiel || ''), remote });
        senden({ t: 'ok', aktivesSpiel: this.getConfig().aktivesSpiel });
        this.onChange();
        return;
      }
      if (m.t === 'event' && m.ev && typeof m.ev.type === 'string') {
        const e = this.regie.pcEvent(pcId, String(m.spiel || ''), m.ev);
        senden({ t: 'quittung', n: m.n, verworfen: String(m.spiel) !== this.getConfig().aktivesSpiel, cues: e ? e.sends.filter((s) => s.address).length : 0 });
      } else if (m.t === 'status') {
        this.regie.pcStatus(pcId, { spiel: String(m.spiel || ''), status: m.status, stand: m.stand });
      }
    });
    ws.on('close', () => {
      clearTimeout(anmeldeFrist);
      if (pcId && this.verbindungen.get(pcId) === ws) { this.verbindungen.delete(pcId); this.regie.pcGetrennt(pcId); this.onChange(); }
    });
    ws.on('error', () => {});
  }

  // Aktives Spiel an alle Game-PCs melden
  spielGewechselt() {
    const m = JSON.stringify({ t: 'aktivesSpiel', spiel: this.getConfig().aktivesSpiel });
    for (const ws of this.verbindungen.values()) if (ws.readyState === 1) ws.send(m);
    this.ausrufen();
  }

  trennen(pcId) { const ws = this.verbindungen.get(pcId); if (ws) ws.close(4003, 'Von der Regie getrennt'); }

  status() { return { offen: this.offen, port: this.port, fehler: this.fehler, verbunden: this.verbindungen.size }; }
}

module.exports = { SessionServer, beweis };
