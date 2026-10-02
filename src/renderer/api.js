// Zugriff auf den Hauptprozess. Im Browser (Vorschau ohne Electron) läuft dieselbe Regie-Logik lokal ohne Netzwerk.
import { Regie } from "../core/regie.js";
import { RegieSim } from "../core/regie-sim.js";
import { migrateKonfig } from "../core/defaults.js";
import { gsiCfg, CFG_DATEI } from "../core/cfg.js";

export const isElectron = typeof window !== "undefined" && !!window.regieAPI;

function browserApi() {
  const KEY = "lanregie_konfig";
  let cfg;
  try { cfg = migrateKonfig(JSON.parse(localStorage.getItem(KEY))); } catch { cfg = migrateKonfig(null); }
  const speichern = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} };
  const hoerer = { status: new Set(), meldung: new Set(), regieEvent: new Set(), gamePcEvent: new Set() };
  const melde = (k, d) => hoerer[k].forEach((cb) => cb(d));
  let sessionOffen = false;
  const gp = { zustand: "getrennt", log: [], nr: 0 };
  const status = () => {
    const s = { modus: cfg.modus, jetzt: Date.now(), vorschau: true };
    if (cfg.modus === "regie") s.regie = { ...regie.snapshot(), session: { offen: sessionOffen, port: cfg.regie.session.port, fehler: "", verbunden: 0 }, sim: sim.status(), armed: cfg.regie.armed, spielAufRegie: "" };
    if (cfg.modus === "gamepc") s.gamepc = {
      client: { zustand: gp.zustand, grund: "", session: gp.zustand === "verbunden" ? cfg.gamepc.regie.session : "", aktivesSpiel: "cs2", ziel: null, gesendet: gp.log.filter((e) => e.gesendet).length, verworfen: 0 },
      sessions: [{ session: "LAN-Party", host: "REGIE-PC", ip: "192.168.1.20", port: 47801, aktivesSpiel: "cs2", pcs: 3, t: Date.now() }],
      discoveryFehler: "", gsi: { laeuft: true, port: cfg.gamepc.gsiPort, fehler: "" }, letzte: 0, status: null, stand: null, fremd: 0,
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
    setConfig: async (neu) => { cfg = { ...neu, modus: cfg.modus }; speichern(); return status(); },
    setModus: async (m) => { cfg.modus = m; speichern(); sim.neu(); return status(); },
    status: async () => status(),
    netzAdressen: async () => [{ name: "Vorschau", ip: "192.168.1.20" }],
    onStatus: abo("status"),
    onMeldung: abo("meldung"),
    openExternal: async (url) => window.open(url, "_blank"),
    regieLog: async () => [...regie.log],
    sessionOeffnen: async () => { sessionOffen = !!cfg.regie.session.passwort; return status(); },
    sessionSchliessen: async () => { sessionOffen = false; return status(); },
    pcTrennen: async () => {},
    eventAusloesen: async (ev) => regie.fire({ round: regie.stand?.runde, map: regie.stand?.map, ...ev, spiel: cfg.regie.aktivesSpiel, pc: "Regie", pcId: "" }, "manuell"),
    regelTesten: async (id) => regie.testeRegel(id),
    zielTesten: async () => ({ ok: true }),
    simStart: async (m) => { sim.start(m); return sim.status(); },
    simStop: async () => { sim.stop(); return sim.status(); },
    simNeu: async () => { sim.neu(); return sim.status(); },
    onRegieEvent: abo("regieEvent"),
    gamePcLog: async () => [...gp.log],
    verbinden: async () => { gp.zustand = "verbunden"; statusMelden(); return { ok: true }; },
    trennen: async () => { gp.zustand = "getrennt"; statusMelden(); },
    cs2Ordner: async () => null,
    cfgInstallieren: async () => ({ fehler: "In der Browser-Vorschau nicht möglich." }),
    cfgSpeichern: async () => { download(CFG_DATEI, gsiCfg({ port: cfg.gamepc.gsiPort, token: cfg.gamepc.gsiToken })); return { ok: true, pfad: CFG_DATEI }; },
    testEvent: async (type) => {
      const e = { id: ++gp.nr, t: Date.now(), ev: { type, team: "CT", player: cfg.gamepc.pcId, test: true }, gesendet: gp.zustand === "verbunden" };
      gp.log.unshift(e); melde("gamePcEvent", e); statusMelden(); return { ok: e.gesendet };
    },
    onGamePcEvent: abo("gamePcEvent"),
  };
}

export const api = isElectron ? window.regieAPI : browserApi();
