// Game-Stats-Screen der Regie: als Pop-out-Fenster (z. B. auf einem zweiten Bildschirm oder Beamer) und als NDI-Stream.
// Beide zeigen dieselbe Seite (index.html#stats). Für NDI rendert ein unsichtbares Offscreen-Fenster die Seite in 1920×1080,
// jedes Bild geht als BGRA an das NDI SDK (Paket @stagetimerio/grandiose, optional: fehlt es, ist NDI nicht verfügbar).
const { BrowserWindow } = require('electron');
const path = require('path');

const NDI_BREITE = 1920, NDI_HOEHE = 1080, NDI_FPS = 30;

// NDI-Bibliothek erst bei Bedarf laden: native Erweiterung, wird beim Installieren gebaut und kann fehlen
let ndiModul;
function ladeNdi() {
  if (ndiModul === undefined) {
    try { ndiModul = { lib: require('@stagetimerio/grandiose') }; }
    catch (e) { ndiModul = { fehler: String(e?.message || e).split('\n')[0] }; }
  }
  return ndiModul;
}

class StatsAusgabe {
  // root: App-Ordner, preload: Pfad zum Preload, getStats(): cfg.regie.stats, aktiv(): läuft Regie oder Standalone, onChange()
  constructor({ root, preload, icon, getStats, aktiv, onChange }) {
    Object.assign(this, { root, preload, icon, getStats, aktiv, onChange: onChange || (() => {}) });
    this.fenster = null;
    this.ndiWin = null;
    this.sender = null;
    this.ndiFehler = '';
    this.ndiName = '';
    this.busy = false;
    this.letztes = null; // letztes Bild { data, xres, yres }
    this.letztesT = 0;
    this.verbindungen = 0;
    this.tick = null;
    this.startet = null;
  }

  seite(win) { return win.loadFile(path.join(this.root, 'dist-app', 'index.html'), { hash: 'stats' }); }

  // Alle Fenster mit dem Stats-Screen: bekommen Status und Events wie das Hauptfenster
  webContents() { return [this.fenster, this.ndiWin].filter((w) => w && !w.isDestroyed()).map((w) => w.webContents); }

  // Einstellungen anwenden: NDI starten/stoppen, ohne Stats-Screen auch das Fenster schließen
  async anwenden() {
    const s = this.getStats(), an = this.aktiv() && s.an;
    if (!an) this.fensterSchliessen();
    if (an && s.ndi) await this.ndiStarten(s.ndiName);
    else await this.ndiStoppen();
    this.onChange();
  }

  fensterOeffnen() {
    if (!this.aktiv() || !this.getStats().an) return false;
    if (this.fenster && !this.fenster.isDestroyed()) { if (this.fenster.isMinimized()) this.fenster.restore(); this.fenster.show(); this.fenster.focus(); return true; }
    this.fenster = new BrowserWindow({
      width: 1280, height: 720, minWidth: 480, minHeight: 270, title: 'Advanced LAN · Game Stats', backgroundColor: '#131118', icon: this.icon,
      webPreferences: { contextIsolation: true, nodeIntegration: false, preload: this.preload },
    });
    this.fenster.setMenuBarVisibility(false);
    this.seite(this.fenster);
    this.fenster.on('closed', () => { this.fenster = null; this.onChange(); });
    this.onChange();
    return true;
  }

  fensterSchliessen() { if (this.fenster && !this.fenster.isDestroyed()) this.fenster.close(); this.fenster = null; }

  vollbild() { if (this.fenster && !this.fenster.isDestroyed()) this.fenster.setFullScreen(!this.fenster.isFullScreen()); }

  async ndiStarten(name) {
    name = name || 'Advanced LAN Stats';
    if (this.startet) await this.startet;
    if (this.sender && this.ndiName === name) return;
    await this.ndiStoppen();
    const m = ladeNdi();
    if (!m.lib) { this.ndiFehler = `NDI nicht verfügbar: ${m.fehler}`; return; }
    this.startet = (async () => {
      try {
        this.sender = await m.lib.send({ name, clockVideo: false, clockAudio: false });
        this.ndiName = name;
        this.ndiFehler = '';
      } catch (e) { this.sender = null; this.ndiFehler = `NDI-Sender nicht gestartet: ${e?.message || e}`; return; }
      // Unsichtbares Fenster, das die Seite in voller Größe rendert und jedes Bild meldet
      const win = new BrowserWindow({
        show: false, width: NDI_BREITE, height: NDI_HOEHE, useContentSize: true, frame: false, backgroundColor: '#131118',
        webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, preload: this.preload, backgroundThrottling: false },
      });
      this.ndiWin = win;
      win.webContents.setFrameRate(NDI_FPS);
      win.webContents.on('paint', (_e, _dirty, image) => this.bild(image));
      win.on('closed', () => { if (this.ndiWin === win) this.ndiWin = null; });
      this.seite(win);
      // Ohne Änderung malt das Fenster nichts: das letzte Bild jede Sekunde wiederholen, damit Empfänger nicht abbrechen
      this.tick = setInterval(() => {
        if (this.letztes && Date.now() - this.letztesT > 900) this.senden(this.letztes);
        try { const v = this.sender?.connections?.(); if (Number.isFinite(v) && v !== this.verbindungen) { this.verbindungen = v; this.onChange(); } } catch {}
      }, 1000);
    })();
    await this.startet;
    this.startet = null;
    this.onChange();
  }

  bild(image) {
    if (!this.sender || image.isEmpty()) return;
    const { width, height } = image.getSize();
    // toBitmap: Pixel in BGRA, wie NDI sie mit FOURCC_BGRA erwartet
    this.senden({ data: image.toBitmap(), xres: width, yres: height });
  }

  senden(f) {
    this.letztes = f;
    this.letztesT = Date.now();
    if (this.busy || !this.sender) return; // NDI noch beim letzten Bild: dieses auslassen
    const lib = ladeNdi().lib;
    this.busy = true;
    Promise.resolve(this.sender.video({
      xres: f.xres, yres: f.yres, frameRateN: NDI_FPS * 1000, frameRateD: 1000, pictureAspectRatio: f.xres / f.yres,
      frameFormatType: lib.FORMAT_TYPE_PROGRESSIVE, fourCC: lib.FOURCC_BGRA, lineStrideBytes: f.xres * 4, data: f.data,
    })).catch((e) => { this.ndiFehler = `NDI: ${e?.message || e}`; this.onChange(); }).finally(() => { this.busy = false; });
  }

  async ndiStoppen() {
    clearInterval(this.tick); this.tick = null;
    if (this.ndiWin && !this.ndiWin.isDestroyed()) this.ndiWin.destroy();
    this.ndiWin = null;
    const s = this.sender;
    this.sender = null; this.letztes = null; this.verbindungen = 0; this.ndiName = '';
    if (s) { try { await s.destroy(); } catch {} }
    if (!this.getStats().ndi || !this.aktiv()) this.ndiFehler = '';
  }

  async beenden() { this.fensterSchliessen(); await this.ndiStoppen(); }

  status() {
    const m = ndiModul || (this.getStats().ndi ? ladeNdi() : null);
    return {
      fenster: !!(this.fenster && !this.fenster.isDestroyed()),
      ndi: { verfuegbar: m ? !!m.lib : null, laeuft: !!this.sender, name: this.ndiName, verbindungen: this.verbindungen, fehler: this.ndiFehler, aufloesung: `${NDI_BREITE}×${NDI_HOEHE}`, fps: NDI_FPS },
    };
  }

  // Ist NDI auf diesem PC nutzbar? (lädt die Bibliothek, für die Anzeige im Setup)
  ndiVerfuegbar() { const m = ladeNdi(); return { verfuegbar: !!m.lib, fehler: m.fehler || '' }; }
}

module.exports = { StatsAusgabe, NDI_BREITE, NDI_HOEHE };
