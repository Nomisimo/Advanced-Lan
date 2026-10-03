const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { GsiServer } = require('./gsi-server');
const { OscSender } = require('./osc-out');
const { SessionServer } = require('./session-server');
const { Discovery, SessionClient } = require('./session-client');
const { findeCs2CfgOrdner, findeRlConfigOrdner } = require('./cs2-pfad');
const { RlClient } = require('./rl-client');
const { Regie } = require('../core/regie');
const { RegieSim } = require('../core/regie-sim');
const { CsQuelle } = require('../core/cs-quelle');
const { RlQuelle } = require('../core/rl-quelle');
const { rlIni, leseRlIni, RL_INI_DATEI } = require('../core/rl-ini');
const { migrateKonfig } = require('../core/defaults');
const { gsiCfg, CFG_DATEI } = require('../core/cfg');
const { testNachricht, zeigeNachricht } = require('../core/signal');

const root = app.getAppPath();
const KONFIG_DATEI = () => path.join(app.getPath('userData'), 'advanced-lan.json');
let mainWin = null;

/* ── Einstellungen ────────────────────────────────────────────────────── */
let cfg = null;
function ladeKonfig() {
  try { cfg = migrateKonfig(JSON.parse(fs.readFileSync(KONFIG_DATEI(), 'utf8'))); }
  catch { cfg = migrateKonfig(null); }
}
let speicherTimer = null;
function speichereKonfig() {
  clearTimeout(speicherTimer);
  speicherTimer = setTimeout(() => {
    try { fs.mkdirSync(path.dirname(KONFIG_DATEI()), { recursive: true }); fs.writeFileSync(KONFIG_DATEI(), JSON.stringify(cfg, null, 1)); }
    catch (e) { meldung(`Einstellungen nicht gespeichert: ${e.message}`, 'err'); }
  }, 300);
}

/* ── An die Oberfläche melden ─────────────────────────────────────────── */
const an = (kanal, daten) => { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(kanal, daten); };
const meldung = (text, art = 'ok') => an('meldung', { text, art });
let statusTimer = null;
const statusMelden = () => {
  if (statusTimer) return;
  statusTimer = setTimeout(() => { statusTimer = null; an('status', gesamtStatus()); }, 120);
};

/* ── Modus Regie: Session, aktives Spiel, Cues → OSC ──────────────────── */
const osc = new OscSender();
const regie = new Regie({
  getConfig: () => cfg.regie,
  send: (s) => osc.send(s),
  emit: (typ, d) => {
    if (typ === 'event') an('regie-event', d);
    if (typ === 'fehler') meldung(`OSC fehlgeschlagen: ${d}`, 'err');
    statusMelden();
  },
});
const session = new SessionServer({ regie, getConfig: () => cfg.regie, onChange: statusMelden });
const regieSim = new RegieSim({ regie, onChange: statusMelden });

// Auf dem Regie-PC darf kein Spiel laufen (Windows: Prozessliste prüfen)
const SPIEL_PROZESSE = { 'cs2.exe': 'CS2', 'valorant-win64-shipping.exe': 'Valorant', 'rocketleague.exe': 'Rocket League' };
let spielAufRegie = '', spielCheck = null;
function pruefeSpielProzesse() {
  if (process.platform !== 'win32') return;
  execFile('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 5000 }, (err, out) => {
    if (err) return;
    const namen = new Set(String(out).split(/\r?\n/).map((z) => (z.split('","')[0] || '').replace(/^"/, '').toLowerCase()));
    const gefunden = Object.entries(SPIEL_PROZESSE).filter(([exe]) => namen.has(exe)).map(([, n]) => n).join(', ');
    if (gefunden !== spielAufRegie) { spielAufRegie = gefunden; statusMelden(); }
  });
}

/* ── Modus Game-PC: alle bekannten Spiele → Ereignisse → Regie ─────────── */
const QUELLEN = ['cs2', 'rl']; // Spiele mit Datenquelle auf dem Game-PC
let quelle = new CsQuelle();
const gp = { letzte: 0, status: null, stand: null, fremd: 0, log: [], nr: 0, statusGesendet: 0 };
let rlQuelle = new RlQuelle();
const rl = { letzte: 0, stand: null, statusGesendet: 0 };
const rlClient = new RlClient({ onNachricht: (m) => rlNachricht(m), onChange: statusMelden });
const client = new SessionClient({ onChange: statusMelden, onAntwort: statusMelden });
const discovery = new Discovery({ onChange: () => discoveryGeaendert() });
const gsi = new GsiServer({ onPayload: (b) => gamePcPayload(b), onStatus: statusMelden });

function gamePcPayload(body) {
  if (cfg.modus !== 'gamepc') return;
  if (body?.auth?.token !== cfg.gamepc.gsiToken) { gp.fremd++; return statusMelden(); }
  const r = quelle.ingest(body);
  Object.assign(gp, { letzte: Date.now(), status: r.status, stand: r.stand });
  const spiel = 'cs2'; // Game-PC sendet immer alles, was er erkennt. Was davon genutzt wird, entscheidet die Regie.
  for (const ev of r.events) {
    const ok = client.event(spiel, ev);
    const e = { id: ++gp.nr, t: Date.now(), spiel, ev, gesendet: ok };
    gp.log.unshift(e);
    if (gp.log.length > 200) gp.log.length = 200;
    an('gamepc-event', e);
  }
  if (r.events.length || Date.now() - gp.statusGesendet > 500) { client.status(spiel, r.status, r.stand); gp.statusGesendet = Date.now(); }
  statusMelden();
}

// Verbinden mit der gewählten Session. Adresse und Port kommen immer aus mDNS, nie von Hand.
let autoWartet = false;
// Rocket League: Nachrichten der Stats API → Events an die Regie
function rlNachricht(m) {
  if (cfg.modus !== 'gamepc') return;
  const r = rlQuelle.ingest(m);
  rl.letzte = Date.now();
  rl.stand = r.stand;
  for (const ev of r.events) {
    const ok = client.event('rl', ev);
    const e = { id: ++gp.nr, t: Date.now(), spiel: 'rl', ev, gesendet: ok };
    gp.log.unshift(e);
    if (gp.log.length > 200) gp.log.length = 200;
    an('gamepc-event', e);
  }
  if (r.events.length || Date.now() - rl.statusGesendet > 500) { client.status('rl', r.status, r.stand); rl.statusGesendet = Date.now(); }
  statusMelden();
}

function gamePcVerbinden() {
  const g = cfg.gamepc;
  const s = discovery.liste().find((x) => x.id === g.regie.id) || discovery.liste().find((x) => x.session === g.regie.session);
  if (!g.pcId.trim()) return { fehler: 'Zuerst eine PC-ID eintragen' };
  if (!g.regie.id) return { fehler: 'Zuerst eine Session wählen' };
  if (!g.passwort) return { fehler: 'Passwort fehlt' };
  if (s) g.regie = { id: s.id, session: s.session, host: s.ip, port: s.port };
  else if (!g.regie.host) return { fehler: 'Session gerade nicht im Netz' };
  autoWartet = false;
  client.verbinden({ host: g.regie.host, port: g.regie.port, passwort: g.passwort, pcId: g.pcId.trim(), spiele: QUELLEN });
  speichereKonfig();
  return { ok: true };
}
function discoveryGeaendert() {
  // Beim Start automatisch verbinden, sobald die gespeicherte Session im Netz auftaucht
  if (autoWartet && discovery.liste().some((x) => x.id === cfg.gamepc.regie.id)) gamePcVerbinden();
  statusMelden();
}

async function rlCheck() {
  const ordner = await findeRlConfigOrdner();
  let ini = null;
  try { if (ordner) ini = fs.readFileSync(path.join(ordner, RL_INI_DATEI), 'utf8'); } catch {}
  const w = leseRlIni(ini);
  const alter = rl.letzte ? Math.round((Date.now() - rl.letzte) / 1000) : null;
  const port = Number(cfg.gamepc.rlPort);
  return [
    { id: 'rl-installiert', label: 'Rocket League gefunden', ok: !!ordner, detail: ordner || 'weder bei Epic Games noch bei Steam' },
    { id: 'rl-ini', label: 'Stats API eingeschaltet', ok: ini != null && w.rate > 0, detail: ini == null ? `${RL_INI_DATEI} fehlt` : w.rate > 0 ? `${w.rate} Updates pro Sekunde` : 'PacketSendRate ist 0' },
    { id: 'rl-port', label: 'Port passt zu dieser App', ok: ini != null && (w.webPort ?? 49124) === port, detail: ini == null ? '–' : `WebSocket ${w.webPort ?? 49124}` },
    { id: 'rl-verbunden', label: 'Mit Rocket League verbunden', ok: rlClient.verbunden, detail: rlClient.verbunden ? `127.0.0.1:${port}` : 'Rocket League läuft nicht oder Stats API aus' },
    { id: 'rl-daten', label: 'Rocket League sendet Daten', ok: alter != null && alter < 15, detail: alter == null ? 'noch nichts empfangen, ein Match starten' : `zuletzt vor ${alter} s` },
  ];
}

// „Ist korrekt aufgesetzt“-Check des Game-PCs
async function setupCheck() {
  const g = cfg.gamepc, c = client.info(), gs = gsi.status();
  const ordner = await findeCs2CfgOrdner();
  const datei = ordner ? path.join(ordner, CFG_DATEI) : '';
  let inhalt = null;
  try { if (datei) inhalt = fs.readFileSync(datei, 'utf8'); } catch {}
  const norm = (x) => String(x).replace(/\r\n/g, '\n').trim();
  const passt = inhalt != null && norm(inhalt) === norm(gsiCfg({ port: g.gsiPort, token: g.gsiToken }));
  const alter = gp.letzte ? Math.round((Date.now() - gp.letzte) / 1000) : null;
  return {
    allgemein: [
      { id: 'pcid', label: 'PC-ID eingetragen', ok: !!g.pcId.trim(), detail: g.pcId.trim() || 'fehlt' },
      { id: 'session', label: 'Mit einer Session verbunden', ok: c.zustand === 'verbunden', detail: c.zustand === 'verbunden' ? c.session : c.grund || 'nicht verbunden' },
    ],
    cs2: [
      { id: 'installiert', label: 'CS2 gefunden', ok: !!ordner, detail: ordner || 'nicht in den Steam-Bibliotheken' },
      { id: 'cfg', label: 'cfg-Datei installiert', ok: inhalt != null, detail: inhalt != null ? CFG_DATEI : 'fehlt' },
      { id: 'aktuell', label: 'cfg-Datei passt zu dieser App', ok: passt, detail: inhalt == null ? '–' : passt ? 'Port und Token stimmen' : 'veraltet, neu installieren' },
      { id: 'empfang', label: 'Empfang bereit', ok: !!gs.laeuft, detail: gs.fehler || `127.0.0.1:${gs.port}` },
      { id: 'daten', label: 'CS2 sendet Daten', ok: alter != null && alter < 15, detail: alter == null ? 'noch nichts empfangen, CS2 starten' : `zuletzt vor ${alter} s` },
      ...(gp.fremd ? [{ id: 'token', label: 'Kein fremder Token', ok: false, detail: `${gp.fremd} Nachrichten mit falschem Token` }] : []),
    ],
    rl: await rlCheck(),
  };
}

/* ── Modus wechseln ───────────────────────────────────────────────────── */
async function modusStarten() {
  regieSim.stop();
  await session.schliessen();
  clearInterval(spielCheck);
  client.trennen();
  discovery.stop();
  rlClient.stop();
  await gsi.stop();
  if (cfg.modus === 'regie') {
    if (cfg.regie.session.offen && cfg.regie.session.passwort) await session.oeffnen();
    pruefeSpielProzesse();
    spielCheck = setInterval(pruefeSpielProzesse, 15000);
  }
  if (cfg.modus === 'gamepc') {
    quelle = new CsQuelle();
    await gsi.start(Number(cfg.gamepc.gsiPort));
    rlQuelle = new RlQuelle();
    rlClient.start(Number(cfg.gamepc.rlPort));
    discovery.start();
    autoWartet = !!(cfg.gamepc.autoVerbinden && cfg.gamepc.regie.id && cfg.gamepc.passwort && cfg.gamepc.pcId);
  }
  statusMelden();
}

function gesamtStatus() {
  const s = { modus: cfg.modus, jetzt: Date.now() };
  if (cfg.modus === 'regie') s.regie = { ...regie.snapshot(), session: session.status(), sim: regieSim.status(), armed: cfg.regie.armed, spielAufRegie };
  if (cfg.modus === 'gamepc') s.gamepc = { client: client.info(), sessions: discovery.liste(), discoveryFehler: discovery.fehler, gsi: gsi.status(), letzte: gp.letzte, status: gp.status, stand: gp.stand, fremd: gp.fremd, rl: { ...rlClient.status(), letzte: rl.letzte, stand: rl.stand } };
  return s;
}

/* ── Fenster ──────────────────────────────────────────────────────────── */
function createWindow() {
  const iconPath = path.join(root, 'assets', 'app-icon', 'icon.png');
  mainWin = new BrowserWindow({
    width: 1480, height: 940, minWidth: 1100, minHeight: 680,
    title: 'Advanced LAN', show: false, backgroundColor: '#131118',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(root, 'src', 'preload', 'preload.js') },
  });
  mainWin.setMenuBarVisibility(false);
  mainWin.loadFile(path.join(root, 'dist-app', 'index.html'));
  mainWin.once('ready-to-show', () => mainWin.show());
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

/* ── IPC ──────────────────────────────────────────────────────────────── */
ipcMain.handle('app-version', () => app.getVersion());
ipcMain.handle('config-get', () => cfg);
ipcMain.handle('config-set', async (_, neu) => {
  const alt = cfg;
  cfg = { ...migrateKonfig(neu), modus: alt.modus };
  cfg.regie.armed = !!neu.regie?.armed;
  cfg.regie.session.offen = alt.regie.session.offen; // offen/zu steuern nur die Session-Knöpfe
  if (client.zustand !== 'getrennt' && client.zustand !== 'abgelehnt') cfg.gamepc.pcId = alt.gamepc.pcId; // PC-ID nur ohne aktive Session änderbar
  speichereKonfig();
  if (cfg.modus === 'regie') {
    if (cfg.regie.aktivesSpiel !== alt.regie.aktivesSpiel) session.spielGewechselt();
    else if (session.offen && cfg.regie.session.name !== alt.regie.session.name) session.ausrufen();
    if (session.offen && (cfg.regie.session.port !== alt.regie.session.port || cfg.regie.session.passwort !== alt.regie.session.passwort)) await session.oeffnen();
  }
  if (cfg.modus === 'gamepc' && cfg.gamepc.gsiPort !== alt.gamepc.gsiPort) await gsi.start(Number(cfg.gamepc.gsiPort));
  statusMelden();
  return gesamtStatus();
});
ipcMain.handle('modus-setzen', async (_, modus) => {
  cfg.modus = modus === 'regie' || modus === 'gamepc' ? modus : null;
  speichereKonfig();
  await modusStarten();
  return gesamtStatus();
});
ipcMain.handle('status', () => gesamtStatus());
ipcMain.handle('netz-adressen', () => {
  const out = [];
  for (const [name, list] of Object.entries(require('os').networkInterfaces()))
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push({ name, ip: a.address });
  return out;
});

// Regie
ipcMain.handle('regie-log', () => regie.alleLogs());
ipcMain.handle('session-oeffnen', async () => { const ok = await session.oeffnen(); cfg.regie.session.offen = ok; speichereKonfig(); return gesamtStatus(); });
ipcMain.handle('session-schliessen', async () => { await session.schliessen(); cfg.regie.session.offen = false; speichereKonfig(); return gesamtStatus(); });
ipcMain.handle('pc-trennen', (_, pcId) => { session.trennen(pcId); });
ipcMain.handle('event-ausloesen', (_, ev) => regie.fire({ round: regie.stand?.runde, map: regie.stand?.map, ...ev, spiel: cfg.regie.aktivesSpiel, pc: 'Regie', pcId: 'regie' }, 'manuell'));
ipcMain.handle('signal-testen', (_, spiel, type, zuweisung) => regie.testeZuweisung(spiel, type, zuweisung));
ipcMain.handle('ziel-testen', async (_, zielId) => {
  const ziel = cfg.regie.targets.find((t) => t.id === zielId);
  if (!ziel) return { fehler: 'Ziel nicht gefunden' };
  try { const n = testNachricht(ziel); await osc.send({ ziel, ...n }); return { ok: true, nachricht: zeigeNachricht(n) }; }
  catch (e) { return { fehler: e.message }; }
});
ipcMain.handle('sim-start', (_, modus) => { regieSim.start(modus, cfg.regie.aktivesSpiel); return regieSim.status(); });
ipcMain.handle('sim-stop', () => { regieSim.stop(); return regieSim.status(); });
ipcMain.handle('sim-neu', () => { regieSim.neu(); return regieSim.status(); });

// Game-PC
ipcMain.handle('gamepc-log', () => gp.log);
ipcMain.handle('verbinden', () => gamePcVerbinden());
ipcMain.handle('trennen', () => { autoWartet = false; client.trennen(); });
ipcMain.handle('cs2-ordner', () => findeCs2CfgOrdner());
ipcMain.handle('setup-check', () => setupCheck());
ipcMain.handle('rl-ini-installieren', async () => {
  const ordner = await findeRlConfigOrdner();
  if (!ordner) return { fehler: 'Rocket-League-Ordner nicht gefunden. Bitte „Speichern unter …“ nehmen.' };
  try { fs.writeFileSync(path.join(ordner, RL_INI_DATEI), rlIni({ webPort: Number(cfg.gamepc.rlPort) })); }
  catch (e) { return { fehler: e.message }; }
  return { ok: true, pfad: path.join(ordner, RL_INI_DATEI) };
});
ipcMain.handle('rl-ini-speichern', async () => {
  const r = await dialog.showSaveDialog(mainWin, { defaultPath: RL_INI_DATEI, filters: [{ name: 'Rocket League Stats API', extensions: ['ini'] }] });
  if (r.canceled || !r.filePath) return { abgebrochen: true };
  fs.writeFileSync(r.filePath, rlIni({ webPort: Number(cfg.gamepc.rlPort) }));
  return { ok: true, pfad: r.filePath };
});
ipcMain.handle('cfg-installieren', async () => {
  const ordner = await findeCs2CfgOrdner();
  if (!ordner) return { fehler: 'CS2-Ordner nicht gefunden. Bitte „cfg speichern unter …“ nehmen.' };
  try { fs.writeFileSync(path.join(ordner, CFG_DATEI), gsiCfg({ port: cfg.gamepc.gsiPort, token: cfg.gamepc.gsiToken })); }
  catch (e) { return { fehler: e.message }; }
  return { ok: true, pfad: path.join(ordner, CFG_DATEI) };
});
ipcMain.handle('cfg-speichern', async () => {
  const r = await dialog.showSaveDialog(mainWin, { defaultPath: CFG_DATEI, filters: [{ name: 'CS2-Konfiguration', extensions: ['cfg'] }] });
  if (r.canceled || !r.filePath) return { abgebrochen: true };
  fs.writeFileSync(r.filePath, gsiCfg({ port: cfg.gamepc.gsiPort, token: cfg.gamepc.gsiToken }));
  return { ok: true, pfad: r.filePath };
});
ipcMain.handle('test-event', (_, type) => {
  const ev = { type, team: 'CT', player: cfg.gamepc.pcId, kills: 1, round: gp.stand?.runde ?? 0, map: gp.stand?.map || '', test: true };
  const ok = client.event('cs2', ev);
  const e = { id: ++gp.nr, t: Date.now(), spiel: 'cs2', ev, gesendet: ok };
  gp.log.unshift(e);
  an('gamepc-event', e);
  return { ok };
});
ipcMain.handle('open-external', (_, url) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); });

/* ── Start ────────────────────────────────────────────────────────────── */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => { if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.focus(); } });
  app.whenReady().then(async () => {
    ladeKonfig();
    createWindow();
    await modusStarten();
  });
  app.on('window-all-closed', async () => {
    regieSim.stop();
    client.trennen();
    rlClient.stop();
    discovery.stop();
    await Promise.allSettled([session.schliessen(), gsi.stop()]);
    osc.close();
    app.quit();
  });
}
