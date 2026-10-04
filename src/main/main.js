const { app, BrowserWindow, shell, ipcMain, dialog, screen, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { GsiServer } = require('./gsi-server');
const { OscSender } = require('./osc-out');
const { SessionServer } = require('./session-server');
const { Discovery, SessionClient } = require('./session-client');
const { findeCs2CfgOrdner, findeRlConfigOrdner, findeDotaCfgOrdner, steamLocalConfigs } = require('./cs2-pfad');
const { GepAnbindung } = require('./gep');
const { RlClient } = require('./rl-client');
const { Regie } = require('../core/regie');
const { RegieSim } = require('../core/regie-sim');
const { CsQuelle } = require('../core/cs-quelle');
const { RlQuelle } = require('../core/rl-quelle');
const { DotaQuelle, DOTA_APPID, dotaCfg, dotaStartoptionen, DOTA_CFG_DATEI, DOTA_STARTOPTION } = require('../core/dota');
const { GepQuelle, GEP_SPIELE, GEP_BY_ID } = require('../core/gep-spiele');
const { QUELLEN, SPIEL_BY_ID } = require('../core/spiele');
const { rlIni, leseRlIni, RL_INI_DATEI } = require('../core/rl-ini');
const { migrateKonfig, MODI } = require('../core/defaults');
const { gsiCfg, CFG_DATEI } = require('../core/cfg');
const { testNachricht, zeigeNachricht } = require('../core/signal');
const { overlayStatus } = require('../core/overlay-status');
const { kartenListe, lokaleIp } = require('../core/netzwerk');
const { SimRunner } = require('../core/sim-runner');
const { SimMatch } = require('../core/gsi-sim');
const { RlSimMatch } = require('../core/rl-sim');
const { DotaSimMatch } = require('../core/dota-sim');
const { GepSimMatch } = require('../core/gep-sim');
const { einrichtenUpdates } = require('./updates');
const { StatsAusgabe } = require('./stats-ausgabe');
const { hotkeyText, feedbackUrl } = require('../core/app-info');
const os = require('os');

const karten = () => kartenListe(os.networkInterfaces());

const root = app.getAppPath();
const KONFIG_DATEI = () => path.join(app.getPath('userData'), 'advanced-lan.json');
let mainWin = null;
let hotkeyAktiv = '', hotkeyFehler = ''; // Tastenkürzel zum Ein- und Ausblenden (siehe unten)

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

// Modi: Regie, Game-PC oder Standalone (Regie und Spiel auf demselben PC, ohne Netzwerk)
const istRegie = () => cfg?.modus === 'regie' || cfg?.modus === 'standalone';
const hatSpiele = () => cfg?.modus === 'gamepc' || cfg?.modus === 'standalone';

/* ── An die Oberfläche melden ─────────────────────────────────────────── */
// Hauptfenster und Game-Stats-Screen (Pop-out und NDI) bekommen dieselben Meldungen
const an = (kanal, daten) => {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(kanal, daten);
  if (kanal === 'status' || kanal === 'regie-event') for (const wc of stats.webContents()) wc.send(kanal, daten);
};
const meldung = (text, art = 'ok') => an('meldung', { text, art });
let statusTimer = null;
const statusMelden = () => {
  if (statusTimer) return;
  statusTimer = setTimeout(() => { statusTimer = null; if (!cfg) return; an('status', gesamtStatus()); overlayMelden(); }, 120);
};

/* ── Modus Regie: Session, aktives Spiel, Cues → OSC ──────────────────── */
const osc = new OscSender();
const regie = new Regie({
  getConfig: () => cfg.regie,
  send: (s) => oscSenden(s),
  emit: (typ, d) => {
    if (typ === 'event') an('regie-event', d);
    if (typ === 'fehler') meldung(`OSC fehlgeschlagen: ${d}`, 'err');
    statusMelden();
  },
});
// Absenderkarte: die des Ziels, sonst die für „Senden“, sonst automatisch
function oscSenden(s) {
  const l = lokaleIp(karten(), s.ziel.netz || cfg.regie.netz?.senden);
  return l.fehler ? Promise.reject(new Error(l.fehler)) : osc.send({ ...s, lokal: l.ip });
}
const session = new SessionServer({ regie, getConfig: () => cfg.regie, onChange: statusMelden, lokal: () => lokaleIp(karten(), cfg.regie.netz?.empfang) });
const regieSim = new RegieSim({ regie, onChange: statusMelden });
const stats = new StatsAusgabe({
  root, preload: path.join(root, 'src', 'preload', 'preload.js'), icon: path.join(root, 'assets', 'app-icon', 'icon.png'),
  getStats: () => cfg.regie.stats, aktiv: () => istRegie(), onChange: statusMelden,
});

// Auf dem Regie-PC darf kein Spiel laufen (Windows: Prozessliste prüfen)
const SPIEL_PROZESSE = { 'cs2.exe': 'CS2', 'valorant-win64-shipping.exe': 'Valorant', 'rocketleague.exe': 'Rocket League', 'dota2.exe': 'Dota 2', 'r5apex_dx12.exe': 'Apex Legends', 'rainbowsix_vulkan.exe': 'Rainbow Six Siege', 'rainbowsix_be.exe': 'Rainbow Six Siege',
  ...Object.fromEntries(GEP_SPIELE.map((s) => [s.exe, s.name])) };
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
// QUELLEN (core/spiele.js): Spiele mit Datenquelle auf dem Game-PC
let quelle = new CsQuelle();
const gp = { letzte: 0, status: null, stand: null, fremd: 0, log: [], nr: 0, statusGesendet: 0 };
let rlQuelle = new RlQuelle();
const rl = { letzte: 0, stand: null, statusGesendet: 0 };
// Dota 2 (Valve GSI) und Overwolf-Spiele (GEP): je Spiel eine Quelle und der letzte Stand
let quellen = {};
const neueQuellen = () => { quellen = { dota2: new DotaQuelle(), ...Object.fromEntries(GEP_SPIELE.map((d) => [d.id, new GepQuelle(d.id)])) }; };
neueQuellen();
const daten = {}; // spiel → { letzte, stand, status, statusGesendet }
const gep = new GepAnbindung({ app, onNachricht: (spiel, m) => gepNachricht(spiel, m), onChange: statusMelden });
gep.start(); // vor app.whenReady: das Paket meldet sich, sobald ow-electron es geladen hat
const rlClient = new RlClient({ onNachricht: (m) => rlNachricht(m), onChange: statusMelden });
const client = new SessionClient({
  onChange: () => { if (client.zustand !== 'verbunden') gpSim.stop(); statusMelden(); },
  onAntwort: statusMelden,
  geraet: () => ({ app: app.getVersion() }),
  karte: () => cfg.gamepc.netz,
});
const discovery = new Discovery({ onChange: () => discoveryGeaendert(), karte: () => cfg.gamepc.netz });
const gsi = new GsiServer({ onPayload: (b) => gamePcPayload(b), onStatus: statusMelden });

// Standalone: dieser PC meldet sich bei der eigenen Regie wie ein Game-PC, ohne Netzwerk
let lokalPc = null;
const lokalId = () => cfg.gamepc.pcId.trim() || 'Dieser PC';
function lokalAnmelden() {
  if (lokalPc && lokalPc !== lokalId()) regie.pcEntfernen(lokalPc);
  lokalPc = lokalId();
  regie.pcVerbunden(lokalPc, { spiele: QUELLEN, remote: 'dieser PC', geraet: { hostname: os.hostname(), app: app.getVersion(), plattform: process.platform, karte: 'lokal' } });
}
function lokalAbmelden() { if (lokalPc) regie.pcEntfernen(lokalPc); lokalPc = null; }
// Ereignis und Status eines Spiels: im Standalone direkt an die Regie, sonst über die Session
function anRegie(spiel, ev) {
  if (cfg.modus === 'standalone') { regie.pcEvent(lokalId(), spiel, ev); return true; }
  return client.event(spiel, ev);
}
function statusAnRegie(spiel, status, stand) {
  if (cfg.modus === 'standalone') regie.pcStatus(lokalId(), { spiel, status, stand });
  else client.status(spiel, status, stand);
}

function gamePcPayload(body, sim = false) {
  if (!hatSpiele()) return;
  if (body?.auth?.token !== cfg.gamepc.gsiToken) { gp.fremd++; return statusMelden(); }
  if (body?.provider?.appid === DOTA_APPID) return quelleMelden('dota2', quellen.dota2.ingest(body), sim); // Dota 2 schickt an denselben Empfang
  const r = quelle.ingest(body);
  Object.assign(gp, { letzte: Date.now(), status: r.status, stand: r.stand });
  const spiel = 'cs2'; // Game-PC sendet immer alles, was er erkennt. Was davon genutzt wird, entscheidet die Regie.
  for (const ev of r.events) {
    const ok = anRegie(spiel, ev);
    gamePcLog({ spiel, ev, gesendet: ok, sim });
  }
  if (r.events.length || Date.now() - gp.statusGesendet > 500) { statusAnRegie(spiel, r.status, r.stand); gp.statusGesendet = Date.now(); }
  statusMelden();
}

// Ergebnis einer Quelle (Dota 2, Overwolf-Spiele) → Log, Regie, Status
function quelleMelden(spiel, r, sim = false) {
  const d = daten[spiel] = daten[spiel] || { letzte: 0, statusGesendet: 0 };
  Object.assign(d, { letzte: Date.now(), stand: r.stand, status: r.status });
  for (const ev of r.events) gamePcLog({ spiel, ev, gesendet: anRegie(spiel, ev), sim });
  if (r.events.length || Date.now() - d.statusGesendet > 500) { statusAnRegie(spiel, r.status, r.stand); d.statusGesendet = Date.now(); }
  statusMelden();
}

// Overwolf-Spiele: GEP-Nachrichten des Spiels auf diesem PC
function gepNachricht(spiel, m, sim = false) {
  if (!hatSpiele() || !quellen[spiel]) return;
  quelleMelden(spiel, quellen[spiel].ingest(m), sim);
}

function gamePcLog(x) {
  const e = { id: ++gp.nr, t: Date.now(), ...x };
  gp.log.unshift(e);
  if (gp.log.length > 200) gp.log.length = 200;
  an('gamepc-event', e);
}

// Simulator des Game-PCs: spielt das aktive Spiel der Session, als liefe es auf diesem PC.
// Die Daten laufen durch dieselbe Erkennung wie echte Spieldaten. Nur mit verbundener Session.
let gpSimSpiel = 'cs2';
const gpSim = new SimRunner({
  onChange: () => statusMelden(),
  neuesMatch: () => {
    if (gpSimSpiel === 'rl') return new RlSimMatch();
    // Dota 2 und Overwolf-Spiele: dieser PC ist Spieler 1, nur dessen Daten kommen hier an
    const clients = (n, ich) => Array.from({ length: n }, (_, i) => ({ token: i === 0 ? ich : `sim${i}` }));
    if (gpSimSpiel === 'dota2') { const m = new DotaSimMatch({ clients: clients(10, cfg.gamepc.gsiToken) }); m.spieler[0].name = cfg.gamepc.pcId || m.spieler[0].name; return m; }
    if (GEP_BY_ID[gpSimSpiel]) { const m = new GepSimMatch({ spiel: gpSimSpiel, clients: clients(GEP_BY_ID[gpSimSpiel].spieler, 'ich') }); m.spieler[0].name = cfg.gamepc.pcId || m.spieler[0].name; return m; }
    // 5 gegen 5, dieser PC ist Spieler 1 (CT): nur dessen Daten kommen hier an, wie bei echtem CS2
    const m = new SimMatch({ clients: Array.from({ length: 10 }, (_, i) => ({ token: i === 0 ? cfg.gamepc.gsiToken : `sim${i}` })) });
    m.spieler[0].name = cfg.gamepc.pcId || m.spieler[0].name;
    return m;
  },
  deliver: (p) => {
    if (gpSimSpiel === 'rl') rlNachricht(p, true);
    else if (p.gep) { if (p.an == null || p.an === 'ich') gepNachricht(gpSimSpiel, p, true); }
    else if (p.auth?.token === cfg.gamepc.gsiToken) gamePcPayload(p, true);
  },
});
function gamePcSimStart(modus) {
  if (client.zustand !== 'verbunden') return { fehler: 'Nur mit verbundener Session' };
  const spiel = client.aktivesSpiel;
  if (!RegieSim.kann(spiel)) return { fehler: 'Für das aktive Spiel der Session gibt es keinen Simulator' };
  if (spiel !== gpSimSpiel) { gpSim.neu(); gpSimSpiel = spiel; }
  if (spiel === 'cs2' && !gpSim.match) quelle = new CsQuelle();
  if (spiel === 'rl' && !gpSim.match) rlQuelle = new RlQuelle();
  if (quellen[spiel] && !gpSim.match) quellen[spiel] = spiel === 'dota2' ? new DotaQuelle() : new GepQuelle(spiel);
  gpSim.start(modus);
  return { ok: true };
}

// Verbinden mit der gewählten Session. Adresse und Port kommen immer aus mDNS, nie von Hand.
let autoWartet = false;
// Rocket League: Nachrichten der Stats API → Events an die Regie
function rlNachricht(m, sim = false) {
  if (!hatSpiele()) return;
  const r = rlQuelle.ingest(m);
  rl.letzte = Date.now();
  rl.stand = r.stand;
  for (const ev of r.events) {
    gamePcLog({ spiel: 'rl', ev, gesendet: anRegie('rl', ev), sim });
  }
  if (r.events.length || Date.now() - rl.statusGesendet > 500) { statusAnRegie('rl', r.status, r.stand); rl.statusGesendet = Date.now(); }
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

const alterVon = (t) => (t ? Math.round((Date.now() - t) / 1000) : null);

// Dota 2: wie CS2 eine cfg-Datei, dazu die Startoption -gamestateintegration in Steam
async function dotaCheck() {
  const g = cfg.gamepc, gs = gsi.status();
  const ordner = await findeDotaCfgOrdner();
  const datei = ordner ? path.join(ordner, DOTA_CFG_DATEI) : '';
  let inhalt = null;
  try { if (datei) inhalt = fs.readFileSync(datei, 'utf8'); } catch {}
  const norm = (x) => String(x).replace(/\r\n/g, '\n').trim();
  const passt = inhalt != null && norm(inhalt) === norm(dotaCfg({ port: g.gsiPort, token: g.gsiToken }));
  const optionen = (await steamLocalConfigs()).map(dotaStartoptionen).filter((x) => x != null);
  const mitOption = optionen.some((o) => o.split(/\s+/).includes(DOTA_STARTOPTION));
  const alter = alterVon(daten.dota2?.letzte);
  return [
    { id: 'dota-installiert', label: 'Dota 2 gefunden', ok: !!ordner, detail: ordner ? path.dirname(ordner) : 'nicht in den Steam-Bibliotheken' },
    { id: 'dota-cfg', label: 'cfg-Datei installiert', ok: inhalt != null, detail: inhalt != null ? DOTA_CFG_DATEI : 'fehlt' },
    { id: 'dota-aktuell', label: 'cfg-Datei passt zu dieser App', ok: passt, detail: inhalt == null ? '–' : passt ? 'Port und Token stimmen' : 'veraltet, neu installieren' },
    { id: 'dota-start', label: `Startoption ${DOTA_STARTOPTION}`, ok: mitOption, warn: !optionen.length, detail: mitOption ? 'in Steam eingetragen' : optionen.length ? 'fehlt: Steam → Dota 2 → Eigenschaften → Startoptionen' : 'nicht prüfbar, in Steam selbst nachsehen' },
    { id: 'dota-empfang', label: 'Empfang bereit', ok: !!gs.laeuft, detail: gs.fehler || `127.0.0.1:${gs.port} (wie CS2)` },
    { id: 'dota-daten', label: 'Dota 2 sendet Daten', ok: alter != null && alter < 15, detail: alter == null ? 'noch nichts empfangen, Dota 2 starten' : `zuletzt vor ${alter} s` },
  ];
}

// Overwolf-Spiele: GEP geladen? Welches Spiel läuft, kommen Daten?
function gepCheck() {
  const st = gep.status();
  const punkte = [
    { id: 'gep-geladen', label: 'Overwolf-Spieldaten (GEP) geladen', ok: st.geladen, detail: st.geladen ? `GEP ${st.version || ''}`.trim() : st.fehler || (st.laedt ? 'wird geladen …' : 'nicht geladen: braucht Overwolf-Freigabe und signierte App') },
    ...(st.admin ? [{ id: 'gep-admin', label: 'Spiel läuft als Administrator', ok: false, detail: 'Advanced LAN auch als Administrator starten' }] : []),
    ...(st.geladen && st.fehler ? [{ id: 'gep-fehler', label: 'GEP meldet einen Fehler', ok: false, warn: true, detail: st.fehler }] : []),
  ];
  const spiele = GEP_SPIELE.map((d) => {
    const alter = alterVon(daten[d.id]?.letzte), laeuft = st.spiel?.id === d.id;
    return { id: `gep-${d.id}`, spiel: d.id, label: d.name, ok: alter != null && alter < 15, warn: true, detail: alter != null && alter < 15 ? `Daten vor ${alter} s` : laeuft ? 'läuft, wartet auf Daten' : 'nicht gestartet' };
  });
  return { punkte, spiele };
}

// „Ist korrekt aufgesetzt“-Check des Game-PCs
// CS2 und Rocket League gibt es nicht für macOS: dort nicht suchen, sondern das sagen
const OHNE_MAC = (spiel) => [{ id: 'plattform', label: `${spiel} gibt es nicht für macOS`, ok: false, warn: true, nichtVerfuegbar: true, detail: 'Game-PC mit diesem Spiel nur unter Windows' }];

async function setupCheck() {
  const g = cfg.gamepc, c = client.info(), gs = gsi.status();
  // Standalone: keine Session nötig, die Spiele melden direkt an die Regie auf diesem PC
  const allgemein = cfg.modus === 'standalone' ? [] : [
    { id: 'pcid', label: 'PC-ID eingetragen', ok: !!g.pcId.trim(), detail: g.pcId.trim() || 'fehlt' },
    { id: 'session', label: 'Mit einer Session verbunden', ok: c.zustand === 'verbunden', detail: c.zustand === 'verbunden' ? c.session : c.grund || 'nicht verbunden' },
  ];
  // GEP gibt es nur unter Windows (Overwolf); Dota 2 läuft auch auf dem Mac
  const gepMac = { punkte: [{ id: 'gep-plattform', label: 'Overwolf-Spieldaten nur unter Windows', ok: false, warn: true, nichtVerfuegbar: true, detail: 'Overwatch 2, R6, Marvel Rivals, Fortnite, Apex und PUBG nur auf Windows-PCs' }], spiele: [] };
  if (process.platform === 'darwin') return { allgemein, cs2: OHNE_MAC('Counter-Strike 2'), rl: OHNE_MAC('Rocket League'), dota2: await dotaCheck(), gep: gepMac, plattform: 'darwin' };
  const ordner = await findeCs2CfgOrdner();
  const datei = ordner ? path.join(ordner, CFG_DATEI) : '';
  let inhalt = null;
  try { if (datei) inhalt = fs.readFileSync(datei, 'utf8'); } catch {}
  const norm = (x) => String(x).replace(/\r\n/g, '\n').trim();
  const passt = inhalt != null && norm(inhalt) === norm(gsiCfg({ port: g.gsiPort, token: g.gsiToken }));
  const alter = gp.letzte ? Math.round((Date.now() - gp.letzte) / 1000) : null;
  return {
    allgemein,
    plattform: process.platform,
    cs2: [
      { id: 'installiert', label: 'CS2 gefunden', ok: !!ordner, detail: ordner || 'nicht in den Steam-Bibliotheken' },
      { id: 'cfg', label: 'cfg-Datei installiert', ok: inhalt != null, detail: inhalt != null ? CFG_DATEI : 'fehlt' },
      { id: 'aktuell', label: 'cfg-Datei passt zu dieser App', ok: passt, detail: inhalt == null ? '–' : passt ? 'Port und Token stimmen' : 'veraltet, neu installieren' },
      { id: 'empfang', label: 'Empfang bereit', ok: !!gs.laeuft, detail: gs.fehler || `127.0.0.1:${gs.port}` },
      { id: 'daten', label: 'CS2 sendet Daten', ok: alter != null && alter < 15, detail: alter == null ? 'noch nichts empfangen, CS2 starten' : `zuletzt vor ${alter} s` },
      ...(gp.fremd ? [{ id: 'token', label: 'Kein fremder Token', ok: false, detail: `${gp.fremd} Nachrichten mit falschem Token` }] : []),
    ],
    rl: await rlCheck(),
    dota2: await dotaCheck(),
    gep: process.platform === 'win32' ? gepCheck() : gepMac,
  };
}

/* ── Modus wechseln ───────────────────────────────────────────────────── */
async function modusStarten() {
  regieSim.stop();
  gpSim.neu();
  await session.schliessen();
  clearInterval(spielCheck);
  client.trennen();
  discovery.stop();
  rlClient.stop();
  await gsi.stop();
  lokalAbmelden();
  spielAufRegie = '';
  if (istRegie()) {
    // Im Standalone darf die Session offen sein: dann kommen weitere Game-PCs dazu
    if (cfg.regie.session.offen && cfg.regie.session.passwort) await session.oeffnen();
    if (cfg.modus === 'regie') { // Standalone: hier läuft das Spiel absichtlich
      pruefeSpielProzesse();
      spielCheck = setInterval(pruefeSpielProzesse, 15000);
    }
  }
  if (hatSpiele()) {
    quelle = new CsQuelle();
    await gsi.start(Number(cfg.gamepc.gsiPort));
    rlQuelle = new RlQuelle();
    neueQuellen();
    rlClient.start(Number(cfg.gamepc.rlPort));
  }
  if (cfg.modus === 'gamepc') {
    discovery.start();
    autoWartet = !!(cfg.gamepc.autoVerbinden && cfg.gamepc.regie.id && cfg.gamepc.passwort && cfg.gamepc.pcId);
  }
  if (cfg.modus === 'standalone') lokalAnmelden();
  await stats.anwenden();
  statusMelden();
}

function gesamtStatus() {
  const s = { modus: cfg.modus, jetzt: Date.now(), app: { hotkeyFehler, plattform: process.platform } };
  if (istRegie()) s.regie = { ...regie.snapshot(), session: session.status(), sim: regieSim.status(), armed: cfg.regie.armed, spielAufRegie, stats: stats.status(), lokal: lokalPc };
  if (hatSpiele()) s.gamepc = { client: client.info(), sessions: discovery.liste(), discoveryFehler: discovery.fehler, gsi: gsi.status(), letzte: gp.letzte, status: gp.status, stand: gp.stand, fremd: gp.fremd, sim: { ...gpSim.status(), spiel: gpSimSpiel }, rl: { ...rlClient.status(), letzte: rl.letzte, stand: rl.stand }, daten, gep: gep.status() };
  return s;
}

/* ── Fenster ──────────────────────────────────────────────────────────── */
function createWindow() {
  // Startanimation wie im Netzwerkplaner: Controller, dessen Tasten nacheinander gedrückt werden
  const splash = new BrowserWindow({
    name: 'splash', width: 380, height: 240, frame: false, resizable: false, center: true,
    alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#131118',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  splash.loadFile(path.join(root, 'src', 'main', 'splash.html'));
  const iconPath = path.join(root, 'assets', 'app-icon', 'icon.png');
  // name: Fenstername für die Statistik im Overwolf Developers Console (electron.d.ts von ow-electron, „name?: string“)
  mainWin = new BrowserWindow({
    name: 'desktop', width: 1480, height: 940, minWidth: 1100, minHeight: 680,
    title: 'Advanced LAN', show: false, backgroundColor: '#131118',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(root, 'src', 'preload', 'preload.js') },
  });
  mainWin.setMenuBarVisibility(false);
  mainWin.loadFile(path.join(root, 'dist-app', 'index.html'));
  let appBereit = false, animationFertig = false, gezeigt = false;
  const zeigen = () => {
    if (gezeigt || !appBereit || !animationFertig) return;
    gezeigt = true;
    splash.webContents.executeJavaScript('document.body.style.opacity="0"').catch(() => {});
    setTimeout(() => {
      hauptGezeigt = true;
      mainWin.show(); mainWin.focus();
      if (!splash.isDestroyed()) splash.close();
    }, 250);
  };
  mainWin.once('ready-to-show', () => { appBereit = true; zeigen(); });
  setTimeout(() => { animationFertig = true; zeigen(); }, 1900);
  for (const ev of ['minimize', 'restore', 'hide', 'show']) mainWin.on(ev, () => setImmediate(overlayAktualisieren));
  mainWin.on('closed', () => { if (overlayWin) overlayWin.destroy(); stats.beenden(); });
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

/* ── Mini-Overlay (Game-PC) ───────────────────────────────────────────── */
// Kleines App-Icon mit Status-Punkt über allen Fenstern, nur solange die App minimiert ist.
// Normales Fenster ganz oben: sichtbar über Spielen im Fenster- oder randlosen Vollbild.
let overlayWin = null;
let hauptGezeigt = false; // vor dem ersten Zeigen (Startanimation) nie ein Overlay
const OVERLAY_GROESSE = 64;

function overlayErzeugen() {
  const o = cfg.gamepc.overlay || {};
  const wa = screen.getPrimaryDisplay().workArea;
  const x = Number.isFinite(o.x) ? o.x : wa.x + wa.width - OVERLAY_GROESSE - 24;
  const y = Number.isFinite(o.y) ? o.y : wa.y + 24;
  overlayWin = new BrowserWindow({
    name: 'overlay', width: OVERLAY_GROESSE, height: OVERLAY_GROESSE, x, y,
    frame: false, transparent: true, resizable: false, movable: true, minimizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, hasShadow: false, focusable: false, show: false, alwaysOnTop: true, title: 'Advanced LAN Overlay',
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(root, 'src', 'preload', 'overlay-preload.js') },
  });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'darwin') overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWin.loadFile(path.join(root, 'src', 'main', 'overlay.html'));
  overlayWin.webContents.once('did-finish-load', overlayMelden);
  overlayWin.on('closed', () => { overlayWin = null; });
}

function overlayAktualisieren() {
  const soll = cfg.modus === 'gamepc' && cfg.gamepc.overlay?.an && mainWin && !mainWin.isDestroyed() && hauptGezeigt && (mainWin.isMinimized() || !mainWin.isVisible());
  if (soll) {
    if (!overlayWin) overlayErzeugen();
    overlayWin.showInactive();
    overlayMelden();
  } else if (overlayWin) overlayWin.hide();
}

function overlayMelden() {
  if (!overlayWin || overlayWin.isDestroyed() || cfg.modus !== 'gamepc') return;
  const weitere = Object.fromEntries(Object.entries(daten).map(([id, d]) => [SPIEL_BY_ID[id]?.name || id, d.letzte]));
  const hotkey = cfg.app.hotkey && !hotkeyFehler ? hotkeyText(cfg.app.hotkey, process.platform) : '';
  overlayWin.webContents.send('overlay-status', { ...overlayStatus({ client: client.info(), gsi: gsi.status(), letzteCs2: gp.letzte, letzteRl: rl.letzte, weitere, jetzt: Date.now() }), hotkey });
}

ipcMain.on('overlay-ziehen', (_, dx, dy) => {
  if (!overlayWin) return;
  const [x, y] = overlayWin.getPosition();
  overlayWin.setPosition(Math.round(x + (Number(dx) || 0)), Math.round(y + (Number(dy) || 0)));
});
ipcMain.on('overlay-abgelegt', () => {
  if (!overlayWin) return;
  const [x, y] = overlayWin.getPosition();
  cfg.gamepc.overlay = { ...cfg.gamepc.overlay, x, y };
  speichereKonfig();
});
ipcMain.handle('overlay-zuruecksetzen', () => {
  cfg.gamepc.overlay = { ...cfg.gamepc.overlay, x: null, y: null };
  speichereKonfig();
  if (overlayWin) { overlayWin.destroy(); overlayWin = null; }
  overlayAktualisieren();
});
ipcMain.on('overlay-oeffnen', () => {
  if (!mainWin) return;
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
  overlayAktualisieren();
});
setInterval(overlayMelden, 2000).unref(); // Daten veralten auch ohne neue Meldung

/* ── Tastenkürzel ─────────────────────────────────────────────────────── */
// Blendet die App ein und aus, auch mitten im Spiel (Overwolf: Hotkey und Hotkey-Erinnerung in den Einstellungen)
function fensterUmschalten() {
  if (!mainWin || mainWin.isDestroyed()) return;
  if (mainWin.isVisible() && !mainWin.isMinimized() && mainWin.isFocused()) mainWin.minimize();
  else { if (mainWin.isMinimized()) mainWin.restore(); mainWin.show(); mainWin.focus(); }
  overlayAktualisieren();
}
function hotkeyAnwenden() {
  const soll = cfg.app.hotkey || '';
  if (soll === hotkeyAktiv && !hotkeyFehler) return;
  if (hotkeyAktiv) globalShortcut.unregister(hotkeyAktiv);
  hotkeyAktiv = ''; hotkeyFehler = '';
  if (!soll) return;
  let ok = false;
  try { ok = globalShortcut.register(soll, fensterUmschalten); } catch { ok = false; }
  if (ok) hotkeyAktiv = soll;
  else hotkeyFehler = 'belegt: eine andere App nutzt dieses Tastenkürzel schon';
}

/* ── Datenschutz (Overwolf CMP) ───────────────────────────────────────── */
// ow-electron-types.d.ts: app.overwolf.isCMPRequired() und app.overwolf.openAdPrivacySettingsWindow()
ipcMain.handle('cmp-pruefen', async () => {
  const ow = app.overwolf;
  if (!ow?.isCMPRequired) return { verfuegbar: false, erforderlich: false };
  return { verfuegbar: true, erforderlich: await ow.isCMPRequired() };
});
ipcMain.handle('privacy-oeffnen', async () => {
  const ow = app.overwolf;
  if (!ow?.openAdPrivacySettingsWindow) return { fehler: 'Nur in der Overwolf-Version der App verfügbar.' };
  try { await ow.openAdPrivacySettingsWindow({ parent: mainWin, modal: true, backgroundColor: '#131118' }); return { ok: true }; }
  catch (e) { return { fehler: `Datenschutz-Einstellungen nicht geöffnet: ${e?.message || e}` }; }
});
ipcMain.handle('feedback-oeffnen', () => {
  shell.openExternal(feedbackUrl({ version: app.getVersion(), plattform: process.platform, system: `${os.type()} ${os.release()} (${process.arch})`, modus: cfg.modus }));
});

/* ── IPC ──────────────────────────────────────────────────────────────── */
ipcMain.handle('app-version', () => app.getVersion());
const updates = einrichtenUpdates({ app, ipcMain, shell, getWin: () => mainWin });
ipcMain.handle('config-get', () => cfg);
ipcMain.handle('config-set', async (_, neu) => {
  const alt = cfg;
  cfg = { ...migrateKonfig(neu), modus: alt.modus };
  cfg.regie.armed = !!neu.regie?.armed;
  cfg.regie.session.offen = alt.regie.session.offen; // offen/zu steuern nur die Session-Knöpfe
  if (client.zustand !== 'getrennt' && client.zustand !== 'abgelehnt') cfg.gamepc.pcId = alt.gamepc.pcId; // PC-ID nur ohne aktive Session änderbar
  cfg.gamepc.overlay = { ...cfg.gamepc.overlay, x: alt.gamepc.overlay?.x ?? null, y: alt.gamepc.overlay?.y ?? null }; // Position setzt nur das Overlay selbst
  speichereKonfig();
  if (cfg.app.hotkey !== alt.app.hotkey) hotkeyAnwenden();
  overlayAktualisieren();
  if (istRegie()) {
    if (session.offen && (cfg.regie.netz.empfang !== alt.regie.netz?.empfang)) await session.oeffnen();
    if (cfg.regie.aktivesSpiel !== alt.regie.aktivesSpiel) session.spielGewechselt();
    else if (session.offen && cfg.regie.session.name !== alt.regie.session.name) session.ausrufen();
    if (session.offen && (cfg.regie.session.port !== alt.regie.session.port || cfg.regie.session.passwort !== alt.regie.session.passwort)) await session.oeffnen();
  }
  if (hatSpiele() && cfg.gamepc.gsiPort !== alt.gamepc.gsiPort) await gsi.start(Number(cfg.gamepc.gsiPort));
  if (hatSpiele() && cfg.gamepc.rlPort !== alt.gamepc.rlPort) rlClient.start(Number(cfg.gamepc.rlPort));
  if (cfg.modus === 'standalone' && lokalPc !== lokalId()) lokalAnmelden();
  if (istRegie() && JSON.stringify(cfg.regie.stats) !== JSON.stringify(alt.regie.stats)) await stats.anwenden();
  if (cfg.modus === 'gamepc' && cfg.gamepc.netz !== alt.gamepc.netz) {
    // Andere Karte: Sessions dort neu suchen und eine bestehende Verbindung darüber neu aufbauen
    discovery.stop(); discovery.start();
    if (client.ziel) client.verbinden(client.ziel);
  }
  statusMelden();
  return gesamtStatus();
});
ipcMain.handle('modus-setzen', async (_, modus) => {
  cfg.modus = MODI.includes(modus) ? modus : null;
  speichereKonfig();
  await modusStarten();
  overlayAktualisieren();
  return gesamtStatus();
});
ipcMain.handle('status', () => gesamtStatus());
ipcMain.handle('netz-adressen', () => karten());

// Regie
ipcMain.handle('regie-log', () => regie.alleLogs());
ipcMain.handle('zaehler-zuruecksetzen', () => { regie.zuruecksetzen(); return true; });
ipcMain.handle('session-oeffnen', async () => { const ok = await session.oeffnen(); cfg.regie.session.offen = ok; speichereKonfig(); return gesamtStatus(); });
ipcMain.handle('session-schliessen', async () => { await session.schliessen(); cfg.regie.session.offen = false; speichereKonfig(); return gesamtStatus(); });
ipcMain.handle('pc-trennen', (_, pcId) => { session.trennen(pcId); });
ipcMain.handle('event-ausloesen', (_, ev) => regie.fire({ round: regie.stand?.runde, map: regie.stand?.map, ...ev, spiel: cfg.regie.aktivesSpiel, pc: 'Regie', pcId: 'regie' }, 'manuell'));
ipcMain.handle('signal-testen', (_, spiel, type, zuweisung) => regie.testeZuweisung(spiel, type, zuweisung));
ipcMain.handle('ziel-testen', async (_, zielId) => {
  const ziel = cfg.regie.targets.find((t) => t.id === zielId);
  if (!ziel) return { fehler: 'Ziel nicht gefunden' };
  try { const n = testNachricht(ziel); await oscSenden({ ziel, ...n }); return { ok: true, nachricht: zeigeNachricht(n) }; }
  catch (e) { return { fehler: e.message }; }
});
ipcMain.handle('sim-start', (_, modus) => { regieSim.start(modus, cfg.regie.aktivesSpiel); return regieSim.status(); });
ipcMain.handle('sim-stop', () => { regieSim.stop(); return regieSim.status(); });
ipcMain.handle('sim-neu', () => { regieSim.neu(); return regieSim.status(); });
// Game-Stats-Screen
ipcMain.handle('stats-fenster', (_, offen) => { if (offen === false) stats.fensterSchliessen(); else stats.fensterOeffnen(); statusMelden(); return stats.status(); });
ipcMain.handle('stats-vollbild', () => stats.vollbild());
ipcMain.handle('ndi-pruefen', () => stats.ndiVerfuegbar());

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
ipcMain.handle('dota-cfg-installieren', async () => {
  const ordner = await findeDotaCfgOrdner();
  if (!ordner) return { fehler: 'Dota-2-Ordner nicht gefunden. Bitte „Speichern unter …“ nehmen.' };
  try { fs.mkdirSync(ordner, { recursive: true }); fs.writeFileSync(path.join(ordner, DOTA_CFG_DATEI), dotaCfg({ port: cfg.gamepc.gsiPort, token: cfg.gamepc.gsiToken })); }
  catch (e) { return { fehler: e.message }; }
  return { ok: true, pfad: path.join(ordner, DOTA_CFG_DATEI) };
});
ipcMain.handle('dota-cfg-speichern', async () => {
  const r = await dialog.showSaveDialog(mainWin, { defaultPath: DOTA_CFG_DATEI, filters: [{ name: 'Dota-2-Konfiguration', extensions: ['cfg'] }] });
  if (r.canceled || !r.filePath) return { abgebrochen: true };
  fs.writeFileSync(r.filePath, dotaCfg({ port: cfg.gamepc.gsiPort, token: cfg.gamepc.gsiToken }));
  return { ok: true, pfad: r.filePath };
});
// Einzelnes Event von diesem PC an die Regie (Tab „Simulator“)
ipcMain.handle('test-event', (_, type, spiel = 'cs2', team = '', kills = 1) => {
  const stand = spiel === 'rl' ? rl.stand : spiel === 'cs2' ? gp.stand : daten[spiel]?.stand;
  const ev = { type: String(type), team: String(team || ''), player: cfg.gamepc.pcId, kills: Number(kills) || 1, round: stand?.runde ?? 0, map: stand?.map || '', test: true };
  const ok = anRegie(spiel, ev);
  gamePcLog({ spiel, ev, gesendet: ok, sim: true });
  return { ok };
});
ipcMain.handle('gamepc-sim-start', (_, modus) => gamePcSimStart(modus));
ipcMain.handle('gamepc-sim-stop', () => { gpSim.stop(); });
ipcMain.handle('gamepc-sim-neu', () => { gpSim.neu(); });
ipcMain.handle('open-external', (_, url) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); });

/* ── Start ────────────────────────────────────────────────────────────── */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => { if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.focus(); } });
  app.whenReady().then(async () => {
    ladeKonfig();
    createWindow();
    hotkeyAnwenden();
    updates.autoUpdaterStarten();
    await modusStarten();
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', async () => {
    regieSim.stop();
    gpSim.stop();
    client.trennen();
    rlClient.stop();
    discovery.stop();
    await Promise.allSettled([session.schliessen(), gsi.stop(), stats.beenden()]);
    osc.close();
    app.quit();
  });
}
