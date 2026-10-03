// Game-PC: findet Sessions im LAN (mDNS) und verbindet sich per WebSocket mit der Regie.
const os = require('os');
const { Bonjour } = require('bonjour-service');
const WebSocket = require('ws');
const { kartenListe, waehleAdresse, lokaleIp } = require('../core/netzwerk');
const { leseNachricht, MDNS_TYP, PROTOKOLL_VERSION } = require('../core/protokoll');
const { beweis } = require('./session-server');

// Sucht Sessions per mDNS (_advancedlan._tcp). Abgemeldete oder abgelaufene Dienste fallen aus der Liste.
class Discovery {
  constructor({ onChange, karte }) {
    this.onChange = onChange || (() => {});
    this.karte = karte || (() => ''); // Name der gewählten Netzwerkkarte, leer = automatisch
    this.mdns = null;
    this.browser = null;
    this.timer = null;
    this.fehler = '';
  }
  start() {
    if (this.mdns) return;
    const { ip } = lokaleIp(kartenListe(os.networkInterfaces()), this.karte());
    this.mdns = new Bonjour(ip ? { interface: ip, bind: '0.0.0.0' } : {}, (e) => { this.fehler = e.message; this.onChange(); });
    this.browser = this.mdns.find({ type: MDNS_TYP });
    for (const ev of ['up', 'down', 'txt-update', 'srv-update']) this.browser.on(ev, () => this.onChange());
    // Regelmäßig neu fragen: neue Regie sofort sehen, verschwundene nach Ablauf der TTL
    this.timer = setInterval(() => { try { this.browser.update(); this.browser.expire(); } catch {} }, 3000);
  }
  stop() {
    clearInterval(this.timer);
    if (this.browser) { try { this.browser.stop(); } catch {} this.browser = null; }
    if (this.mdns) { try { this.mdns.destroy(); } catch {} this.mdns = null; }
  }
  liste() {
    if (!this.browser) return [];
    const karten = kartenListe(os.networkInterfaces());
    return this.browser.services.map((d) => {
      const txt = d.txt || {};
      // Lauscht die Regie auf einer Karte, steht deren IP im TXT-Eintrag. Sonst die Adresse im eigenen Netz nehmen.
      const ip = (txt.ip && String(txt.ip)) || waehleAdresse(d.addresses, karten, this.karte()) || d.referer?.address || d.host;
      return { id: String(d.name || ''), session: String(txt.session || d.name), host: String(d.host || '').replace(/\.local\.?$/, ''), ip, port: d.port, aktivesSpiel: String(txt.spiel || ''), v: Number(txt.v) || 0 };
    }).filter((s) => s.ip && s.port);
  }
}

// Verbindung zur Regie. Verbindet sich nach Abbruch selbst neu, solange nicht bewusst getrennt wurde.
class SessionClient {
  // geraet(): Angaben für die Übersicht der Regie. karte(): Name der gewählten Netzwerkkarte.
  constructor({ onChange, onAntwort, geraet, karte }) {
    this.geraetInfo = geraet || (() => ({}));
    this.karte = karte || (() => '');
    this.onChange = onChange || (() => {});
    this.onAntwort = onAntwort || (() => {});
    this.ws = null;
    this.ziel = null; // { host, port, passwort, pcId, spiele }
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
    const lokal = lokaleIp(kartenListe(os.networkInterfaces()), this.karte());
    if (lokal.fehler) { this.setze('getrennt', lokal.fehler); return this.spaeter(); }
    let ws;
    try { ws = new WebSocket(`ws://${host}:${port}`, { handshakeTimeout: 4000, ...(lokal.ip ? { localAddress: lokal.ip } : {}) }); }
    catch (e) { this.setze('getrennt', e.message); return this.spaeter(); }
    this.ws = ws;
    ws.on('message', (data) => {
      const m = leseNachricht(data);
      if (!m) return;
      if (m.t === 'hallo') {
        this.session = m.session || '';
        this.aktivesSpiel = m.aktivesSpiel || '';
        ws.send(JSON.stringify({ t: 'anmelden', pcId: this.ziel.pcId, spiele: this.ziel.spiele, version: PROTOKOLL_VERSION, beweis: beweis(this.ziel.passwort, m.nonce), geraet: this.geraet(ws) }));
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

  // Hostname, App-Version und die Karte, über die die Verbindung tatsächlich läuft (mit MAC)
  geraet(ws) {
    const lokal = String(ws._socket?.localAddress || '').replace(/^::ffff:/, '');
    const k = kartenListe(os.networkInterfaces()).find((x) => x.ip === lokal);
    return { hostname: os.hostname(), plattform: process.platform, ...this.geraetInfo(), mac: k?.mac || '', karte: k ? `${k.name} (${k.ip})` : lokal };
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
