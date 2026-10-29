// Zugriff auf den Hauptprozess. Im Browser (Vorschau ohne Electron) läuft dieselbe Regie-Logik lokal ohne Netzwerk.
import { Regie } from "../core/regie.js";
import { RegieSim } from "../core/regie-sim.js";
import { migrateKonfig } from "../core/defaults.js";
import { gsiCfg, CFG_DATEI } from "../core/cfg.js";
import { rlIni, RL_INI_DATEI } from "../core/rl-ini.js";
import { testNachricht, zeigeNachricht } from "../core/signal.js";
import { SimRunner } from "../core/sim-runner.js";
import { SimMatch } from "../core/gsi-sim.js";
import { CsQuelle } from "../core/cs-quelle.js";
import { DOTA_CFG_DATEI, DOTA_STARTOPTION, dotaCfg } from "../core/dota.js";
import { exportDatei, importDatei } from "../core/bild-spiele.js";
import { QUELLEN } from "../core/spiele.js";
import { feedbackUrl } from "../core/app-info.js";
import { SHOW_ENDUNG, ART_NAME, arten as showArten, showDatei, leseShow, showAnwenden, leereShow, alsGespeichert, dateiName as showDateiName, showDaten, vorlageAus, paketDatei } from "../core/show.js";
import { leseSpieler } from "../core/protokoll.js";

export const isElectron = typeof window !== "undefined" && !!window.regieAPI;
const VORSCHAU_BILDSCHIRM = { id: "1", name: "Bildschirm 1 (Haupt)", b: 1920, h: 1080, primaer: true };

function browserApi() {
  const KEY = "advancedlan_konfig";
  let cfg;
  try { cfg = migrateKonfig(JSON.parse(localStorage.getItem(KEY))); } catch { cfg = migrateKonfig(null); }
  const speichern = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} };
  const hoerer = { status: new Set(), meldung: new Set(), regieEvent: new Set(), gamePcEvent: new Set(), config: new Set() };
  // Game-Stats-Screen der Vorschau: eigener Tab (index.html#stats), bekommt Status und Events über einen BroadcastChannel
  const istStats = typeof location !== "undefined" && location.hash === "#stats";
  const kanal = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("advancedlan-vorschau") : null;
  let statsTab = null;
  const melde = (k, d) => { hoerer[k].forEach((cb) => cb(d)); if (kanal && !istStats && (k === "status" || k === "regieEvent")) kanal.postMessage({ k, d }); };
  let sessionOffen = false;
  const gp = { zustand: "getrennt", log: [], nr: 0 };
  // Vorschau: zwei Regien im Netz
  const SESSIONS = [
    { id: "LAN-Party (REGIE-PC)", session: "LAN-Party", host: "REGIE-PC", ip: "192.168.1.20", port: 47801, aktivesSpiel: "cs2" },
    { id: "Bühne 2 (REGIE-2)", session: "Bühne 2", host: "REGIE-2", ip: "192.168.1.21", port: 47801, aktivesSpiel: "rl" },
  ];
  const status = () => {
    const s = { modus: cfg.modus, jetzt: Date.now(), vorschau: true, app: { hotkeyFehler: "", plattform: "win32" } };
    const statsOffen = !!(statsTab && !statsTab.closed);
    if (cfg.modus === "regie" || cfg.modus === "standalone") s.regie = { ...regie.snapshot(), session: { offen: sessionOffen, port: cfg.regie.session.port, ip: "", fehler: "", verbunden: regie.snapshot().pcs.filter((p) => p.verbunden && !p.sim).length }, sim: sim.status(), armed: cfg.regie.armed, spielAufRegie: "",
      stats: { fenster: statsOffen, ndi: { verfuegbar: false, laeuft: false, name: "", verbindungen: 0, fehler: "", aufloesung: "1920×1080", fps: 30 } }, lokal: cfg.modus === "standalone" ? cfg.gamepc.pcId.trim() || "Dieser PC" : null };
    if (cfg.modus === "gamepc" || cfg.modus === "standalone") s.gamepc = {
      spieler: cfg.gamepc.spieler, spielerAnzeige: cfg.gamepc.spieler || cfg.gamepc.pcId.trim() || "Dieser PC",
      client: { zustand: gp.zustand, grund: "", session: gp.zustand === "verbunden" ? cfg.gamepc.regie.session : "", aktivesSpiel: "cs2", ziel: null, gesendet: gp.log.filter((e) => e.gesendet).length, verworfen: 0 },
      sessions: SESSIONS,
      discoveryFehler: "", gsi: { laeuft: true, port: cfg.gamepc.gsiPort, fehler: "" }, letzte: gp.letzte || 0, status: null, stand: gp.stand || null, fremd: 0,
      sim: { ...gpSim.status(), spiel: "cs2" },
      rl: { verbunden: false, port: cfg.gamepc.rlPort, letzte: 0, stand: null },
      daten: {}, bild: { spiele: {}, fehler: "", fenster: [], bildschirm: VORSCHAU_BILDSCHIRM },
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
  // Game-PC-Simulator der Vorschau: dieser PC ist Spieler 1 in einem CS2-Match
  let gpQuelle = new CsQuelle();
  const gpSim = new SimRunner({
    onChange: () => statusMelden(),
    neuesMatch: () => { const m = new SimMatch({ clients: Array.from({ length: 10 }, (_, i) => ({ token: i ? `sim${i}` : "ich" })) }); m.spieler[0].name = cfg.gamepc.pcId || "Ich"; return m; },
    deliver: (p) => {
      if (p.auth?.token !== "ich") return;
      const r = gpQuelle.ingest(p);
      gp.letzte = Date.now(); gp.stand = r.stand;
      for (const ev of r.events) { const e = { id: ++gp.nr, t: Date.now(), spiel: "cs2", ev, gesendet: gp.zustand === "verbunden", sim: true }; gp.log.unshift(e); melde("gamePcEvent", e); }
      statusMelden();
    },
  });
  // Vorschau: zwei echte Game-PCs in der Session
  const VORSCHAU_PCS = [
    ["PC 01", "192.168.1.31", "GAMER-01", "3c:7c:3f:1a:22:01", 3],
    ["PC 02", "192.168.1.32", "GAMER-02", "3c:7c:3f:1a:22:02", 41],
  ];
  const abo = (k) => (cb) => { hoerer[k].add(cb); return () => hoerer[k].delete(cb); };
  const statsMelden = () => statusMelden();
  // Vorschau-Hauptfenster antwortet dem Stats-Tab mit Status und Log; der Stats-Tab übernimmt beides
  let fremd = null, fremdLog = null;
  if (kanal && !istStats) kanal.onmessage = ({ data }) => { if (data?.k === "hallo") { kanal.postMessage({ k: "status", d: status() }); kanal.postMessage({ k: "log", d: regie.alleLogs() }); } };
  if (kanal && istStats) {
    fremdLog = new Promise((ok) => {
      setTimeout(() => ok([]), 1500);
      kanal.onmessage = ({ data }) => {
        if (data?.k === "status") { fremd = data.d; hoerer.status.forEach((cb) => cb(data.d)); }
        if (data?.k === "regieEvent") hoerer.regieEvent.forEach((cb) => cb(data.d));
        if (data?.k === "log") ok(data.d);
      };
    });
    kanal.postMessage({ k: "hallo" });
  }
  // Shows der Vorschau: Liste im localStorage, Export als Download, Import über die Dateiauswahl
  const SHOWS_KEY = "advancedlan_shows";
  const showsLesen = () => { try { return JSON.parse(localStorage.getItem(SHOWS_KEY)) || {}; } catch { return {}; } };
  const showsSchreiben = (s) => { try { localStorage.setItem(SHOWS_KEY, JSON.stringify(s)); } catch {} };
  const showsListe = () => {
    const alle = showsLesen(), out = {};
    for (const art of showArten(cfg.modus)) out[art] = Object.entries(alle[art] || {}).map(([datei, inhalt]) => { const d = leseShow(inhalt, [art]); return d.fehler ? null : { datei, name: d.name, gespeichert: d.gespeichert }; })
      .filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, "de"));
    return out;
  };
  const showAblegen = (art, datei, inhalt) => { const alle = showsLesen(); (alle[art] = alle[art] || {})[datei] = inhalt; showsSchreiben(alle); };
  const showUebernehmen = (neu, text) => {
    const pcId = cfg.gamepc.pcId;
    cfg = neu;
    if (gp.zustand === "verbunden") cfg.gamepc.pcId = pcId;
    speichern(); statusMelden(); melde("meldung", { text, art: "ok" });
    return { ok: true, cfg, status: status(), liste: showsListe() };
  };
  // Plan der Vorschau ändern wie im Hauptprozess: speichern und der Oberfläche die neuen Einstellungen geben
  const planAendern = (fn) => { fn(cfg.regie.plan); speichern(); melde("config", cfg); statusMelden(); };
  const datei = (accept) => new Promise((ok) => {
    const i = document.createElement("input"); i.type = "file"; i.accept = accept;
    i.onchange = async () => { const f = i.files?.[0]; ok(f ? await f.text() : null); };
    i.click();
  });
  const download = (name, text) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text])); a.download = name; a.click(); };
  return {
    appVersion: async () => __APP_VERSION__,
    getConfig: async () => cfg,
    setConfig: async (neu) => {
      const pcId = cfg.gamepc.pcId, spieler = cfg.gamepc.spieler;
      cfg = { ...migrateKonfig(neu), modus: cfg.modus };
      cfg.gamepc.spieler = spieler; // wie in der App: nur über spielerSetzen
      cfg.regie.armed = !!neu.regie?.armed;
      if (gp.zustand === "verbunden") cfg.gamepc.pcId = pcId; // PC-ID nur ohne aktive Session
      regie.matchAktualisieren(); // anderes Spiel oder andere Match-Wahl
      speichern(); return status();
    },
    setModus: async (m) => {
      cfg.modus = m; speichern(); sim.neu();
      for (const p of regie.snapshot().pcs.filter((x) => !x.sim && !VORSCHAU_PCS.some(([id]) => id === x.pcId))) regie.pcEntfernen(p.pcId);
      if (m === "standalone") regie.pcVerbunden(cfg.gamepc.pcId.trim() || "Dieser PC", { spiele: QUELLEN, remote: "dieser PC", spieler: cfg.gamepc.spieler, geraet: { hostname: "DIESER-PC", app: __APP_VERSION__, plattform: "win32", karte: "lokal" } });
      return status();
    },
    showsListe: async () => showsListe(),
    showSpeichern: async (art, name) => {
      if (!showArten(cfg.modus).includes(art)) return { fehler: "In diesem Modus nicht möglich." };
      const d = showDatei(cfg, art, name, { appVersion: __APP_VERSION__ });
      showAblegen(art, showDateiName(d.name, art), JSON.stringify(d));
      cfg = alsGespeichert(cfg, art, d.name); speichern();
      return { ok: true, cfg, name: d.name, liste: showsListe() };
    },
    showLaden: async (art, datei) => {
      const inhalt = showsLesen()[art]?.[datei];
      if (!inhalt || !showArten(cfg.modus).includes(art)) return { fehler: "Show nicht gefunden." };
      const d = leseShow(inhalt, [art]);
      return d.fehler ? d : showUebernehmen(showAnwenden(cfg, art, d.daten, d.name, { pcId: d.pcId }), `Show „${d.name}“ geladen. Ausgabe ist aus.`);
    },
    showLoeschen: async (art, datei) => { const alle = showsLesen(); delete alle[art]?.[datei]; showsSchreiben(alle); return { ok: true, liste: showsListe() }; },
    showLeer: async (art) => (showArten(cfg.modus).includes(art) ? showUebernehmen(leereShow(cfg, art), `Leere ${ART_NAME[art]}-Show geladen.`) : { fehler: "In diesem Modus nicht möglich." }),
    showExport: async (art, name) => { const d = showDatei(cfg, art, name, { appVersion: __APP_VERSION__ }); const n = showDateiName(d.name, art); download(n, JSON.stringify(d, null, 1)); return { ok: true, pfad: n }; },
    showImport: () => new Promise((ok) => {
      const i = document.createElement("input"); i.type = "file"; i.accept = `.${SHOW_ENDUNG},.json,application/json`;
      i.onchange = async () => {
        const f = i.files?.[0]; if (!f) return ok({ abgebrochen: true });
        const inhalt = await f.text();
        const d = leseShow(inhalt, showArten(cfg.modus));
        if (d.fehler) return ok(d);
        showAblegen(d.art, showDateiName(d.name, d.art), inhalt);
        ok({ ...showUebernehmen(showAnwenden(cfg, d.art, d.daten, d.name, { pcId: d.pcId }), `${ART_NAME[d.art]}-Show „${d.name}“ importiert. Ausgabe ist aus.`), art: d.art });
      };
      i.click();
    }),
    status: async () => (istStats ? fremd || { modus: cfg.modus, regie: null } : status()),
    netzAdressen: async () => [
      { name: "Ethernet", ip: "192.168.1.20", maske: "255.255.255.0", mac: "3c:7c:3f:1a:20:00" },
      { name: "Ethernet 2 (Licht)", ip: "2.0.0.20", maske: "255.0.0.0", mac: "00:e0:4c:68:01:20" },
      { name: "WLAN", ip: "10.10.0.7", maske: "255.255.255.0", mac: "a4:83:e7:11:02:07" },
    ],
    onStatus: abo("status"),
    onConfig: abo("config"),
    onMeldung: abo("meldung"),
    openExternal: async (url) => window.open(url, "_blank"),
    overdriveOeffnen: async () => { window.open("https://www.overwolf.com/app/raimen_ttv-automation_overdrive", "_blank"); return { art: "store", text: "In der Vorschau kein Overwolf: die Seite im Overwolf-Store ist offen." }; },
    feedbackOeffnen: async () => window.open(feedbackUrl({ version: __APP_VERSION__, system: navigator.userAgent, modus: cfg.modus }), "_blank"),
    // Updates: im Browser nur Hinweis und Download-Seite
    fetchReleases: async () => { try { const r = await fetch("https://api.github.com/repos/Nomisimo/Advanced-Lan/releases?per_page=20"); return r.ok ? r.json() : null; } catch { return null; } },
    checkForUpdates: async () => ({ auto: false, mac: false }),
    installUpdate: async (url) => window.open(url, "_blank"),
    macUpdateLaden: async () => ({ ok: false }),
    appBeenden: async () => {},
    onUpdateStatus: () => () => {},
    regieLog: async () => (istStats && fremdLog ? fremdLog : regie.alleLogs()),
    zaehlerZuruecksetzen: async () => { regie.zuruecksetzen(); return true; },
    sessionOeffnen: async () => {
      sessionOffen = !!cfg.regie.session.passwort;
      if (sessionOffen) for (const [id, ip, host, mac, ping] of VORSCHAU_PCS) {
        regie.pcVerbunden(id, { spiele: QUELLEN, remote: ip, geraet: { hostname: host, app: __APP_VERSION__, mac, karte: `Ethernet (${ip})`, plattform: "win32" } });
        regie.pcPing(id, ping);
      }
      if (sessionOffen) regie.pcHinweis(VORSCHAU_PCS[1][0], { vollbild: "exklusiv", nameOffen: true }); // so sieht die Regie ein Spiel im exklusiven Vollbild
      return status();
    },
    sessionSchliessen: async () => { sessionOffen = false; for (const [id] of VORSCHAU_PCS) regie.pcGetrennt(id); return status(); },
    pcTrennen: async () => {},
    // Vorschau: der PC übernimmt den Namen sofort, die offene Namensfrage ist damit erledigt
    regieSpielerSetzen: async (pcId, name) => { regie.pcSpieler(pcId, name); regie.pcHinweis(pcId, { ...regie.pcs.get(pcId)?.hinweis, nameOffen: false }); statusMelden(); return { ok: true }; },
    regieNameFragen: async () => ({ fehler: "Das Namens-Popup gibt es nur in der App." }),
    planVerteilen: async (pcId) => {
      const v = cfg.regie.plan.vorlage;
      if (!v || !sessionOffen) return { n: 0 };
      const pcs = regie.snapshot().pcs.filter((p) => p.verbunden && !p.sim && p.remote !== "dieser PC" && (!pcId || p.pcId === pcId));
      for (const p of pcs) regie.pcVorlage(p.pcId, v.stand);
      return { n: pcs.length };
    },
    planVorlageHolen: async (pcId) => { planAendern((plan) => { plan.vorlage = vorlageAus(showDaten(cfg, "gamepc"), pcId); }); return { ok: true }; },
    planZuordnen: async (pcId, platzId) => {
      const alt = regie.snapshot().pcs.find((p) => p.pcId === pcId);
      const rechner = alt?.geraet?.hostname || alt?.geraet?.mac;
      if (!rechner) return { fehler: "Der PC meldet keinen Rechnernamen" };
      let neu = "";
      planAendern((plan) => {
        for (const p of plan.pcs) if (p.rechner.toLowerCase() === rechner.toLowerCase()) p.rechner = "";
        const p = plan.pcs.find((x) => x.id === platzId);
        if (p) { p.rechner = rechner; neu = p.pcId; }
      });
      if (neu && neu !== pcId) { regie.pcEntfernen(pcId); regie.pcVerbunden(neu, { spiele: alt.spiele, remote: alt.remote, geraet: alt.geraet }); }
      return { ok: true };
    },
    planVorlageDatei: async () => {
      const inhalt = await datei(`.${SHOW_ENDUNG},.json,application/json`);
      if (inhalt == null) return { abbruch: true };
      const d = leseShow(inhalt, ["gamepc"]);
      if (d.fehler) return d;
      planAendern((plan) => { plan.vorlage = vorlageAus(d.daten, d.name); });
      return { ok: true, name: d.name };
    },
    planVorlageEigene: async () => { planAendern((plan) => { plan.vorlage = vorlageAus(showDaten(cfg, "gamepc"), cfg.shows.gamepc.name || "Standalone"); }); return { ok: true }; },
    planPaket: async () => {
      const { vorlage, pcs } = cfg.regie.plan;
      if (!vorlage) return { fehler: "Zuerst eine Game-PC-Vorlage wählen" };
      if (!pcs.length) return { fehler: "Der Plan hat noch keine Plätze" };
      for (const p of pcs) download(showDateiName(p.pcId, "gamepc"), JSON.stringify(paketDatei(vorlage, p.pcId, { appVersion: __APP_VERSION__ }), null, 1));
      return { ok: true, n: pcs.length, ordner: "Downloads" };
    },
    eventAusloesen: async (ev) => regie.fire({ round: regie.stand?.runde, map: regie.stand?.map, ...ev, spiel: cfg.regie.aktivesSpiel, pc: "Regie", pcId: "regie" }, "manuell"),
    signalTesten: async (spiel, type, z) => regie.testeZuweisung(spiel, type, z),
    overlayZuruecksetzen: async () => {},
    zielTesten: async (id) => { const z = cfg.regie.targets.find((t) => t.id === id); return z ? { ok: true, nachricht: zeigeNachricht(testNachricht(z)) } : { fehler: "Ziel nicht gefunden" }; },
    simStart: async (m) => { sim.start(m, cfg.regie.aktivesSpiel); return sim.status(); },
    simStop: async () => { sim.stop(); return sim.status(); },
    simNeu: async () => { sim.neu(); return sim.status(); },
    onRegieEvent: abo("regieEvent"),
    statsFenster: async (offen) => {
      if (offen === false) { if (statsTab && !statsTab.closed) statsTab.close(); statsTab = null; }
      else { statsTab = window.open(location.href.split("#")[0] + "#stats", "advancedlan-stats", "width=1280,height=720"); const t = setInterval(() => { if (!statsTab || statsTab.closed) { clearInterval(t); statsMelden(); } }, 1000); }
      statsMelden(); return status().regie?.stats;
    },
    statsVollbild: async () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); },
    gamePcLog: async () => [...gp.log],
    verbinden: async () => {
      const g = cfg.gamepc;
      if (!g.regie.id) return { fehler: "Zuerst eine Session wählen" };
      if (!g.passwort) return { fehler: "Passwort fehlt" };
      gp.zustand = "verbunden"; statusMelden(); return { ok: true };
    },
    setupCheck: async () => ({
      allgemein: cfg.modus === "standalone" ? [] : [
        { id: "pcid", label: "PC-ID eingetragen", ok: !!cfg.gamepc.pcId.trim(), warn: true, detail: cfg.gamepc.pcId.trim() || "leer: die Regie vergibt sie, wenn dieser Rechner in ihrem Plan steht" },
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
      dota2: [
        { id: "dota-installiert", label: "Dota 2 gefunden", ok: true, detail: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\dota 2 beta\\game\\dota\\cfg" },
        { id: "dota-cfg", label: "cfg-Datei installiert", ok: true, detail: DOTA_CFG_DATEI },
        { id: "dota-aktuell", label: "cfg-Datei passt zu dieser App", ok: true, detail: "Port und Token stimmen" },
        { id: "dota-start", label: `Startoption ${DOTA_STARTOPTION}`, ok: false, detail: "fehlt: Steam → Dota 2 → Eigenschaften → Startoptionen" },
        { id: "dota-empfang", label: "Empfang bereit", ok: true, detail: `127.0.0.1:${cfg.gamepc.gsiPort} (wie CS2)` },
        { id: "dota-daten", label: "Dota 2 sendet Daten", ok: false, detail: "In der Vorschau kein Dota 2" },
      ],
      bild: ["valorant", "finals"].map((id) => {
        const n = cfg.gamepc.bild.spiele[id].aktionen.length;
        return { id: `${id}-aktionen`, spiel: id, label: `${id === "valorant" ? "Valorant" : "The Finals"}: Aktionen eingerichtet`, ok: n > 0, warn: true, detail: n ? `${n} Aktionen` : "noch keine: im Tab „Bilderkennung“ anlegen oder importieren" };
      }),
      overdrive: [
        { id: "od-installiert", label: "Automation Overdrive installiert", ok: false, warn: true, detail: "fehlt: Knopf oben führt zum Store" },
        { id: "od-empfang", label: "Empfang bereit", ok: true, detail: "localhost:44206" },
        { id: "od-verbunden", label: "Automation Overdrive verbunden", ok: false, warn: true, detail: "In der Vorschau kein Overwolf" },
        { id: "od-daten", label: "Valorant-Events kommen an", ok: false, warn: true, detail: "noch keins, kommt beim ersten Kill" },
      ],
    }),
    trennen: async () => { gp.zustand = "getrennt"; gpSim.stop(); statusMelden(); },
    gamePcSimStart: async (m) => { if (gp.zustand !== "verbunden") return { fehler: "Nur mit verbundener Session" }; if (!gpSim.match) gpQuelle = new CsQuelle(); gpSim.start(m); return { ok: true }; },
    gamePcSimStop: async () => { gpSim.stop(); },
    gamePcSimNeu: async () => { gpSim.neu(); },
    spielerSetzen: async (name) => {
      cfg.gamepc.spieler = leseSpieler(name); speichern();
      if (cfg.modus === "standalone") regie.pcSpieler(cfg.gamepc.pcId.trim() || "Dieser PC", cfg.gamepc.spieler);
      statusMelden(); return status();
    },
    nameFragen: async () => ({ fehler: "Das Namens-Popup gibt es nur in der App." }),
    cs2Ordner: async () => null,
    cfgInstallieren: async () => ({ fehler: "In der Browser-Vorschau nicht möglich." }),
    dotaCfgInstallieren: async () => ({ fehler: "In der Browser-Vorschau nicht möglich." }),
    dotaCfgSpeichern: async () => { download(DOTA_CFG_DATEI, dotaCfg({ port: cfg.gamepc.gsiPort, token: cfg.gamepc.gsiToken })); return { ok: true, pfad: DOTA_CFG_DATEI }; },
    rlIniInstallieren: async () => ({ fehler: "In der Browser-Vorschau nicht möglich." }),
    rlIniSpeichern: async () => { download(RL_INI_DATEI, rlIni({ webPort: cfg.gamepc.rlPort })); return { ok: true, pfad: RL_INI_DATEI }; },
    cfgSpeichern: async () => { download(CFG_DATEI, gsiCfg({ port: cfg.gamepc.gsiPort, token: cfg.gamepc.gsiToken })); return { ok: true, pfad: CFG_DATEI }; },
    testEvent: async (type, spiel = "cs2", team = "", kills = 1) => {
      const e = { id: ++gp.nr, t: Date.now(), spiel, ev: { type, team, kills, player: cfg.gamepc.pcId, test: true }, gesendet: gp.zustand === "verbunden", sim: true };
      gp.log.unshift(e); melde("gamePcEvent", e); statusMelden(); return { ok: e.gesendet };
    },
    onGamePcEvent: abo("gamePcEvent"),
    // Bilderkennung: in der Vorschau nimmt der Browser selbst auf (getDisplayMedia fragt nach), Texterkennung gibt es nur in der App
    bildBildschirme: async () => [VORSCHAU_BILDSCHIRM],
    bildFenster: async () => ["OBS 31.0.2 - Profil: LAN", "Discord", "VALORANT"],
    bildLesen: async () => ({ fehler: "Texterkennung nur in der App" }),
    bildAufnahme: async (an) => (an === "vorbereiten" ? { art: "bildschirm", name: "Bildschirm" } : undefined),
    bildExport: async (spiel) => { download(`advanced-lan-${spiel}.json`, JSON.stringify(exportDatei(spiel, cfg.gamepc.bild.spiele[spiel]), null, 1)); return { ok: true, pfad: `advanced-lan-${spiel}.json` }; },
    bildImport: () => new Promise((ok) => {
      const i = document.createElement("input"); i.type = "file"; i.accept = ".json,application/json";
      i.onchange = async () => {
        const f = i.files?.[0]; if (!f) return ok({ abgebrochen: true });
        const d = importDatei(await f.text(), VORSCHAU_BILDSCHIRM);
        if (d.fehler) return ok(d);
        Object.assign(cfg.gamepc.bild.spiele[d.spiel], { aufloesung: d.aufloesung, aktionen: d.aktionen }); speichern(); statusMelden();
        ok({ ok: true, spiel: d.spiel, anzahl: d.aktionen.length, korrigiert: d.korrigiert, cfg });
      };
      i.click();
    }),
  };
}

export const api = isElectron ? window.regieAPI : browserApi();
