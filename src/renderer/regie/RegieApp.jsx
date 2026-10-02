import React, { useState, useEffect, useCallback } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, OK, GLOW_STARK } from "../theme.js";
import { api } from "../api.js";
import Kopf from "../Kopf.jsx";
import { SPIELE, SPIEL_BY_ID } from "../../core/spiele.js";
import LiveTab from "./LiveTab.jsx";
import PcsTab from "./PcsTab.jsx";
import CuesTab from "./CuesTab.jsx";
import ZieleTab from "./ZieleTab.jsx";
import SimTab from "./SimTab.jsx";
import SessionTab from "./SessionTab.jsx";
import AnleitungTab from "./AnleitungTab.jsx";
import { Activity, Monitor, ListChecks, Send, FlaskConical, BookOpen, Power, Radio, KeyRound, TriangleAlert } from "lucide-react";

const TABS = [["live", "Live", Activity], ["pcs", "PCs", Monitor], ["cues", "Cues", ListChecks], ["ziele", "Ziele", Send], ["sim", "Simulator", FlaskConical], ["session", "Session", KeyRound], ["hilfe", "Anleitung", BookOpen]];
const LOG_MAX = 300;

export default function RegieApp({ cfg: alles, mutate: mutateAlles, status: st, jetzt, notify, version, modusWechseln }) {
  const cfg = alles.regie;
  const status = st.regie;
  const mutate = useCallback((fn) => mutateAlles((d) => fn(d.regie)), [mutateAlles]);
  const [log, setLog] = useState([]);
  const [tab, setTab] = useState(() => { try { return localStorage.getItem("lanregie_tab") || "live"; } catch { return "live"; } });
  useEffect(() => { try { localStorage.setItem("lanregie_tab", tab); } catch {} }, [tab]);
  useEffect(() => {
    api.regieLog().then(setLog);
    return api.onRegieEvent((e) => setLog((l) => [e, ...l].slice(0, LOG_MAX)));
  }, []);
  // Ohne offene Session zuerst dorthin
  useEffect(() => { if (!status.session.offen && !cfg.session.passwort) setTab("session"); }, []);

  const verbunden = status.pcs.filter((p) => p.verbunden);
  const imSpiel = verbunden.filter((p) => p.spiel === cfg.aktivesSpiel).length;
  const scharf = !!cfg.armed;
  const ses = status.session;
  const shared = { cfg, mutate, status, log, jetzt, notify, goTab: setTab };

  return (
    <div style={S.app}>
      <Kopf modus="REGIE" version={version} modusWechseln={modusWechseln} meta={<>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: ses.fehler ? ERR : ses.offen ? SUB : WARN }}>
          <Radio size={12} /> {ses.fehler || (ses.offen ? `Session „${cfg.session.name}“ offen${st.vorschau ? " (Vorschau)" : ""}` : "Session geschlossen")}
        </span>
        <span> · <b style={{ color: verbunden.length ? OK : MUTED }}>{verbunden.length}</b> PCs verbunden, {imSpiel} im aktiven Spiel</span>
        {status.spielAufRegie && <span style={{ color: ERR }}> · <TriangleAlert size={12} /> Auf diesem PC läuft {status.spielAufRegie}</span>}
      </>}>
        <div style={{ display: "flex", gap: 3, background: "#14121a", border: `1px solid ${LINE}`, borderRadius: 8, padding: 3 }} title="Aktives Spiel: nur dessen Ereignisse erzeugen OSC">
          {SPIELE.map((s) => {
            const an = s.id === cfg.aktivesSpiel;
            return (
              <button key={s.id} onClick={() => !an && mutate((d) => { d.aktivesSpiel = s.id; })}
                style={{ border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontWeight: 800, fontSize: 12, letterSpacing: 0.5,
                  background: an ? s.farbe : "transparent", color: an ? "#14121a" : SUB, boxShadow: an ? `0 0 12px ${s.farbe}88` : "none" }}>
                {s.kurz}
              </button>
            );
          })}
        </div>
        <button onClick={() => mutate((d) => { d.armed = !d.armed; })}
          title={scharf ? "Ausgabe stoppen: Ereignisse werden nur noch angezeigt" : "Ausgabe scharf schalten: Cues gehen per OSC an MA3 und Playout"}
          style={{ ...S.primaryBtn, padding: "9px 16px", letterSpacing: 0.5, background: scharf ? ERR : "transparent", border: `1px solid ${scharf ? ERR : ACCENT}`, color: scharf ? "#fff" : "#e6dbff", boxShadow: scharf ? undefined : GLOW_STARK, animation: scharf ? "puls 1.6s ease-in-out infinite" : "none" }}>
          <Power size={15} /> {scharf ? "AUSGABE SCHARF" : "AUSGABE AUS"}
        </button>
      </Kopf>
      <nav style={S.nav}>
        {TABS.map(([k, label, Ic]) => (
          <button key={k} style={{ ...S.navBtn, ...(tab === k ? S.navBtnActive : {}) }} onClick={() => setTab(k)}>
            <Ic size={14} />{label}
            {k === "pcs" && <span style={{ ...S.badge, background: verbunden.length ? OK + "33" : "#2f2c3a", color: verbunden.length ? OK : MUTED }}>{verbunden.length}</span>}
            {k === "session" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: ses.offen ? OK : WARN, boxShadow: ses.offen ? `0 0 6px ${OK}` : "none" }} />}
          </button>
        ))}
      </nav>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }} key={tab}>
        <main style={S.main}>
          <div style={{ animation: "npFade .18s ease" }}>
            {tab === "live" && <LiveTab {...shared} />}
            {tab === "pcs" && <PcsTab {...shared} />}
            {tab === "cues" && <CuesTab {...shared} />}
            {tab === "ziele" && <ZieleTab {...shared} />}
            {tab === "sim" && <SimTab {...shared} />}
            {tab === "session" && <SessionTab {...shared} />}
            {tab === "hilfe" && <AnleitungTab {...shared} />}
          </div>
        </main>
      </div>
    </div>
  );
}
