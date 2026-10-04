import React, { useState, useEffect, useCallback } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, OK, GLOW_STARK } from "../theme.js";
import { api } from "../api.js";
import Kopf from "../Kopf.jsx";
import { SPIEL_BY_ID } from "../../core/spiele.js";
import ControlTab from "./ControlTab.jsx";
import SetupTab from "./SetupTab.jsx";
import SignaleTab from "./SignaleTab.jsx";
import ZieleTab from "./ZieleTab.jsx";
import SimTab from "./SimTab.jsx";
import SessionTab from "./SessionTab.jsx";
import AnleitungTab from "../AnleitungTab.jsx";
import GpSetupTab from "../gamepc/SetupTab.jsx";
import { Gauge, ListChecks, Send, FlaskConical, BookOpen, Power, Radio, KeyRound, TriangleAlert, Settings, Gamepad2, MonitorPlay } from "lucide-react";

const TABS_REGIE = [["control", "Control", Gauge], ["signale", "Signale", ListChecks], ["ziele", "Ziele", Send], ["session", "Session", KeyRound], ["setup", "Setup", Settings], ["sim", "Simulator", FlaskConical], ["hilfe", "Anleitung", BookOpen]];
// Standalone: dazu der Tab „Spiele“ mit dem Setup der Spiele auf diesem PC (wie auf einem Game-PC)
const TABS_STANDALONE = [...TABS_REGIE.slice(0, 5), ["spiele", "Spiele", Gamepad2], ...TABS_REGIE.slice(5)];
const LOG_MAX = 300;
// Neuer Eintrag oben; kommt dieselbe ID wieder (z. B. mit einem Sendefehler), wird er ersetzt.
// Echte und verworfene Events haben je eigene Obergrenze.
function logEinfuegen(l, e) {
  const neu = l.some((x) => x.id === e.id) ? l.map((x) => (x.id === e.id ? e : x)) : [e, ...l];
  let echt = 0, verw = 0;
  return neu.filter((x) => (x.verworfen ? ++verw : ++echt) <= LOG_MAX);
}

export default function RegieApp({ cfg: alles, mutate: mutateAlles, status: st, jetzt, notify, version, modusWechseln, standalone = false }) {
  const TABS = standalone ? TABS_STANDALONE : TABS_REGIE;
  const cfg = alles.regie;
  const status = st.regie;
  const mutate = useCallback((fn) => mutateAlles((d) => fn(d.regie)), [mutateAlles]);
  const [log, setLog] = useState([]);
  const [tab, setTab] = useState(() => { try { const t = localStorage.getItem("advancedlan_regie_tab"); return TABS.some(([k]) => k === t) ? t : standalone ? "spiele" : "control"; } catch { return standalone ? "spiele" : "control"; } });
  useEffect(() => { try { localStorage.setItem("advancedlan_regie_tab", tab); } catch {} }, [tab]);
  useEffect(() => {
    api.regieLog().then(setLog);
    return api.onRegieEvent((e) => setLog((l) => logEinfuegen(l, e)));
  }, []);
  // Ohne offene Session zuerst dorthin (Standalone braucht keine Session: zuerst die Spiele)
  useEffect(() => { if (!standalone && !status.session.offen && !cfg.session.passwort) setTab("session"); }, []);

  const verbunden = status.pcs.filter((p) => p.verbunden);
  const aktiv = SPIEL_BY_ID[cfg.aktivesSpiel];
  const an = !!cfg.armed;
  const ses = status.session;
  const zuruecksetzen = async () => { await api.zaehlerZuruecksetzen(); setLog([]); };
  const shared = { cfg, mutate, status, log, jetzt, notify, version, goTab: setTab, zuruecksetzen, standalone };
  const statsAn = !!cfg.stats?.an, statsOffen = !!status.stats?.fenster;

  return (
    <div style={S.app}>
      <Kopf modus={standalone ? "STANDALONE" : "REGIE"} version={version} modusWechseln={modusWechseln} meta={<>
        {standalone && <span><b style={{ color: "#fff" }}>{status.lokal || "Dieser PC"}</b> spielt hier{ses.offen ? " · " : ""}</span>}
        {(!standalone || ses.offen) && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: ses.fehler ? ERR : ses.offen ? SUB : WARN }}>
          <Radio size={12} /> {ses.fehler || (ses.offen ? `Session „${cfg.session.name}“ offen${st.vorschau ? " (Vorschau)" : ""}` : "Session geschlossen")}
        </span>}
        {(!standalone || ses.offen) && <span> · <b style={{ color: verbunden.length ? OK : MUTED }}>{verbunden.length}</b> PCs</span>}
        {status.spielAufRegie && <span style={{ color: ERR }}> · <TriangleAlert size={12} /> Auf diesem PC läuft {status.spielAufRegie}</span>}
      </>}>
        {statsAn && <button onClick={() => api.statsFenster(!statsOffen)} title={statsOffen ? "Stats-Fenster schließen" : "Game-Stats-Screen als eigenes Fenster öffnen"}
          style={{ ...S.ghostBtn, ...(statsOffen ? { borderColor: ACCENT, color: "#fff", boxShadow: GLOW_STARK } : {}) }}><MonitorPlay size={14} /> Stats{status.stats?.ndi?.laeuft ? " · NDI" : ""}</button>}
        {aktiv && <span title="Aktives Spiel (Tab „Control“)" style={{ borderRadius: 6, padding: "6px 12px", fontWeight: 800, fontSize: 12, letterSpacing: 0.5, background: aktiv.farbe, color: "#14121a", boxShadow: `0 0 12px ${aktiv.farbe}88` }}>{aktiv.kurz}</span>}
        <button onClick={() => mutate((d) => { d.armed = !d.armed; })}
          title={an ? "Ausgabe ausschalten" : "Ausgabe einschalten"}
          style={{ ...S.primaryBtn, padding: "9px 16px", letterSpacing: 0.5, background: an ? OK : ERR, border: `1px solid ${an ? OK : ERR}`, color: an ? "#0d1f14" : "#fff", boxShadow: an ? undefined : "0 0 10px rgba(255,93,93,.35)", animation: an ? "pulsGruen 1.6s ease-in-out infinite" : "none" }}>
          <Power size={15} /> {an ? "AUSGABE AN" : "AUSGABE AUS"}
        </button>
      </Kopf>
      <nav style={S.nav}>
        {TABS.map(([k, label, Ic]) => (
          <button key={k} style={{ ...S.navBtn, ...(tab === k ? S.navBtnActive : {}) }} onClick={() => setTab(k)}>
            <Ic size={14} />{label}
            {k === "control" && <span style={{ ...S.badge, background: verbunden.length ? OK + "33" : "#2f2c3a", color: verbunden.length ? OK : MUTED }}>{verbunden.length}</span>}
            {k === "session" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: ses.offen ? OK : WARN, boxShadow: ses.offen ? `0 0 6px ${OK}` : "none" }} />}
          </button>
        ))}
      </nav>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }} key={tab}>
        <main style={S.main}>
          <div style={{ animation: "npFade .18s ease" }}>
            {tab === "control" && <ControlTab {...shared} />}
            {tab === "setup" && <SetupTab {...shared} />}
            {tab === "spiele" && standalone && <GpSetupTab cfg={alles.gamepc} mutate={(fn) => mutateAlles((d) => fn(d.gamepc))} g={st.gamepc} jetzt={jetzt} notify={notify} standalone />}
            {tab === "signale" && <SignaleTab {...shared} />}
            {tab === "ziele" && <ZieleTab {...shared} />}
            {tab === "sim" && <SimTab {...shared} />}
            {tab === "session" && <SessionTab {...shared} />}
            {tab === "hilfe" && <AnleitungTab modus={standalone ? "standalone" : "regie"} goTab={setTab} />}
          </div>
        </main>
      </div>
    </div>
  );
}
