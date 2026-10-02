// Game-PC: verbindet sich mit der Stats API von Rocket League auf demselben PC (WebSocket, Standard 127.0.0.1:49124).
// Läuft das Spiel nicht, wird alle 3 s neu versucht.
const WebSocket = require('ws');

class RlClient {
  constructor({ onNachricht, onChange }) {
    this.onNachricht = onNachricht;
    this.onChange = onChange || (() => {});
    this.ws = null;
    this.port = null;
    this.retry = null;
    this.verbunden = false;
    this.aktiv = false;
  }

  start(port) {
    this.stop();
    this.port = port;
    this.aktiv = true;
    this.aufbauen();
  }

  aufbauen() {
    if (!this.aktiv) return;
    let ws;
    try { ws = new WebSocket(`ws://127.0.0.1:${this.port}`, { handshakeTimeout: 2000 }); }
    catch { return this.spaeter(); }
    this.ws = ws;
    ws.on('open', () => { this.verbunden = true; this.onChange(); });
    ws.on('message', (data) => {
      const text = String(data);
      try { return this.onNachricht(JSON.parse(text)); } catch {}
      // Zur Sicherheit: mehrere JSON-Objekte hintereinander
      for (const teil of text.split(/(?<=\})\s*(?=\{"Event")/)) { try { this.onNachricht(JSON.parse(teil)); } catch {} }
    });
    ws.on('close', () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.verbunden) { this.verbunden = false; this.onChange(); }
      this.spaeter();
    });
    ws.on('error', () => {});
  }

  spaeter() { clearTimeout(this.retry); if (this.aktiv) this.retry = setTimeout(() => this.aufbauen(), 3000); }

  stop() {
    this.aktiv = false;
    clearTimeout(this.retry);
    const ws = this.ws;
    this.ws = null;
    this.verbunden = false;
    if (ws) { try { ws.terminate(); } catch {} }
  }

  status() { return { verbunden: this.verbunden, port: this.port }; }
}

module.exports = { RlClient };
