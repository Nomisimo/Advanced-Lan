// Game-Stats-Screens der Regie: jeder Screen als Pop-out-Fenster (z. B. auf einem zweiten Bildschirm oder Beamer) und als eigene NDI-Quelle.
// Alle zeigen dieselbe Seite (index.html#stats=<id>). Für NDI rendert je Screen ein unsichtbares Offscreen-Fenster die Seite
// in der Größe des Screens (z. B. 1920×1080 oder nur 400×120 für ein einzelnes Element), jedes Bild geht als BGRA an das NDI SDK
// (Paket @stagetimerio/grandiose, optional: fehlt es, ist NDI nicht verfügbar). Transparenter Hintergrund = NDI mit Alpha-Kanal.
const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { kartenListe, karteFuer, ndiKonfig } = require('../core/netzwerk');
const { screenVon, statsHash, alphaGerade } = require('../core/stats-screens');

const NDI_FPS = 30;

// Netzwerkkarte für NDI: das SDK liest beim Start eine ndi-config.v1.json (Verzeichnis aus NDI_CONFIG_DIR).
// Wir schreiben eine eigene Datei mit der gewählten Karte (adapters.allowed) und übernehmen die Einstellungen
// des PCs (z. B. Discovery-Server). Das SDK liest sie nur einmal: eine andere Karte gilt nach einem Neustart der App.
let ndiNetz = { karte: () => '', ordner: () => '' };
const NDI_SYSTEM_KONFIG = () => (process.platform === 'win32'
  ? path.join(process.env.ProgramData || 'C:\\ProgramData', 'NDI', 'ndi-config.v1.json')
  : path.join(os.homedir(), '.ndi', 'ndi-config.v1.json'));
function ndiKarteSetzen() {
  const name = ndiNetz.karte() || '';
  const k = name ? karteFuer(kartenListe(os.networkInterfaces()), name) : null;
  const aktiv = { gewaehlt: name, name: k ? name : '', ip: k?.ip || '', fehler: name && !k ? `Netzwerkkarte „${name}“ nicht verbunden, NDI nutzt alle Karten` : '' };
  const ordner = ndiNetz.ordner();
  if (!ordner) return aktiv;
  try {
    let basis = {};
    try { basis = JSON.parse(fs.readFileSync(NDI_SYSTEM_KONFIG(), 'utf8')); } catch { /* keine Konfiguration auf dem PC */ }
    fs.mkdirSync(ordner, { recursive: true });
    fs.writeFileSync(path.join(ordner, 'ndi-config.v1.json'), JSON.stringify(ndiKonfig(basis, aktiv.ip), null, 2));
    process.env.NDI_CONFIG_DIR = ordner;
  } catch (e) { aktiv.fehler = `NDI-Konfiguration nicht geschrieben: ${e.message}`; }
  return aktiv;
}

// NDI-Bibliothek erst bei Bedarf laden: native Erweiterung, wird beim Installieren gebaut und kann fehlen
let ndiModul;
function ladeNdi() {
  if (ndiModul === undefined) {
    const karte = ndiKarteSetzen();
    try {
      const lib = require('@stagetimerio/grandiose');
      // NDI SDK vor dem ersten Sender starten (meldet auch nicht unterstützte CPUs)
      if (lib.isSupportedCPU && !lib.isSupportedCPU()) ndiModul = { fehler: 'Prozessor wird vom NDI SDK nicht unterstützt' };
      else if (lib.initialize && !lib.initialize()) ndiModul = { fehler: 'NDI SDK ließ sich nicht starten' };
      else ndiModul = { lib, version: String(lib.version?.() || '') };
    } catch (e) { ndiModul = { fehler: String(e?.message || e).split('\n')[0] }; }
    ndiModul.karte = karte;
  }
  return ndiModul;
}

// Pop-out-Fenster in der Größe des Screens, höchstens 1280×720 (Seitenverhältnis bleibt)
function fensterGroesse(s) {
  const f = Math.min(1, 1280 / s.b, 720 / s.h);
  return { width: Math.max(160, Math.round(s.b * f)), height: Math.max(90, Math.round(s.h * f)) };
}

// Ein Screen: Pop-out-Fenster und NDI-Sender
class ScreenAusgabe {
  constructor(eltern, id) {
    this.e = eltern;
    this.id = id;
    this.fenster = null;
    this.ndiWin = null;
    this.sender = null;
    this.ndiFehler = '';
    this.ndiName = '';
    this.transparent = false; // Offscreen-Fenster mit Alpha-Kanal angelegt
    this.busy = false;
    this.letztes = null; // letztes Bild { data, xres, yres }
    this.letztesT = 0;
    this.verbindungen = 0;
    this.bilder = 0; // gesendete Bilder seit dem Start, zur Anzeige im Setup
    this.tick = null;
    this.startet = null;
  }

  cfg() { return (this.e.getStats().screens || []).find((s) => s.id === this.id) || null; }
  groesseSoll() { const s = this.cfg(); return s ? { b: s.b, h: s.h } : { b: 1920, h: 1080 }; }
  alpha() { return this.cfg()?.layout?.hintergrund === 'transparent'; }

  webContents() { return [this.fenster, this.ndiWin].filter((w) => w && !w.isDestroyed()).map((w) => w.webContents); }

  fensterOeffnen() {
    const s = this.cfg();
    if (!s) return false;
    if (this.fenster && !this.fenster.isDestroyed()) { if (this.fenster.isMinimized()) this.fenster.restore(); this.fenster.show(); this.fenster.focus(); return true; }
    this.fenster = new BrowserWindow({
      ...fensterGroesse(s), minWidth: 120, minHeight: 60, title: `Advanced LAN · ${s.name}`, backgroundColor: '#000000', icon: this.e.icon,
      webPreferences: { contextIsolation: true, nodeIntegration: false, preload: this.e.preload },
    });
    this.fenster.setMenuBarVisibility(false);
    this.e.seite(this.fenster, statsHash(this.id));
    this.fenster.on('page-title-updated', (ev) => ev.preventDefault());
    this.fenster.on('closed', () => { this.fenster = null; this.e.onChange(); this.e.onFensterZu(); });
    this.e.onChange();
    return true;
  }

  fensterSchliessen() { if (this.fenster && !this.fenster.isDestroyed()) this.fenster.close(); this.fenster = null; }

  async ndiStarten(name) {
    name = name || 'Advanced LAN Stats';
    if (this.startet) await this.startet;
    // Name geändert oder Hintergrund zwischen deckend und transparent gewechselt: Sender neu starten
    if (this.sender && this.ndiName === name && this.transparent === this.alpha()) return;
    await this.ndiStoppen(true);
    const m = ladeNdi();
    if (!m.lib) { this.ndiFehler = `NDI nicht verfügbar: ${m.fehler}`; return; }
    this.startet = (async () => {
      try {
        this.sender = await m.lib.send({ name, clockVideo: false, clockAudio: false });
        this.ndiName = name;
        this.ndiFehler = '';
      } catch (e) { this.sender = null; this.ndiFehler = `NDI-Sender nicht gestartet: ${e?.message || e}`; return; }
      // Unsichtbares Fenster, das die Seite in der Größe des Screens rendert und jedes Bild meldet
      const { b, h } = this.groesseSoll();
      this.transparent = this.alpha();
      const win = new BrowserWindow({
        name: `stats-ndi-${this.id}`, show: false, width: b, height: h, useContentSize: true, frame: false,
        transparent: this.transparent, backgroundColor: this.transparent ? '#00000000' : '#131118',
        webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, preload: this.e.preload, backgroundThrottling: false },
      });
      this.ndiWin = win;
      // Fenster werden beim Anlegen auf den Bildschirm begrenzt (Laptop, 1366×768, Skalierung 150 %): danach auf die Größe setzen
      this.groesse();
      win.webContents.setFrameRate(NDI_FPS);
      win.webContents.on('paint', (_e, _dirty, image) => this.bild(image));
      // Malen ausdrücklich starten und das erste Bild erzwingen, auch wenn sich nichts bewegt
      win.webContents.on('did-finish-load', () => { if (win.isDestroyed()) return; win.webContents.startPainting(); win.webContents.invalidate(); });
      win.on('closed', () => { if (this.ndiWin === win) this.ndiWin = null; });
      this.e.seite(win, statsHash(this.id, true));
      const start = Date.now();
      let gemeldet = 0;
      // Ohne Änderung malt das Fenster nichts: das letzte Bild jede Sekunde wiederholen, damit Empfänger nicht abbrechen
      this.tick = setInterval(() => {
        // Größe des Screens geändert: Fenster anpassen und neu malen
        if (this.groesse()) this.ndiWin?.webContents.invalidate();
        if (this.letztes && Date.now() - this.letztesT > 900) this.senden(this.letztes);
        // Kommt kein Bild, das sagen statt still nichts zu senden
        if (!this.letztes && Date.now() - start > 4000 && !this.ndiFehler) { this.ndiFehler = 'Kein Bild vom Stats-Screen (Offscreen-Fenster malt nicht)'; this.ndiWin?.webContents.invalidate(); this.e.onChange(); }
        if (this.letztes && this.ndiFehler.startsWith('Kein Bild')) { this.ndiFehler = ''; this.e.onChange(); }
        if (this.bilder !== gemeldet) { gemeldet = this.bilder; this.e.onChange(); }
        try { const v = this.sender?.connections?.(); if (Number.isFinite(v) && v !== this.verbindungen) { this.verbindungen = v; this.e.onChange(); } } catch {}
      }, 1000);
    })();
    await this.startet;
    this.startet = null;
    this.e.onChange();
  }

  // Offscreen-Fenster immer genau in der Größe des Screens halten (auch nach Bildschirmwechsel). → true, wenn geändert
  groesse() {
    const w = this.ndiWin;
    if (!w || w.isDestroyed()) return false;
    const { b, h } = this.groesseSoll();
    const [ib, ih] = w.getContentSize();
    if (ib === b && ih === h) return false;
    w.setContentSize(b, h);
    return true;
  }

  bild(image) {
    if (!this.sender || image.isEmpty()) return;
    const soll = this.groesseSoll();
    let { width, height } = image.getSize();
    // Sicherheitsnetz: falsche Größe (z. B. Skalierung des Bildschirms) auf die Größe des Screens bringen,
    // damit Empfänger immer das angekündigte Format bekommen
    if (width !== soll.b || height !== soll.h) { image = image.resize({ width: soll.b, height: soll.h }); ({ width, height } = image.getSize()); }
    // toBitmap: Pixel in BGRA, wie NDI sie mit FOURCC_BGRA erwartet; mit Alpha: Chromium liefert vormultipliziert, NDI will gerade
    const data = image.toBitmap();
    this.senden({ data: this.transparent ? alphaGerade(data) : data, xres: width, yres: height });
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
    })).catch((e) => { this.ndiFehler = `NDI: ${e?.message || e}`; this.e.onChange(); }).finally(() => { this.busy = false; });
  }

  // neustart: gleich wieder starten, Fehler stehen lassen
  async ndiStoppen(neustart) {
    clearInterval(this.tick); this.tick = null;
    if (this.ndiWin && !this.ndiWin.isDestroyed()) this.ndiWin.destroy();
    this.ndiWin = null;
    const s = this.sender;
    this.sender = null; this.letztes = null; this.verbindungen = 0; this.ndiName = ''; this.bilder = 0;
    if (s) { try { await s.destroy(); } catch {} }
    if (!neustart && (!this.cfg()?.ndi || !this.e.aktiv())) this.ndiFehler = '';
  }

  async beenden() { this.fensterSchliessen(); await this.ndiStoppen(); this.ndiFehler = ''; }

  status() {
    const { b, h } = this.groesseSoll();
    return {
      fenster: !!(this.fenster && !this.fenster.isDestroyed()),
      ndi: { laeuft: !!this.sender, name: this.ndiName, verbindungen: this.verbindungen, bilder: this.bilder, fehler: this.ndiFehler, aufloesung: `${b}×${h}`, fps: NDI_FPS, alpha: this.transparent && !!this.sender },
    };
  }
}

class StatsAusgabe {
  // root: App-Ordner, preload: Pfad zum Preload, getStats(): cfg.regie.stats, aktiv(): läuft Regie oder Standalone, onChange()
  constructor({ root, preload, icon, getStats, aktiv, onChange, onFensterZu, ndiKarte, ndiOrdner }) {
    Object.assign(this, { root, preload, icon, getStats, aktiv, onChange: onChange || (() => {}), onFensterZu: onFensterZu || (() => {}) });
    if (ndiKarte) ndiNetz = { karte: ndiKarte, ordner: ndiOrdner || (() => '') };
    this.screens = new Map(); // id → ScreenAusgabe
  }

  seite(win, hash) { return win.loadFile(path.join(this.root, 'dist-app', 'index.html'), { hash }); }

  screen(id) {
    const s = screenVon(this.getStats(), id);
    if (!s) return null;
    if (!this.screens.has(s.id)) this.screens.set(s.id, new ScreenAusgabe(this, s.id));
    return this.screens.get(s.id);
  }

  // Alle Fenster mit einem Stats-Screen: bekommen Status und Events wie das Hauptfenster
  webContents() { return [...this.screens.values()].flatMap((s) => s.webContents()); }

  // Einstellungen anwenden: NDI je Screen starten/stoppen, ohne Stats-Screen alle Fenster schließen, gelöschte Screens beenden
  async anwenden() {
    const st = this.getStats(), an = this.aktiv() && st.an;
    const liste = st.screens || [];
    for (const [id, s] of this.screens) if (!an || !liste.some((x) => x.id === id)) { s.fensterSchliessen(); if (!liste.some((x) => x.id === id)) { await s.beenden(); this.screens.delete(id); } }
    for (const c of liste) {
      const s = this.screen(c.id);
      if (an && c.ndi) await s.ndiStarten(c.ndiName);
      else await s.ndiStoppen();
      // Name im Fenstertitel aktuell halten
      if (s.fenster && !s.fenster.isDestroyed()) s.fenster.setTitle(`Advanced LAN · ${c.name}`);
    }
    this.onChange();
  }

  // id: Screen, ohne Angabe der erste
  fensterOeffnen(id) {
    if (!this.aktiv() || !this.getStats().an) return false;
    return this.screen(id)?.fensterOeffnen() || false;
  }

  fensterSchliessen(id) {
    if (id === undefined) { for (const s of this.screens.values()) s.fensterSchliessen(); return; }
    this.screen(id)?.fensterSchliessen();
  }

  // Vollbild für das Pop-out-Fenster, aus dem der Doppelklick kam
  vollbild(webContents) {
    for (const s of this.screens.values()) {
      const f = s.fenster;
      if (f && !f.isDestroyed() && (!webContents || f.webContents === webContents)) { f.setFullScreen(!f.isFullScreen()); return; }
    }
  }

  async beenden() { for (const s of this.screens.values()) await s.beenden(); }

  status() {
    const st = this.getStats();
    const m = ndiModul || ((st.screens || []).some((s) => s.ndi) ? ladeNdi() : null);
    const screens = {};
    for (const c of st.screens || []) screens[c.id] = this.screen(c.id).status();
    const alle = Object.values(screens);
    const erster = screens[st.screens?.[0]?.id];
    return {
      // fenster: Fenster des ersten Screens (Knopf „Stats“ in der Kopfzeile); offen: Anzahl offener Fenster
      fenster: !!erster?.fenster, offen: alle.filter((s) => s.fenster).length,
      ndi: { verfuegbar: m ? !!m.lib : null, laeuft: alle.some((s) => s.ndi.laeuft), sender: alle.filter((s) => s.ndi.laeuft).length, fps: NDI_FPS, version: m?.version || '',
        // Karte, mit der NDI gestartet ist; neustart: in den Einstellungen steht inzwischen eine andere
        karte: m?.karte?.name || '', ip: m?.karte?.ip || '', karteFehler: m?.karte?.fehler || '', neustart: !!m?.karte && m.karte.gewaehlt !== (ndiNetz.karte() || '') },
      screens,
    };
  }

  // Ist NDI auf diesem PC nutzbar? (lädt die Bibliothek, für die Anzeige im Setup)
  ndiVerfuegbar() { const m = ladeNdi(); return { verfuegbar: !!m.lib, fehler: m.fehler || '' }; }
}

module.exports = { StatsAusgabe };
