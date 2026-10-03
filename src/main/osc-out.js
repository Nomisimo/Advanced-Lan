// OSC per UDP an grandMA3, Playout und andere Ziele. Ein Socket je Absender-Netzwerkkarte.
const dgram = require('dgram');
const { encodeMessage } = require('../core/osc');

class OscSender {
  constructor() {
    this.socks = new Map(); // lokale IP ('' = automatisch) → Promise<Socket>
  }

  // Socket an die IP der gewählten Karte binden: so gehen die Pakete mit dieser Absenderadresse raus
  socket(lokal = '') {
    if (!this.socks.has(lokal)) {
      const p = new Promise((resolve, reject) => {
        const sock = dgram.createSocket('udp4');
        const weg = () => { try { sock.close(); } catch {} if (this.socks.get(lokal) === p) this.socks.delete(lokal); };
        sock.once('error', (e) => { weg(); reject(e.code === 'EADDRNOTAVAIL' ? new Error(`Netzwerkkarte mit ${lokal} nicht verfügbar`) : e); });
        sock.bind({ address: lokal || undefined, port: 0 }, () => {
          sock.removeAllListeners('error');
          sock.on('error', weg);
          sock.unref();
          resolve(sock);
        });
      });
      p.catch(() => {});
      this.socks.set(lokal, p);
    }
    return this.socks.get(lokal);
  }

  async send({ ziel, address, args, lokal = '' }) {
    const buf = encodeMessage(address, args);
    const port = Number(ziel.port);
    if (!ziel.host || !(port > 0 && port < 65536)) throw new Error('IP oder Port fehlt');
    const sock = await this.socket(lokal);
    return new Promise((resolve, reject) => sock.send(buf, port, ziel.host, (e) => (e ? reject(e) : resolve())));
  }

  close() {
    for (const p of this.socks.values()) p.then((s) => { try { s.close(); } catch {} }, () => {});
    this.socks.clear();
  }
}

module.exports = { OscSender };
