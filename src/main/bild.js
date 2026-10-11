// Bilderkennung auf dem Game-PC (Valorant, The Finals): je Spiel ein unsichtbares Fenster, das die Bildquelle des Spiels
// aufnimmt (sein Fenster oder den Bildschirm) und je Bild kleine Signaturen der Bereiche schickt, die der Editor festgelegt hat.
// Hier werden sie mit den Frames verglichen (core/bild-erkennung.js), Texte gelesen (Tesseract.js, Englisch und Deutsch,
// läuft lokal ohne Internet) und Treffer gemeldet. Sind mehrere Spiele offen, läuft für jedes eine eigene Erkennung.
// Welche Spiele laufen, entscheidet core/bild-spiele.js (erkennungsPlan) anhand der offenen Fenster.
// Bildschirmaufnahme über session.setDisplayMediaRequestHandler und desktopCapturer (electron.d.ts von ow-electron).
const { BrowserWindow, desktopCapturer, screen, session, webContents } = require('electron');
const path = require('path');
const fs = require('fs');
const { BildErkennung } = require('../core/bild-erkennung');
const { BILD_BY_ID, erkennungsPlan, fensterFuer, erkennungsAuftrag, aktionBereit } = require('../core/bild-spiele');

const TEXT_GILT = 2500; // so lange zählt ein gelesener Text
const FENSTER_ALLE = 3000; // so oft nach geöffneten und geschlossenen Spielen sehen

class BildDienst {
  // getCfg(): cfg.gamepc.bild, aktiv(): Bild-Spiel, das die Regie gerade aktiv hat (oder null), onTreffer(spiel, aktion), onChange()
  constructor({ root, preload, getCfg, aktiv, onTreffer, onChange }) {
    Object.assign(this, { root, preload, getCfg, aktivVon: aktiv, onTreffer, onChange: onChange || (() => {}) });
    this.laeufe = new Map(); // spiel → Erkennung eines Spiels
    this.fenster = []; // offene Fenster [{ id, name }]
    this.fehler = '';
    this.editorSpiel = null; // Spiel, dessen Quelle der Editor gerade aufnimmt
    this.ocr = null;
    this.ocrLaeuft = 0;
    this.timer = null;
    this.suche = null;
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

  // Offene Fenster ohne die eigenen (Erkennung, App)
  async fensterSuchen() {
    const l = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false });
    return l.filter((q) => q.name && !/^Advanced LAN/i.test(q.name.trim())).map((q) => ({ id: q.id, name: q.name }));
  }

  // Fenster, das ein Spiel gerade als Quelle hat (auch ohne Aktionen, für die Editor-Aufnahme), sonst null = Bildschirm
  async fensterFuer(spiel) {
    const def = BILD_BY_ID[spiel], c = this.getCfg();
    if (!def || !c) return null;
    const alle = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false });
    return fensterFuer(def, c.spiele[spiel], alle.filter((q) => !/^Advanced LAN/i.test(q.name.trim())));
  }
  // Was der Editor aufnehmen würde: { art, name }
  async editorQuelle(spiel) {
    const f = await this.fensterFuer(spiel);
    return f ? { art: 'fenster', name: f.name.trim() } : { art: 'bildschirm', name: 'Bildschirm' };
  }

  // Quelle für die Aufnahme: Fenster des Spiels oder eingestellter Bildschirm
  async quelleFuer(spiel, lauf) {
    if (lauf?.quelle.art === 'fenster') {
      const f = (await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false })).find((q) => q.id === lauf.quelle.id);
      if (f) return f;
    } else if (!lauf) {
      const f = await this.fensterFuer(spiel);
      if (f) return f;
    }
    const schirme = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
    return schirme.find((q) => q.display_id === this.bildschirm()?.id) || schirme[0];
  }

  // Aufnahme ohne Auswahl-Dialog: Erkennungsfenster nehmen die Quelle ihres Spiels, der Editor die des Spiels, das er bearbeitet
  einrichten() {
    session.defaultSession.setDisplayMediaRequestHandler(async (req, antwort) => {
      try {
        const wc = req.frame ? webContents.fromFrame(req.frame) : null;
        const lauf = wc && [...this.laeufe.values()].find((l) => l.fenster && !l.fenster.isDestroyed() && l.fenster.webContents.id === wc.id);
        antwort({ video: await this.quelleFuer(lauf ? lauf.spiel : this.editorSpiel, lauf) });
      } catch { antwort({}); }
    });
    this.timer = setInterval(() => this.anwenden(), FENSTER_ALLE);
  }

  plan() {
    if (!this.getCfg()) return {};
    const aktiv = this.aktivVon();
    return erkennungsPlan(this.getCfg(), this.fenster, BILD_BY_ID[aktiv] ? aktiv : null);
  }

  // Nach jeder Änderung der Einstellungen, des aktiven Spiels und regelmäßig (Spiele öffnen und schließen)
  anwenden() {
    if (this.suche) return this.suche;
    if (!this.getCfg()?.an) { this.fenster = []; return Promise.resolve(this.abgleichen()); } // Regie-PC oder aus: keine Fenster suchen
    this.suche = this.fensterSuchen()
      .then((f) => { this.fenster = f; this.fehler = ''; }, (e) => { this.fehler = `Fenster nicht lesbar: ${e?.message || e}`; })
      .then(() => this.abgleichen())
      .finally(() => { this.suche = null; });
    return this.suche;
  }

  abgleichen() {
    const c = this.getCfg();
    const plan = c ? this.plan() : {};
    let geaendert = false;
    for (const spiel of [...this.laeufe.keys()]) if (!plan[spiel]) { this.stop(spiel); geaendert = true; }
    for (const [spiel, quelle] of Object.entries(plan)) {
      const aktionen = c.spiele[spiel].aktionen.filter(aktionBereit);
      const sig = JSON.stringify([quelle.art, quelle.id, c.display, c.fps, aktionen.map((a) => [a.id, a.modus, a.schwelle, a.pause, a.bereiche.map((b) => [b.id, b.region, b.text, b.vorlagen.length])])]);
      const alt = this.laeufe.get(spiel);
      if (alt && alt.signatur === sig && alt.fenster) continue;
      geaendert = true;
      // Neue Quelle (anderes Fenster, anderer Bildschirm): neu aufnehmen
      if (alt && (alt.quelle.art !== quelle.art || alt.quelle.id !== quelle.id || alt.display !== c.display)) this.stop(spiel);
      this.starten(spiel, quelle, aktionen, sig, c);
    }
    if (geaendert) this.onChange();
  }

  starten(spiel, quelle, aktionen, signatur, c) {
    // Je Aktion ein oder mehrere Auslöser (Bereiche); das Aufnahmefenster liefert je Auslöser eine Signatur und ggf. Text
    const auftrag = erkennungsAuftrag(aktionen);
    const erkennung = new BildErkennung({ aktionen: auftrag.aktionen });
    erkennung.setVorlagen(auftrag.vorlagen);
    const alt = this.laeufe.get(spiel);
    const lauf = alt || { spiel, fenster: null, letzte: {}, info: { fehler: '', leer: false, b: 0, h: 0, bilder: 0, t: 0 } };
    Object.assign(lauf, { quelle, aktionen, signatur, erkennung, display: c.display, texte: {}, werte: {}, teilWerte: {} });
    this.laeufe.set(spiel, lauf);
    const start = { fps: c.fps, teile: auftrag.teile };
    if (lauf.fenster) return lauf.fenster.webContents.send('erkennung-start', start);
    const w = new BrowserWindow({
      name: `erkennung-${spiel}`, show: false, width: 320, height: 200, skipTaskbar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, preload: this.preload },
    });
    lauf.fenster = w;
    w.loadFile(path.join(this.root, 'dist-app', 'erkennung.html'));
    w.webContents.once('did-finish-load', () => !w.isDestroyed() && w.webContents.send('erkennung-start', start));
    w.on('closed', () => { if (lauf.fenster === w) { lauf.fenster = null; this.onChange(); } });
  }

  stop(spiel) {
    const lauf = this.laeufe.get(spiel);
    if (!lauf) return;
    this.laeufe.delete(spiel);
    if (lauf.fenster && !lauf.fenster.isDestroyed()) lauf.fenster.destroy();
  }

  lauf(sender) { return [...this.laeufe.values()].find((l) => l.fenster && !l.fenster.isDestroyed() && l.fenster.webContents.id === sender?.id); }

  // Vom Erkennungsfenster eines Spiels: { t, b, h, sigs: { id: Uint8Array }, leer }
  frame(sender, d) {
    const l = this.lauf(sender);
    if (!l || !d) return;
    const now = Date.now();
    const texte = {};
    for (const [id, x] of Object.entries(l.texte)) if (now - x.t < TEXT_GILT) texte[id] = x.text;
    const r = l.erkennung.frame(d.sigs || {}, now, texte);
    l.werte = r.werte; l.teilWerte = r.teilWerte;
    Object.assign(l.info, { fehler: '', leer: !!d.leer, b: d.b, h: d.h, bilder: l.info.bilder + 1, t: now });
    for (const e of r.erkannt) {
      const a = l.aktionen.find((x) => x.id === e.id);
      if (!a) continue;
      l.letzte[a.id] = now;
      this.onTreffer(l.spiel, a);
    }
  }

  meldung(sender, s) { const l = this.lauf(sender); if (l) { Object.assign(l.info, s || {}); this.onChange(); } }

  // Text in einem Bereich lesen (Erkennung und Editor-Test). png: Buffer/Uint8Array eines PNG
  async lesen(png) {
    if (!png) return '';
    if (!this.ocr) this.ocr = this.ocrStarten();
    let w;
    try { w = await this.ocr; } catch (e) { this.ocr = null; throw e; } // beim nächsten Mal neu versuchen
    const r = await w.recognize(Buffer.from(png));
    return String(r.data?.text || '').trim();
  }
  async text(sender, id, png) {
    const l = this.lauf(sender);
    if (!l || this.ocrLaeuft > 2) return; // nicht stauen: lieber ein Bild auslassen
    this.ocrLaeuft++;
    try { l.texte[id] = { text: await this.lesen(png), t: Date.now() }; }
    catch (e) { l.info.fehler = `Texterkennung: ${e?.message || e}`; }
    finally { this.ocrLaeuft--; }
  }
  async ocrStarten() {
    const { createWorker } = require('tesseract.js');
    // Sprachdaten liegen in der App (scripts/build.js kopiert sie nach dist-ocr), kein Download
    const lang = path.join(this.root, 'dist-ocr');
    const unpacked = lang.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
    return createWorker(['eng', 'deu'], 1, { langPath: fs.existsSync(unpacked) ? unpacked : lang, gzip: true, cacheMethod: 'none' });
  }

  // { spiele: { id: { laeuft, leer, b, h, fehler, quelle, werte, letzte } }, fenster: offene Fenster, bildschirm }
  status() {
    const spiele = {};
    for (const l of this.laeufe.values()) {
      const alt = l.info.t ? Date.now() - l.info.t : null;
      spiele[l.spiel] = { ...l.info, laeuft: !!l.fenster && alt != null && alt < 3000, quelle: l.quelle, werte: l.werte, teilWerte: l.teilWerte, letzte: l.letzte };
    }
    return { spiele, fehler: this.fehler, fenster: this.fenster.map((f) => f.name.trim()), bildschirm: this.bildschirm() };
  }

  async beenden() {
    clearInterval(this.timer);
    for (const s of [...this.laeufe.keys()]) this.stop(s);
    if (this.ocr) { try { await (await this.ocr).terminate(); } catch {} this.ocr = null; }
  }
}

module.exports = { BildDienst };
