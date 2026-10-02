// OSC per UDP an grandMA3, Playout und andere Ziele
const dgram = require('dgram');
const { encodeMessage } = require('../core/osc');

class OscSender {
  constructor() {
    this.sock = null;
  }

  socket() {
    if (!this.sock) {
      this.sock = dgram.createSocket('udp4');
      this.sock.on('error', () => { try { this.sock.close(); } catch {} this.sock = null; });
      this.sock.unref();
    }
    return this.sock;
  }

  send({ ziel, address, args }) {
    const buf = encodeMessage(address, args);
    const port = Number(ziel.port);
    if (!ziel.host || !(port > 0 && port < 65536)) return Promise.reject(new Error('IP oder Port fehlt'));
    return new Promise((resolve, reject) => {
      this.socket().send(buf, port, ziel.host, (e) => (e ? reject(e) : resolve()));
    });
  }

  close() {
    if (this.sock) { try { this.sock.close(); } catch {} this.sock = null; }
  }
}

module.exports = { OscSender };
