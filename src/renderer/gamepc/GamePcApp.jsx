import React, { useState, useEffect } from "react";
import { S, OK, WARN, ERR, MUTED, ACCENT } from "../theme.js";
import { api } from "../api.js";
import Kopf from "../Kopf.jsx";
import SessionTab from "./SessionTab.jsx";
import SetupTab from "./SetupTab.jsx";
import EventsTab from "./EventsTab.jsx";
import SimTab from "./SimTab.jsx";
import AnleitungTab from "../AnleitungTab.jsx";
import { Network, Settings, Activity, BookOpen, FlaskConical } from "lucide-react";

export const ZUSTAND = { verbunden: ["Verbunden", OK], verbinde: ["Verbinde …", WARN], getrennt: ["Nicht verbunden", MUTED], abgelehnt: ["Abgelehnt", ERR] };
const TABS = [["session", "Session", Network], ["setup", "Setup", Settings], ["events", "Events", Activity], ["sim", "Simulator", FlaskConical], ["hilfe", "Anleitung", BookOpen]];

export default function GamePcApp({ cfg: alles, mutate: mutateAlles, status: st, jetzt, notify, version, modusWechseln }) {
  const cfg = alles.gamepc;
  const g = st.gamepc;
  const mutate = (fn) => mutateAlles((d) => fn(d.gamepc));
  const [log, setLog] = useState([]);
  const [tab, setTab] = useState(() => { try { const t = localStorage.getItem("advancedlan_gamepc_tab"); return TABS.some(([k]) => k === t) ? t : "session"; } catch { return "session"; } });
  useEffect(() => { try { localStorage.setItem("advancedlan_gamepc_tab", tab); } catch {} }, [tab]);
  useEffect(() => {
    api.gamePcLog().then(setLog);
    return api.onGamePcEvent((e) => setLog((l) => [e, ...l].slice(0, 200)));
  }, []);
  const c = g.client;
  const [zText, zFarbe] = ZUSTAND[c.zustand] || ZUSTAND.getrennt;
  const frisch = (t) => t && jetzt - t < 15000;
  const cs2Aktiv = frisch(g.letzte) || frisch(g.rl?.letzte) || Object.values(g.daten || {}).some((d) => frisch(d.letzte)); // irgendein Spiel liefert Daten
  const shared = { cfg, mutate, g, log, jetzt, notify, goTab: setTab };

  return (
    <div style={S.app}>
      <Kopf modus="GAME-PC" version={version} modusWechseln={modusWechseln} meta={<>
        <b style={{ color: "#fff" }}>{cfg.pcId || "ohne PC-ID"}</b>
        <span style={{ color: zFarbe }}> · {zText}{c.zustand === "verbunden" && c.session ? ` mit „${c.session}“` : ""}</span>
      </>} />
      <nav style={S.nav}>
        {TABS.map(([k, label, Ic]) => (
          <button key={k} style={{ ...S.navBtn, ...(tab === k ? S.navBtnActive : {}) }} onClick={() => setTab(k)}>
            <Ic size={14} />{label}
            {k === "session" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: zFarbe, boxShadow: c.zustand === "verbunden" ? `0 0 6px ${OK}` : "none" }} />}
            {k === "setup" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: cs2Aktiv ? OK : WARN, boxShadow: cs2Aktiv ? `0 0 6px ${OK}` : "none" }} />}
            {k === "sim" && g.sim?.laeuft && <span style={{ width: 7, height: 7, borderRadius: "50%", background: ACCENT, boxShadow: `0 0 6px ${ACCENT}` }} />}
            {k === "events" && log.length > 0 && <span style={{ ...S.badge, background: "#2f2c3a", color: MUTED }}>{log.length}</span>}
          </button>
        ))}
      </nav>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }} key={tab}>
        <main style={S.main}>
          <div style={{ animation: "npFade .18s ease" }}>
            {tab === "session" && <SessionTab {...shared} />}
            {tab === "setup" && <SetupTab {...shared} />}
            {tab === "events" && <EventsTab {...shared} />}
            {tab === "sim" && <SimTab {...shared} />}
            {tab === "hilfe" && <AnleitungTab modus="gamepc" goTab={setTab} />}
          </div>
        </main>
      </div>
    </div>
  );
}
