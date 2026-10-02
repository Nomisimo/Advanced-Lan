// Regie: öffnet die Session im LAN. Veröffentlicht sie per mDNS und nimmt Game-PCs per WebSocket an.
const crypto = require('crypto');
const os = require('os');
const { WebSocketServer } = require('ws');
const { Bonjour } = require('bonjour-service');
const { mdnsTxt, leseNachricht, MDNS_TYP, PROTOKOLL_VERSION } = require('../core/protokoll');

const beweis = (passwort, nonce) => crypto.createHmac('sha256', String(passwort)).update(nonce).digest('hex');
const gleich = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

class SessionServer {
  constructor({ regie, getConfig, onChange }) {
    this.regie = regie;
    this.getConfig = getConfig; // → Regie-Einstellungen
    this.onChange = onChange || (() => {});
    this.wss = null;
    this.mdns = null;
    this.dienst = null;
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
    this.mdns = new Bonjour({}, (e) => { this.fehler = `mDNS: ${e.message}`; this.onChange(); });
    this.ausrufen();
    this.onChange();
    return true;
  }

  async schliessen() {
    await this.dienstStoppen();
    if (this.mdns) { try { this.mdns.destroy(); } catch {} this.mdns = null; }
    for (const [pcId, ws] of this.verbindungen) { try { ws.close(4000, 'Session geschlossen'); } catch {} this.regie.pcGetrennt(pcId); }
    this.verbindungen.clear();
    const wss = this.wss;
    this.wss = null;
    if (wss) await new Promise((r) => wss.close(() => r()));
    this.onChange();
  }

  // Session per mDNS veröffentlichen. TXT-Einträge lassen sich nicht ändern, deshalb bei Spiel- oder Namenswechsel neu veröffentlichen.
  ausrufen() {
    this.kette = (this.kette || Promise.resolve()).then(() => this.veroeffentlichen()); // nacheinander, nie zwei Dienste gleichzeitig
    return this.kette;
  }

  async veroeffentlichen() {
    if (!this.mdns) return;
    const s = this.getConfig().session;
    const txt = mdnsTxt({ session: s.name, aktivesSpiel: this.getConfig().aktivesSpiel });
    if (this.dienst && JSON.stringify(this.dienst.txt) === JSON.stringify(txt)) return;
    await this.dienstStoppen();
    if (!this.mdns) return;
    this.dienst = this.mdns.publish({ name: `${s.name} (${os.hostname()})`.slice(0, 63), type: MDNS_TYP, port: this.port, txt, probe: false, disableIPv6: true });
    this.dienst.on('error', (e) => { this.fehler = `mDNS: ${e.message}`; this.onChange(); });
  }

  dienstStoppen() {
    const d = this.dienst;
    this.dienst = null;
    return d ? new Promise((r) => { try { d.stop(r); } catch { r(); } setTimeout(r, 500); }) : Promise.resolve();
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
