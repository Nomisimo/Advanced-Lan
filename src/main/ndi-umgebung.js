// Netzwerkkarte für NDI: das NDI SDK liest seine Einstellungen aus ndi-config.v1.json im Ordner aus NDI_CONFIG_DIR
// (sonst %ProgramData%\NDI bzw. ~/.ndi). Wir schreiben eine eigene Datei mit der gewählten Karte (adapters.allowed)
// und übernehmen die Einstellungen des PCs (z. B. Discovery-Server).
//
// Wichtig: Die Umgebungsvariable muss schon beim Start des Prozesses gesetzt sein. Unter Windows liest die C-Laufzeit
// (getenv) eine Kopie der Umgebung vom Prozessstart; ein später gesetztes process.env.NDI_CONFIG_DIR sieht das SDK
// dann nicht und sendet über alle Karten. Deshalb startet die App sich einmal selbst neu, wenn eine Karte gewählt ist
// und die Variable beim Start fehlte (der neue Prozess erbt sie).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { kartenListe, karteFuer, ndiKonfig } = require('../core/netzwerk');

const DATEI = 'ndi-config.v1.json';
const START_WERT = process.env.NDI_CONFIG_DIR || ''; // so stand es beim Start dieses Prozesses
const NEUSTART_ARG = '--ndi-umgebung';

const systemKonfig = () => (process.platform === 'win32'
  ? path.join(process.env.ProgramData || 'C:\\ProgramData', 'NDI', DATEI)
  : path.join(os.homedir(), '.ndi', DATEI));

// Datei für die Karte (Name, leer = alle) schreiben → { gewaehlt, name, ip, fehler, datei }
function ndiKonfigSchreiben(ordner, karteName) {
  const name = karteName || '';
  const k = name ? karteFuer(kartenListe(os.networkInterfaces()), name) : null;
  const aktiv = { gewaehlt: name, name: k ? name : '', ip: k?.ip || '', fehler: name && !k ? `Netzwerkkarte „${name}“ nicht verbunden, NDI nutzt alle Karten` : '', datei: '' };
  if (!ordner) return aktiv;
  try {
    let basis = {};
    try { basis = JSON.parse(fs.readFileSync(systemKonfig(), 'utf8')); } catch { /* keine Konfiguration auf dem PC */ }
    fs.mkdirSync(ordner, { recursive: true });
    aktiv.datei = path.join(ordner, DATEI);
    fs.writeFileSync(aktiv.datei, JSON.stringify(ndiKonfig(basis, aktiv.ip), null, 2));
    process.env.NDI_CONFIG_DIR = ordner;
  } catch (e) { aktiv.fehler = `NDI-Konfiguration nicht geschrieben: ${e.message}`; }
  return aktiv;
}

// Gilt die Datei für das SDK? Nur wenn NDI_CONFIG_DIR schon beim Prozessstart auf den Ordner zeigte.
const umgebungAktiv = (ordner) => !!ordner && path.resolve(START_WERT || '.') === path.resolve(ordner) && !!START_WERT;

// Beim Start, vor allem anderen: ist für die Regie eine NDI-Karte gewählt, die Datei schreiben und, falls die Variable
// beim Start fehlte, einmal neu starten. → true, wenn die App neu startet (dann nichts weiter tun)
function ndiUmgebungBeimStart({ app, konfigDatei, ordner }) {
  let cfg = null;
  try { cfg = JSON.parse(fs.readFileSync(konfigDatei, 'utf8')); } catch { return false; }
  const karte = cfg?.regie?.netz?.ndi;
  const regie = cfg?.modus === 'regie' || cfg?.modus === 'standalone';
  if (!regie || !karte) return false;
  ndiKonfigSchreiben(ordner, karte);
  if (umgebungAktiv(ordner) || process.argv.includes(NEUSTART_ARG)) return false; // schon richtig oder schon einmal versucht
  neuStarten(app, ordner);
  return true;
}

// App neu starten, mit NDI_CONFIG_DIR in der Umgebung des neuen Prozesses
function neuStarten(app, ordner) {
  if (ordner) process.env.NDI_CONFIG_DIR = ordner;
  const args = process.argv.slice(1).filter((a) => a !== NEUSTART_ARG).concat(NEUSTART_ARG);
  app.relaunch({ args });
  app.exit(0);
}

module.exports = { ndiKonfigSchreiben, ndiUmgebungBeimStart, umgebungAktiv, neuStarten, START_WERT };
