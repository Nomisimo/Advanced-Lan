// Bilderkennung auf dem Game-PC (Valorant, The Finals): ein unsichtbares Fenster nimmt den Bildschirm auf und schickt
// je Bild kleine Signaturen der Bereiche, die der Editor festgelegt hat. Hier werden sie mit den Frames verglichen
// (core/bild-erkennung.js), Texte gelesen (Tesseract.js, Englisch und Deutsch, läuft lokal ohne Internet) und Treffer gemeldet.
// Bildschirmaufnahme über session.setDisplayMediaRequestHandler und desktopCapturer (electron.d.ts von ow-electron).
const { BrowserWindow, desktopCapturer, screen, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { BildErkennung } = require('../core/bild-erkennung');
const { BILD_BY_ID } = require('../core/bild-spiele');

const TEXT_GILT = 2500; // so lange zählt ein gelesener Text

class BildDienst {
  // getCfg(): cfg.gamepc.bild, spiel(): Bild-Spiel, das gerade erkannt werden soll (oder null), onTreffer(spiel, aktion), onChange()
  constructor({ root, preload, getCfg, spiel, onTreffer, onChange }) {
    Object.assign(this, { root, preload, getCfg, spielVon: spiel, onTreffer, onChange: onChange || (() => {}) });
    this.fenster = null;
    this.spiel = null;
    this.erkennung = null;
    this.texte = {}; // Aktion → { text, t }
    this.werte = {};
    this.letzte = {}; // Aktion → Zeitpunkt des letzten Treffers
    this.info = { laeuft: false, fehler: '', leer: false, b: 0, h: 0, bilder: 0, t: 0 };
    this.ocr = null;
    this.ocrLaeuft = 0;
    this.signatur = '';
  }

  // Bildschirme für das Setup: Pixelgröße wie die Aufnahme sie sieht
  bildschirme() {
    const primaer = screen.getPrimaryDisplay().id;
    return screen.getAllDisplays().map((d, i) => ({ id: String(d.id), name: `Bildschirm ${i + 1}${d.id === primaer ? ' (Haupt)' : ''}`, b: Math.round(d.size.width * d.scaleFactor), h: Math.round(d.size.height * d.scaleFactor), primaer: d.id === primaer }));
  }
  bildschirm() {
    const l = this.bildschirme();
    return l.find((d) => d.id === this.getCfg()?.display) || l.find((d) => d.primaer) || l[0] || null;
  }

  // Aufnahme für Erkennung und Editor: immer der eingestellte Bildschirm, ohne Auswahl-Dialog
  einrichten() {
    session.defaultSession.setDisplayMediaRequestHandler(async (_req, antwort) => {
      try {
        const quellen = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
        const ziel = this.bildschirm();
        antwort({ video: quellen.find((q) => q.display_id === ziel?.id) || quellen[0] });
      } catch { antwort({}); }
    });
  }

  // Nach jeder Änderung der Einstellungen oder des aktiven Spiels
  anwenden() {
    const c = this.getCfg();
    if (!c) return;
    const spiel = this.spielVon();
    const aktionen = spiel ? (c.spiele[spiel]?.aktionen || []).filter((a) => a.an && (a.vorlagen.length || a.text)) : [];
    if (!c.an || !spiel || !aktionen.length) return this.stop(spiel && !aktionen.length ? `${BILD_BY_ID[spiel].name}: noch keine Aktionen im Editor` : '');
    const sig = JSON.stringify([spiel, c.display, c.fps, aktionen.map((a) => [a.id, a.region, a.text, a.schwelle, a.pause, a.vorlagen.length])]);
    if (sig === this.signatur && this.fenster) return;
    this.signatur = sig;
    this.spiel = spiel;
    this.aktionen = aktionen;
    // Aktionen mit demselben Bereich bilden eine Gruppe: nur die ähnlichste zählt (z. B. Runde gewonnen/verloren)
    const gruppe = (a) => aktionen.filter((b) => JSON.stringify(b.region) === JSON.stringify(a.region)).length > 1 ? JSON.stringify(a.region) : undefined;
    this.erkennung = new BildErkennung({ aktionen: aktionen.map((a) => ({ id: a.id, gruppe: gruppe(a), pause: a.pause, schwelle: a.schwelle, text: a.text })) });
    this.erkennung.setVorlagen(Object.fromEntries(aktionen.map((a) => [a.id, a.vorlagen.map((v) => v.sig)])));
    this.texte = {}; this.werte = {};
    const start = { fps: c.fps, aktionen: aktionen.map((a) => ({ id: a.id, region: a.region, text: !!a.text })) };
    if (!this.fenster) this.oeffnen(start);
    else this.fenster.webContents.send('erkennung-start', start);
    this.onChange();
  }

  oeffnen(start) {
    this.fenster = new BrowserWindow({
      name: 'erkennung', show: false, width: 320, height: 200, skipTaskbar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, preload: this.preload },
    });
    this.fenster.loadFile(path.join(this.root, 'dist-app', 'erkennung.html'));
    this.fenster.webContents.once('did-finish-load', () => this.fenster?.webContents.send('erkennung-start', start));
    this.fenster.on('closed', () => { this.fenster = null; this.info.laeuft = false; this.onChange(); });
  }

  stop(grund = '') {
    this.signatur = '';
    this.spiel = null;
    if (this.fenster) { this.fenster.destroy(); this.fenster = null; }
    this.info = { ...this.info, laeuft: false, fehler: grund, bilder: 0 };
    this.onChange();
  }

  // Vom Erkennungsfenster: { t, b, h, sigs: { id: Uint8Array }, leer }
  frame(d) {
    if (!this.erkennung || !d) return;
    const now = Date.now();
    const texte = {};
    for (const [id, x] of Object.entries(this.texte)) if (now - x.t < TEXT_GILT) texte[id] = x.text;
    const r = this.erkennung.frame(d.sigs || {}, now, texte);
    this.werte = r.werte;
    Object.assign(this.info, { laeuft: true, fehler: '', leer: !!d.leer, b: d.b, h: d.h, bilder: this.info.bilder + 1, t: now });
    for (const e of r.erkannt) {
      const a = this.aktionen.find((x) => x.id === e.id);
      if (!a) continue;
      this.letzte[a.id] = now;
      this.onTreffer(this.spiel, a);
    }
  }

  meldung(s) { Object.assign(this.info, s || {}); this.onChange(); }

  // Text in einem Bereich lesen (Erkennung und Editor-Test). png: Buffer/Uint8Array eines PNG
  async lesen(png) {
    if (!png) return '';
    if (!this.ocr) this.ocr = this.ocrStarten();
    const w = await this.ocr;
    const r = await w.recognize(Buffer.from(png));
    return String(r.data?.text || '').trim();
  }
  async text(id, png) {
    if (this.ocrLaeuft > 2) return; // nicht stauen: lieber ein Bild auslassen
    this.ocrLaeuft++;
    try { this.texte[id] = { text: await this.lesen(png), t: Date.now() }; }
    catch (e) { this.info.fehler = `Texterkennung: ${e?.message || e}`; }
    finally { this.ocrLaeuft--; }
  }
  async ocrStarten() {
    const { createWorker } = require('tesseract.js');
    // Sprachdaten liegen in der App (scripts/build.js kopiert sie nach dist-ocr), kein Download
    const lang = path.join(this.root, 'dist-ocr');
    const unpacked = lang.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
    return createWorker(['eng', 'deu'], 1, { langPath: fs.existsSync(unpacked) ? unpacked : lang, gzip: true, cacheMethod: 'none' });
  }

  status() {
    const alt = this.info.t ? Date.now() - this.info.t : null;
    return { ...this.info, laeuft: !!this.fenster && alt != null && alt < 3000, spiel: this.spiel, werte: this.werte, letzte: this.letzte, bildschirm: this.bildschirm() };
  }

  async beenden() {
    this.stop();
    if (this.ocr) { try { await (await this.ocr).terminate(); } catch {} this.ocr = null; }
  }
}

module.exports = { BildDienst };
