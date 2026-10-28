// Namens-Popup des Game-PCs: kleines Fenster oben in der Mitte, über allen Fenstern, ohne dem Spiel den Fokus zu nehmen.
// Wie das Mini-Overlay ein normales Fenster: sichtbar über Spielen im Fenster- oder randlosen Vollbild, nicht über exklusivem Vollbild.
const path = require('path');
const { BrowserWindow, ipcMain, screen } = require('electron');

const BREITE = 400, HOEHE = 156;
const SEKUNDEN = 30; // ohne Klick oder Eingabe blendet es sich danach aus

class NamensAbfrage {
  // onAntwort(name): Name übernommen (auch leer). onZu(): weggeklickt oder abgelaufen.
  constructor({ root, onAntwort, onZu }) {
    this.root = root;
    this.onAntwort = onAntwort || (() => {});
    this.onZu = onZu || (() => {});
    this.win = null;
    ipcMain.on('name-antwort', (e, name) => { if (this.von(e)) { this.schliessen(); this.onAntwort(String(name || '')); } });
    ipcMain.on('name-schliessen', (e) => { if (this.von(e)) { this.schliessen(); this.onZu(); } });
  }

  von(e) { return this.win && !this.win.isDestroyed() && e.sender === this.win.webContents; }
  get offen() { return !!(this.win && !this.win.isDestroyed() && this.win.isVisible()); }

  // d: { pcId, vorschlag, grund }  grund: spielstart | zurueck | regie | hand
  zeigen(d) {
    const daten = { ...d, sekunden: SEKUNDEN };
    if (!this.win || this.win.isDestroyed()) this.erzeugen();
    const senden = () => { if (this.win && !this.win.isDestroyed()) { this.win.webContents.send('name-daten', daten); this.win.showInactive(); } };
    if (this.win.webContents.isLoading()) this.win.webContents.once('did-finish-load', senden);
    else senden();
  }

  erzeugen() {
    const wa = screen.getPrimaryDisplay().workArea;
    this.win = new BrowserWindow({
      width: BREITE, height: HOEHE, x: Math.round(wa.x + (wa.width - BREITE) / 2), y: wa.y + 32,
      frame: false, transparent: true, resizable: false, minimizable: false, maximizable: false, fullscreenable: false,
      skipTaskbar: true, hasShadow: false, show: false, alwaysOnTop: true, title: 'Advanced LAN: Wer spielt?',
      webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(this.root, 'src', 'preload', 'name-preload.js') },
    });
    this.win.setAlwaysOnTop(true, 'screen-saver');
    if (process.platform === 'darwin') this.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    this.win.setMenuBarVisibility(false);
    this.win.loadFile(path.join(this.root, 'src', 'main', 'name-popup.html'));
    this.win.on('closed', () => { this.win = null; });
  }

  schliessen() { if (this.win && !this.win.isDestroyed()) this.win.hide(); }
  beenden() { if (this.win && !this.win.isDestroyed()) this.win.destroy(); this.win = null; }
}

module.exports = { NamensAbfrage };
