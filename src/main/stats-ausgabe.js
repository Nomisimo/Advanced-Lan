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
    try {
      const lib = require('@stagetimerio/grandiose');
      // NDI SDK vor dem ersten Sender starten (meldet auch nicht unterstützte CPUs)
      if (lib.isSupportedCPU && !lib.isSupportedCPU()) ndiModul = { fehler: 'Prozessor wird vom NDI SDK nicht unterstützt' };
      else if (lib.initialize && !lib.initialize()) ndiModul = { fehler: 'NDI SDK ließ sich nicht starten' };
      else ndiModul = { lib, version: String(lib.version?.() || '') };
    } catch (e) { ndiModul = { fehler: String(e?.message || e).split('\n')[0] }; }
  }
  return ndiModul;
}

class StatsAusgabe {
  // root: App-Ordner, preload: Pfad zum Preload, getStats(): cfg.regie.stats, aktiv(): läuft Regie oder Standalone, onChange()
  constructor({ root, preload, icon, getStats, aktiv, onChange, onFensterZu }) {
    Object.assign(this, { root, preload, icon, getStats, aktiv, onChange: onChange || (() => {}), onFensterZu: onFensterZu || (() => {}) });
    this.fenster = null;
    this.ndiWin = null;
    this.sender = null;
    this.ndiFehler = '';
    this.ndiName = '';
    this.busy = false;
    this.letztes = null; // letztes Bild { data, xres, yres }
    this.letztesT = 0;
    this.verbindungen = 0;
    this.bilder = 0; // gesendete Bilder seit dem Start, zur Anzeige im Setup
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
    this.fenster.on('closed', () => { this.fenster = null; this.onChange(); this.onFensterZu(); });
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
        name: 'stats-ndi', show: false, width: NDI_BREITE, height: NDI_HOEHE, useContentSize: true, frame: false, backgroundColor: '#131118',
        webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, preload: this.preload, backgroundThrottling: false },
      });
      this.ndiWin = win;
      // Fenster werden beim Anlegen auf den Bildschirm begrenzt (Laptop, 1366×768, Skalierung 150 %): danach auf 1920×1080 setzen
      this.groesse();
      win.webContents.setFrameRate(NDI_FPS);
      win.webContents.on('paint', (_e, _dirty, image) => this.bild(image));
      // Malen ausdrücklich starten und das erste Bild erzwingen, auch wenn sich nichts bewegt
      win.webContents.on('did-finish-load', () => { if (win.isDestroyed()) return; win.webContents.startPainting(); win.webContents.invalidate(); });
      win.on('closed', () => { if (this.ndiWin === win) this.ndiWin = null; });
      this.seite(win);
      const start = Date.now();
      let gemeldet = 0;
      // Ohne Änderung malt das Fenster nichts: das letzte Bild jede Sekunde wiederholen, damit Empfänger nicht abbrechen
      this.tick = setInterval(() => {
        this.groesse();
        if (this.letztes && Date.now() - this.letztesT > 900) this.senden(this.letztes);
        // Kommt kein Bild, das sagen statt still nichts zu senden
        if (!this.letztes && Date.now() - start > 4000 && !this.ndiFehler) { this.ndiFehler = 'Kein Bild vom Stats-Screen (Offscreen-Fenster malt nicht)'; this.ndiWin?.webContents.invalidate(); this.onChange(); }
        if (this.letztes && this.ndiFehler.startsWith('Kein Bild')) { this.ndiFehler = ''; this.onChange(); }
        if (this.bilder !== gemeldet) { gemeldet = this.bilder; this.onChange(); }
        try { const v = this.sender?.connections?.(); if (Number.isFinite(v) && v !== this.verbindungen) { this.verbindungen = v; this.onChange(); } } catch {}
      }, 1000);
    })();
    await this.startet;
    this.startet = null;
    this.onChange();
  }

  // Offscreen-Fenster immer genau 1920×1080 groß halten (auch nach Bildschirmwechsel)
  groesse() {
    const w = this.ndiWin;
    if (!w || w.isDestroyed()) return;
    const [b, h] = w.getContentSize();
    if (b !== NDI_BREITE || h !== NDI_HOEHE) w.setContentSize(NDI_BREITE, NDI_HOEHE);
  }

  bild(image) {
    if (!this.sender || image.isEmpty()) return;
    let { width, height } = image.getSize();
    // Sicherheitsnetz: falsche Größe auf 1920×1080 bringen, damit Empfänger immer das angekündigte Format bekommen
    if (width !== NDI_BREITE || height !== NDI_HOEHE) { image = image.resize({ width: NDI_BREITE, height: NDI_HOEHE }); ({ width, height } = image.getSize()); }
    // toBitmap: Pixel in BGRA, wie NDI sie mit FOURCC_BGRA erwartet
    this.senden({ data: image.toBitmap(), xres: width, yres: height });
  }

  senden(f) {
    this.letztes = f;
    this.letztesT = Date.now();
    if (this.busy || !this.sender) return; // NDI noch beim letzten Bild: dieses auslassen
    const lib = ladeNdi().lib;
    this.busy = true;
    this.bilder++;
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
    this.sender = null; this.letztes = null; this.verbindungen = 0; this.ndiName = ''; this.bilder = 0;
    if (s) { try { await s.destroy(); } catch {} }
    if (!this.getStats().ndi || !this.aktiv()) this.ndiFehler = '';
  }

  async beenden() { this.fensterSchliessen(); await this.ndiStoppen(); }

  status() {
    const m = ndiModul || (this.getStats().ndi ? ladeNdi() : null);
    return {
      fenster: !!(this.fenster && !this.fenster.isDestroyed()),
      ndi: { verfuegbar: m ? !!m.lib : null, laeuft: !!this.sender, name: this.ndiName, verbindungen: this.verbindungen, bilder: this.bilder, fehler: this.ndiFehler, aufloesung: `${NDI_BREITE}×${NDI_HOEHE}`, fps: NDI_FPS, version: m?.version || '' },
    };
  }

  // Ist NDI auf diesem PC nutzbar? (lädt die Bibliothek, für die Anzeige im Setup)
  ndiVerfuegbar() { const m = ladeNdi(); return { verfuegbar: !!m.lib, fehler: m.fehler || '' }; }
}

module.exports = { StatsAusgabe, NDI_BREITE, NDI_HOEHE };
