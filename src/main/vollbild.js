// Beobachtet unter Windows, ob ein Spiel im exklusiven Vollbild läuft (siehe src/core/vollbild.js).
// Ein PowerShell-Prozess im Hintergrund fragt den Zustand ab, ohne native Erweiterung. Auf macOS und Linux immer "".
const { spawn } = require('child_process');
const { vollbildArt, vollbildSkript } = require('../core/vollbild');

// Für powershell -EncodedCommand: UTF-16LE als Base64, dann gibt es keine Probleme mit Anführungszeichen
const kodiert = (skript) => Buffer.from(skript, 'utf16le').toString('base64');

const NEUSTARTS = 5;

class VollbildWaechter {
  // onChange(art): "exklusiv", "vollbild" oder ""
  constructor({ onChange } = {}) {
    this.onChange = onChange || (() => {});
    this.art = '';
    this.proc = null;
    this.an = false;
    this.neustarts = 0;
    this.retry = null;
    this.fehler = '';
  }

  get exklusiv() { return this.art === 'exklusiv'; }

  start() {
    if (process.platform !== 'win32' || this.an) return;
    this.an = true;
    this.neustarts = 0;
    this.starten();
  }

  starten() {
    if (!this.an) return;
    let p;
    try {
      p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', kodiert(vollbildSkript(process.pid))], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { this.fehler = e.message; return; }
    this.proc = p;
    let rest = '';
    p.stdout.on('data', (d) => {
      rest += String(d);
      const zeilen = rest.split(/\r?\n/);
      rest = zeilen.pop();
      const letzte = zeilen.filter(Boolean).pop();
      if (letzte != null) { this.neustarts = 0; this.fehler = ''; this.setze(vollbildArt(letzte.trim())); }
    });
    p.stderr.on('data', (d) => { this.fehler = String(d).trim().slice(0, 200); });
    p.on('error', (e) => { this.fehler = e.message; });
    p.on('exit', () => {
      if (this.proc !== p) return;
      this.proc = null;
      this.setze('');
      // Abgestürzt oder von Antivirus beendet: ein paar Mal neu versuchen, dann aufgeben (Overlay läuft trotzdem)
      if (this.an && ++this.neustarts <= NEUSTARTS) this.retry = setTimeout(() => this.starten(), 5000 * this.neustarts);
    });
  }

  setze(art) {
    if (art === this.art) return;
    this.art = art;
    this.onChange(art);
  }

  stop() {
    this.an = false;
    clearTimeout(this.retry);
    const p = this.proc;
    this.proc = null;
    if (p) { try { p.kill(); } catch {} }
    this.setze('');
  }

  status() { return { art: this.art, aktiv: !!this.proc, fehler: this.fehler }; }
}

module.exports = { VollbildWaechter };
