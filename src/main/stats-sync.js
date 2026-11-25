// Stats-Screen-PCs per UDP (Protokoll: core/stats-sync.js).
// Regie (StatsSender): schickt Stand, Events und ein Lebenszeichen an die Multicast-Gruppe und per Unicast an jeden
// angemeldeten Stats-PC, der den Multicast nicht bekommt. Das Layout schickt sie auf Anfrage.
// Stats-PC (StatsEmpfaenger): lauscht auf Multicast und Unicast, meldet sich alle 2 s bei der Regie an
// (Adresse aus dem Lebenszeichen, von Hand oder aus der Session-Suche) und holt sich das Layout, wenn die Version wechselt.
const dgram = require('dgram');
const os = require('os');
const crypto = require('crypto');
const { verpacken, lesePaket, Zusammensetzer, versionVon } = require('../core/stats-sync');

const LEBENSZEICHEN_MS = 1000; // Lebenszeichen und kompletter Stand
const ABO_MS = 2000; // Anmeldung der Stats-PCs
const ABO_TTL = 7000; // ohne Anmeldung gilt ein Stats-PC als weg
const FRISCH_MS = 3500; // so lange gilt der Multicast als angekommen
const zufallsId = () => crypto.randomBytes(4).readUInt32BE(0);

class StatsSender {
  // opts: einstellungen() → { an, gruppe, port }, ip() → IP der gewählten Karte ("" = automatisch), name() → Session-Name, onChange
  constructor(opts) {
    Object.assign(this, opts);
    this.id = zufallsId();
    this.nummer = 1;
    this.sock = null;
    this.fehler = '';
    this.letzterStatus = null;
    this.cfg = null; this.cfgVersion = '';
    this.empfaenger = new Map(); // "ip:port" → { id, name, ip, port, multicast, version, t }
    this.gesendet = 0; this.bytes = 0;
    this.timer = null; this.statusTimer = null; this.letzterVersand = 0;
    this.lauf = null;
  }

  laeuft() { return !!this.sock; }

  async start() {
    await this.stop();
    const e = this.einstellungen();
    if (!e.an) { this.onChange?.(); return; }
    const lauf = this.lauf = { gruppe: e.gruppe, port: e.port, ip: this.ip() || '' };
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    sock.on('error', (err) => { this.fehler = err.message; this.onChange?.(); });
    sock.on('message', (buf, rinfo) => this.steuerung(buf, rinfo));
    try {
      await new Promise((ok, nein) => { sock.once('error', nein); sock.bind(e.port + 1, () => { sock.off('error', nein); ok(); }); });
      try { sock.setMulticastTTL(4); } catch {}
      try { sock.setMulticastLoopback(true); } catch {} // ein Stats-PC auf demselben Rechner bekommt es auch
      if (lauf.ip) try { sock.setMulticastInterface(lauf.ip); } catch (err) { this.fehler = `Karte: ${err.message}`; }
      this.sock = sock;
      this.fehler = '';
    } catch (err) {
      this.fehler = `Port ${e.port + 1} belegt: ${err.message}`;
      try { sock.close(); } catch {}
      this.onChange?.();
      return;
    }
    this.timer = setInterval(() => this.lebenszeichen(), LEBENSZEICHEN_MS);
    this.lebenszeichen();
    this.onChange?.();
  }

  async stop() {
    clearInterval(this.timer); clearTimeout(this.statusTimer);
    this.timer = this.statusTimer = null;
    if (this.sock) { const s = this.sock; this.sock = null; await new Promise((r) => { try { s.close(r); } catch { r(); } }); }
    this.empfaenger.clear();
  }

  // An die Gruppe und per Unicast an alle Stats-PCs, die den Multicast nicht bekommen. nur: nur an diesen einen (Anfrage)
  senden(art, obj, nur) {
    if (!this.sock) return;
    const nr = this.nummer++;
    const ziele = nur ? [{ ip: nur.address, port: nur.port, weg: 'unicast' }] : [
      { ip: this.lauf.gruppe, port: this.lauf.port, weg: 'multicast' },
      ...[...this.empfaenger.values()].filter((x) => !x.multicast).map((x) => ({ ip: x.ip, port: this.lauf.port, weg: 'unicast' })),
    ];
    for (const z of ziele) {
      let pakete;
      try { pakete = verpacken(art, this.id, nr, obj, z.weg); } catch (err) { this.fehler = err.message; return; }
      for (const p of pakete) {
        this.sock.send(p, z.port, z.ip, (err) => { if (err && !this.fehler) { this.fehler = err.message; this.onChange?.(); } });
        this.gesendet++; this.bytes += p.length;
      }
    }
  }

  // Neuer Stand: sofort, höchstens alle 40 ms (danach der letzte)
  status(obj) {
    this.letzterStatus = obj;
    if (!this.sock || this.statusTimer) return;
    const warte = Math.max(0, 40 - (Date.now() - this.letzterVersand));
    this.statusTimer = setTimeout(() => { this.statusTimer = null; this.statusSenden(); }, warte);
  }
  statusSenden() {
    if (!this.letzterStatus) return;
    this.letzterVersand = Date.now();
    this.senden('status', this.letzterStatus);
  }

  // Event: sofort und zur Sicherheit noch zweimal (der Stats-PC nimmt es nur einmal)
  event(ev) {
    if (!this.sock) return;
    const nr = this.nummer++;
    const raus = () => {
      if (!this.sock) return;
      const ziele = [{ ip: this.lauf.gruppe, weg: 'multicast' }, ...[...this.empfaenger.values()].filter((x) => !x.multicast).map((x) => ({ ip: x.ip, weg: 'unicast' }))];
      for (const z of ziele) for (const p of verpacken('event', this.id, nr, ev, z.weg)) this.sock.send(p, this.lauf.port, z.ip, () => {});
    };
    raus(); setTimeout(raus, 30); setTimeout(raus, 150);
  }

  // Layout und Einstellungen für die Stats-PCs. Neue Version: sofort ein Lebenszeichen, die Stats-PCs holen es sich
  setCfg(obj) {
    const v = versionVon(obj);
    if (v === this.cfgVersion) return;
    this.cfg = obj; this.cfgVersion = v;
    this.lebenszeichen();
  }

  lebenszeichen() {
    if (!this.sock) return;
    const jetzt = Date.now();
    for (const [k, x] of this.empfaenger) if (jetzt - x.t > ABO_TTL) { this.empfaenger.delete(k); this.onChange?.(); }
    this.senden('beacon', { v: this.cfgVersion, name: this.name?.() || '', t: jetzt });
    // Kompletter Stand jede Sekunde: verlorene Pakete heilen sich so von selbst
    if (jetzt - this.letzterVersand >= LEBENSZEICHEN_MS - 50) this.statusSenden();
  }

  // Anmeldung und Anfragen der Stats-PCs
  steuerung(buf, rinfo) {
    const p = lesePaket(buf);
    if (!p || p.teile !== 1) return;
    let m;
    try { m = new Zusammensetzer().nimm(p); } catch { return; }
    if (!m) return;
    const o = m.obj || {};
    if (m.art === 'abo') {
      // Ein Stats-PC meldet sich evtl. über mehrere Adressen (von Hand, aus dem Lebenszeichen): zählt einmal, mit der letzten
      const key = o.id ? `id:${String(o.id).slice(0, 20)}` : `${rinfo.address}:${rinfo.port}`;
      const neu = !this.empfaenger.has(key);
      const x = { id: String(o.id || '').slice(0, 20), name: String(o.name || rinfo.address).slice(0, 60), ip: rinfo.address, port: rinfo.port, multicast: !!o.multicast, version: String(o.v || ''), t: Date.now(), app: String(o.app || '').slice(0, 20) };
      const vorher = this.empfaenger.get(key);
      this.empfaenger.set(key, x);
      if (neu || vorher.multicast !== x.multicast || vorher.ip !== x.ip) this.onChange?.();
      // Neu oder ohne Multicast: Stand gleich per Unicast, damit nichts wartet
      if (neu && !x.multicast && this.letzterStatus) this.senden('status', this.letzterStatus, { address: rinfo.address, port: this.lauf.port });
    } else if (m.art === 'anfrage' && o.was === 'cfg' && this.cfg) {
      this.senden('cfg', { v: this.cfgVersion, cfg: this.cfg }, { address: rinfo.address, port: this.lauf.port });
    }
  }

  info() {
    const jetzt = Date.now();
    return {
      an: !!this.einstellungen().an, laeuft: !!this.sock, fehler: this.fehler, gruppe: this.lauf?.gruppe || '', port: this.lauf?.port || 0, ip: this.lauf?.ip || '',
      version: this.cfgVersion, pakete: this.gesendet, bytes: this.bytes,
      empfaenger: [...this.empfaenger.values()].map((x) => ({ name: x.name, ip: x.ip, multicast: x.multicast, layout: x.version === this.cfgVersion, alter: jetzt - x.t, app: x.app })),
    };
  }
}

class StatsEmpfaenger {
  // opts: einstellungen() → { regie, gruppe, port }, ip() → IP der gewählten Karte, regieAdressen() → IPs aus der Session-Suche,
  // onCfg(cfg), onStatus({ status, log }), onEvent(ev), onChange()
  constructor(opts) {
    Object.assign(this, opts);
    this.id = zufallsId().toString(16);
    this.sock = null; this.fehler = '';
    this.zs = new Zusammensetzer();
    this.regie = null; // { ip, name, v, t } aus dem Lebenszeichen
    this.cfgVersion = ''; this.letzteAnfrage = 0;
    this.multicastT = 0; this.unicastT = 0; this.letztesT = 0; this.statusT = 0;
    this.pakete = 0; this.verworfen = 0;
    this.sender = null; // ID der Regie, deren Nachrichten zählen (die zuletzt gehörte)
    this.timer = null; this.lauf = null;
  }

  async start() {
    await this.stop();
    const e = this.einstellungen();
    const lauf = this.lauf = { gruppe: e.gruppe, port: e.port, ip: this.ip() || '' };
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    sock.on('error', (err) => { this.fehler = err.message; this.onChange?.(); });
    sock.on('message', (buf, rinfo) => this.paket(buf, rinfo));
    try {
      await new Promise((ok, nein) => { sock.once('error', nein); sock.bind(e.port, () => { sock.off('error', nein); ok(); }); });
      this.sock = sock;
      this.fehler = '';
      this.gruppeBeitreten();
    } catch (err) {
      this.fehler = `Port ${e.port} belegt: ${err.message}`;
      try { sock.close(); } catch {}
      this.onChange?.();
      return;
    }
    this.timer = setInterval(() => this.anmelden(), ABO_MS);
    this.anmelden();
    this.onChange?.();
  }

  // Multicast auf der gewählten Karte, sonst auf allen Karten (einige Systeme nehmen ohne Angabe nur die erste)
  gruppeBeitreten() {
    const ips = this.lauf.ip ? [this.lauf.ip] : Object.values(os.networkInterfaces()).flat().filter((a) => a && (a.family === 'IPv4' || a.family === 4) && !a.internal).map((a) => a.address);
    let ok = 0;
    for (const ip of ips.length ? ips : [undefined]) { try { this.sock.addMembership(this.lauf.gruppe, ip); ok++; } catch {} }
    if (!ok) try { this.sock.addMembership(this.lauf.gruppe); } catch (err) { this.fehler = `Multicast: ${err.message} (Unicast geht weiter)`; }
  }

  async stop() {
    clearInterval(this.timer); this.timer = null;
    if (this.sock) { const s = this.sock; this.sock = null; await new Promise((r) => { try { s.close(r); } catch { r(); } }); }
  }

  paket(buf, rinfo) {
    const p = lesePaket(buf);
    if (!p) return;
    const jetzt = Date.now();
    if (p.weg === 'multicast') this.multicastT = jetzt; else this.unicastT = jetzt;
    this.letztesT = jetzt; this.pakete++;
    // Mehrere Regien im Netz: es bleibt bei der ersten, bis von ihr 5 s nichts mehr kommt
    const m = this.zs.nimm(p, jetzt);
    if (!m) return;
    if (m.art === 'beacon') {
      if (this.sender != null && m.sender !== this.sender && this.regie && jetzt - this.regie.t < 5000) { this.verworfen++; return; }
      if (m.sender !== this.sender) this.cfgVersion = '';
      this.sender = m.sender;
      this.regie = { ip: rinfo.address, name: String(m.obj.name || ''), v: String(m.obj.v || ''), t: jetzt };
      if (this.regie.v && this.regie.v !== this.cfgVersion) this.layoutHolen();
      this.onChange?.();
      return;
    }
    if (this.sender != null && m.sender !== this.sender) { this.verworfen++; return; }
    if (m.art === 'status') { this.statusT = jetzt; this.onStatus?.(m.obj); }
    else if (m.art === 'event') this.onEvent?.(m.obj);
    else if (m.art === 'cfg' && m.obj?.cfg) { this.cfgVersion = String(m.obj.v || ''); this.onCfg?.(m.obj.cfg); this.onChange?.(); }
  }

  layoutHolen() {
    const jetzt = Date.now();
    if (jetzt - this.letzteAnfrage < 1000 || !this.regie) return;
    this.letzteAnfrage = jetzt;
    this.steuern('anfrage', { was: 'cfg', id: this.id }, [this.regie.ip]);
  }

  // Anmeldung bei der Regie: Adresse von Hand, aus dem Lebenszeichen und aus der Session-Suche
  anmelden() {
    const jetzt = Date.now();
    const ziele = new Set([this.einstellungen().regie, this.regie && jetzt - this.regie.t < 10000 ? this.regie.ip : '', ...(this.regieAdressen?.() || [])].filter(Boolean));
    this.steuern('abo', { id: this.id, name: os.hostname(), multicast: jetzt - this.multicastT < FRISCH_MS, v: this.cfgVersion, app: this.app || '' }, [...ziele]);
    if (this.regie?.v && this.regie.v !== this.cfgVersion) this.layoutHolen();
    this.onChange?.();
  }

  steuern(art, obj, ziele) {
    if (!this.sock) return;
    for (const ip of ziele) for (const p of verpacken(art, 0, Date.now() & 0xffffffff, obj, 'unicast')) this.sock.send(p, this.lauf.port + 1, ip, () => {});
  }

  info() {
    const jetzt = Date.now();
    const mc = jetzt - this.multicastT < FRISCH_MS, uc = jetzt - this.unicastT < FRISCH_MS;
    return {
      laeuft: !!this.sock, fehler: this.fehler, gruppe: this.lauf?.gruppe || '', port: this.lauf?.port || 0, ip: this.lauf?.ip || '',
      verbunden: jetzt - this.letztesT < FRISCH_MS && !!this.regie, weg: mc ? 'multicast' : uc ? 'unicast' : '',
      regie: this.regie ? { ip: this.regie.ip, name: this.regie.name } : null, layout: !!this.cfgVersion && this.cfgVersion === this.regie?.v,
      letztes: this.letztesT ? jetzt - this.letztesT : null, pakete: this.pakete, verworfen: this.verworfen,
    };
  }
}

module.exports = { StatsSender, StatsEmpfaenger };
