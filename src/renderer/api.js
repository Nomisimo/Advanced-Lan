// Zugriff auf den Hauptprozess. Im Browser (Vorschau ohne Electron) läuft dieselbe Regie-Logik lokal ohne Netzwerk.
import { Regie } from "../core/regie.js";
import { RegieSim } from "../core/regie-sim.js";
import { migrateKonfig } from "../core/defaults.js";
import { gsiCfg, CFG_DATEI } from "../core/cfg.js";
import { rlIni, RL_INI_DATEI } from "../core/rl-ini.js";
import { testNachricht, zeigeNachricht } from "../core/signal.js";

export const isElectron = typeof window !== "undefined" && !!window.regieAPI;

function browserApi() {
  const KEY = "advancedlan_konfig";
  let cfg;
  try { cfg = migrateKonfig(JSON.parse(localStorage.getItem(KEY))); } catch { cfg = migrateKonfig(null); }
  const speichern = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} };
  const hoerer = { status: new Set(), meldung: new Set(), regieEvent: new Set(), gamePcEvent: new Set() };
  const melde = (k, d) => hoerer[k].forEach((cb) => cb(d));
  let sessionOffen = false;
  const gp = { zustand: "getrennt", log: [], nr: 0 };
  // Vorschau: zwei Regien im Netz
  const SESSIONS = [
    { id: "LAN-Party (REGIE-PC)", session: "LAN-Party", host: "REGIE-PC", ip: "192.168.1.20", port: 47801, aktivesSpiel: "cs2" },
    { id: "Bühne 2 (REGIE-2)", session: "Bühne 2", host: "REGIE-2", ip: "192.168.1.21", port: 47801, aktivesSpiel: "rl" },
  ];
  const status = () => {
    const s = { modus: cfg.modus, jetzt: Date.now(), vorschau: true };
    if (cfg.modus === "regie") s.regie = { ...regie.snapshot(), session: { offen: sessionOffen, port: cfg.regie.session.port, fehler: "", verbunden: 0 }, sim: sim.status(), armed: cfg.regie.armed, spielAufRegie: "" };
    if (cfg.modus === "gamepc") s.gamepc = {
      client: { zustand: gp.zustand, grund: "", session: gp.zustand === "verbunden" ? cfg.gamepc.regie.session : "", aktivesSpiel: "cs2", ziel: null, gesendet: gp.log.filter((e) => e.gesendet).length, verworfen: 0 },
      sessions: SESSIONS,
      discoveryFehler: "", gsi: { laeuft: true, port: cfg.gamepc.gsiPort, fehler: "" }, letzte: 0, status: null, stand: null, fremd: 0,
      rl: { verbunden: false, port: cfg.gamepc.rlPort, letzte: 0, stand: null },
    };
    return s;
  };
  const statusMelden = () => melde("status", status());
  const regie = new Regie({
    getConfig: () => cfg.regie,
    send: () => Promise.resolve(),
    emit: (typ, d) => { if (typ === "event") melde("regieEvent", d); statusMelden(); },
  });
  const sim = new RegieSim({ regie, onChange: statusMelden });
  const abo = (k) => (cb) => { hoerer[k].add(cb); return () => hoerer[k].delete(cb); };
  const download = (name, text) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text])); a.download = name; a.click(); };
  return {
    appVersion: async () => __APP_VERSION__,
    getConfig: async () => cfg,
    setConfig: async (neu) => {
      const pcId = cfg.gamepc.pcId;
      cfg = { ...migrateKonfig(neu), modus: cfg.modus };
      cfg.regie.armed = !!neu.regie?.armed;
      if (gp.zustand === "verbunden") cfg.gamepc.pcId = pcId; // PC-ID nur ohne aktive Session
      speichern(); return status();
    },
    setModus: async (m) => { cfg.modus = m; speichern(); sim.neu(); return status(); },
    status: async () => status(),
    netzAdressen: async () => [{ name: "Vorschau", ip: "192.168.1.20" }],
    onStatus: abo("status"),
    onMeldung: abo("meldung"),
    openExternal: async (url) => window.open(url, "_blank"),
    regieLog: async () => regie.alleLogs(),
    sessionOeffnen: async () => { sessionOffen = !!cfg.regie.session.passwort; return status(); },
    sessionSchliessen: async () => { sessionOffen = false; return status(); },
    pcTrennen: async () => {},
    eventAusloesen: async (ev) => regie.fire({ round: regie.stand?.runde, map: regie.stand?.map, ...ev, spiel: cfg.regie.aktivesSpiel, pc: "Regie", pcId: "regie" }, "manuell"),
    signalTesten: async (spiel, type, z) => regie.testeZuweisung(spiel, type, z),
    overlayZuruecksetzen: async () => {},
    zielTesten: async (id) => { const z = cfg.regie.targets.find((t) => t.id === id); return z ? { ok: true, nachricht: zeigeNachricht(testNachricht(z)) } : { fehler: "Ziel nicht gefunden" }; },
    simStart: async (m) => { sim.start(m, cfg.regie.aktivesSpiel); return sim.status(); },
    simStop: async () => { sim.stop(); return sim.status(); },
    simNeu: async () => { sim.neu(); return sim.status(); },
    onRegieEvent: abo("regieEvent"),
    gamePcLog: async () => [...gp.log],
    verbinden: async () => {
      const g = cfg.gamepc;
      if (!g.pcId.trim()) return { fehler: "Zuerst eine PC-ID eintragen" };
      if (!g.regie.id) return { fehler: "Zuerst eine Session wählen" };
      if (!g.passwort) return { fehler: "Passwort fehlt" };
      gp.zustand = "verbunden"; statusMelden(); return { ok: true };
    },
    setupCheck: async () => ({
      allgemein: [
        { id: "pcid", label: "PC-ID eingetragen", ok: !!cfg.gamepc.pcId.trim(), detail: cfg.gamepc.pcId.trim() || "fehlt" },
        { id: "session", label: "Mit einer Session verbunden", ok: gp.zustand === "verbunden", detail: gp.zustand === "verbunden" ? cfg.gamepc.regie.session : "nicht verbunden" },
      ],
      cs2: [
        { id: "installiert", label: "CS2 gefunden", ok: true, detail: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg" },
        { id: "cfg", label: "cfg-Datei installiert", ok: true, detail: CFG_DATEI },
        { id: "aktuell", label: "cfg-Datei passt zu dieser App", ok: true, detail: "Port und Token stimmen" },
        { id: "empfang", label: "Empfang bereit", ok: true, detail: `127.0.0.1:${cfg.gamepc.gsiPort}` },
        { id: "daten", label: "CS2 sendet Daten", ok: false, detail: "In der Vorschau kein CS2" },
      ],
      rl: [
        { id: "rl-installiert", label: "Rocket League gefunden", ok: true, detail: "C:\\Program Files\\Epic Games\\rocketleague\\TAGame\\Config" },
        { id: "rl-ini", label: "Stats API eingeschaltet", ok: true, detail: "10 Updates pro Sekunde" },
        { id: "rl-port", label: "Port passt zu dieser App", ok: true, detail: "WebSocket 49124" },
        { id: "rl-verbunden", label: "Mit Rocket League verbunden", ok: false, detail: "Rocket League läuft nicht oder Stats API aus" },
        { id: "rl-daten", label: "Rocket League sendet Daten", ok: false, detail: "In der Vorschau kein Rocket League" },
      ],
    }),
    trennen: async () => { gp.zustand = "getrennt"; statusMelden(); },
    cs2Ordner: async () => null,
    cfgInstallieren: async () => ({ fehler: "In der Browser-Vorschau nicht möglich." }),
    rlIniInstallieren: async () => ({ fehler: "In der Browser-Vorschau nicht möglich." }),
    rlIniSpeichern: async () => { download(RL_INI_DATEI, rlIni({ webPort: cfg.gamepc.rlPort })); return { ok: true, pfad: RL_INI_DATEI }; },
    cfgSpeichern: async () => { download(CFG_DATEI, gsiCfg({ port: cfg.gamepc.gsiPort, token: cfg.gamepc.gsiToken })); return { ok: true, pfad: CFG_DATEI }; },
    testEvent: async (type) => {
      const e = { id: ++gp.nr, t: Date.now(), spiel: "cs2", ev: { type, team: "CT", player: cfg.gamepc.pcId, test: true }, gesendet: gp.zustand === "verbunden" };
      gp.log.unshift(e); melde("gamePcEvent", e); statusMelden(); return { ok: e.gesendet };
    },
    onGamePcEvent: abo("gamePcEvent"),
  };
}

export const api = isElectron ? window.regieAPI : browserApi();
