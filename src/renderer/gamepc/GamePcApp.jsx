import React, { useState, useEffect } from "react";
import { S, OK, WARN, ERR, MUTED, ACCENT } from "../theme.js";
import { api } from "../api.js";
import Kopf from "../Kopf.jsx";
import { Dot, TabLeiste, useTab } from "../ui.jsx";
import SessionTab from "./SessionTab.jsx";
import SetupTab from "./SetupTab.jsx";
import AppEinstellungen from "../AppEinstellungen.jsx";
import { ShowKnopf } from "../Shows.jsx";
import EventsTab from "./EventsTab.jsx";
import SimTab from "./SimTab.jsx";
import AnleitungTab from "../AnleitungTab.jsx";
import BildTab from "./BildTab.jsx";
import { Network, Settings, Activity, BookOpen, FlaskConical, ScanEye } from "lucide-react";

export const ZUSTAND = { verbunden: ["Verbunden", OK], verbinde: ["Verbinde …", WARN], getrennt: ["Nicht verbunden", MUTED], abgelehnt: ["Abgelehnt", ERR] };
const TABS = [["session", "Session", Network], ["setup", "Setup", Settings], ["bild", "Bilderkennung", ScanEye], ["events", "Events", Activity], ["sim", "Simulator", FlaskConical], ["hilfe", "Anleitung", BookOpen]];

export default function GamePcApp({ cfg: alles, mutate: mutateAlles, ersetzen, status: st, jetzt, notify, version, modusWechseln }) {
  const cfg = alles.gamepc;
  const g = st.gamepc;
  const mutate = (fn) => mutateAlles((d) => fn(d.gamepc));
  const [log, setLog] = useState([]);
  const [tab, setTab] = useTab("advancedlan_gamepc_tab", TABS, "session");
  useEffect(() => {
    api.gamePcLog().then(setLog);
    return api.onGamePcEvent((e) => setLog((l) => [e, ...l].slice(0, 200)));
  }, []);
  const c = g.client;
  const [zText, zFarbe] = ZUSTAND[c.zustand] || ZUSTAND.getrennt;
  const frisch = (t) => t && jetzt - t < 15000;
  const spielDaten = frisch(g.letzte) || frisch(g.rl?.letzte) || Object.values(g.daten || {}).some((d) => frisch(d.letzte)); // irgendein Spiel liefert Daten
  const shared = { cfg, mutate, g, log, jetzt, notify, goTab: setTab };

  return (
    <div style={S.app}>
      <Kopf modus="GAME-PC" version={version} modusWechseln={modusWechseln} meta={<>
        <b style={{ color: "#fff" }}>{cfg.pcId || "ohne PC-ID"}</b>
        <span style={{ color: zFarbe }}> · {zText}{c.zustand === "verbunden" && c.session ? ` mit „${c.session}“` : ""}</span>
      </>}>
        <ShowKnopf cfg={alles} ersetzen={ersetzen} notify={notify} />
      </Kopf>
      <TabLeiste tabs={TABS} tab={tab} setTab={setTab} marke={(k) => <>
        {k === "session" && <Dot size={7} color={zFarbe} glow={c.zustand === "verbunden"} />}
        {k === "setup" && <Dot size={7} color={spielDaten ? OK : WARN} glow={spielDaten} />}
        {k === "sim" && g.sim?.laeuft && <Dot size={7} color={ACCENT} glow />}
        {k === "events" && log.length > 0 && <span style={{ ...S.badge, background: "#2f2c3a", color: MUTED }}>{log.length}</span>}
      </>} />
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }} key={tab}>
        <main style={S.main}>
          <div style={{ animation: "npFade .18s ease" }}>
            {tab === "session" && <SessionTab {...shared} />}
            {tab === "setup" && <><SetupTab {...shared} /><AppEinstellungen cfg={alles} status={st} mutate={mutateAlles} notify={notify} /></>}
            {tab === "bild" && <BildTab {...shared} />}
            {tab === "events" && <EventsTab {...shared} />}
            {tab === "sim" && <SimTab {...shared} />}
            {tab === "hilfe" && <AnleitungTab modus="gamepc" goTab={setTab} />}
          </div>
        </main>
      </div>
    </div>
  );
}
