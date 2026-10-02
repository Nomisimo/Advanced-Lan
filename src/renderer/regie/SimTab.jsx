import React, { useState } from "react";
import { S, ACCENT, ACCENT_HI, LINE, SUB, MUTED, CT, TT } from "../theme.js";
import { Section, EventIcon } from "../ui.jsx";
import { api } from "../api.js";
import { SPIEL_BY_ID } from "../../core/spiele.js";
import { Play, Square, RotateCcw, FastForward } from "lucide-react";

const BOMBEN_TEAM = { bomb_planted: "T", bomb_exploded: "T", bomb_defused: "CT" };
const KILLS = { multikill_3: 3, multikill_4: 4, ace: 5 };

export default function SimTab({ status, cfg, goTab }) {
  const spiel = SPIEL_BY_ID[cfg.aktivesSpiel];
  const EVENT_TYPES = spiel?.events || [];
  const GRUPPEN = [...new Set(EVENT_TYPES.map((e) => e.gruppe))];
  const [team, setTeam] = useState("CT");
  const sim = status.sim || {};
  const teamFuer = (e) => BOMBEN_TEAM[e.id] || (e.team ? team : "");
  const ausloesen = (e) => api.eventAusloesen({ type: e.id, team: teamFuer(e), player: e.spieler ? "Testspieler" : "", kills: KILLS[e.id] || 1 });

  return (
    <>
      <Section title="CS2-Match simulieren">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={S.primaryBtn} disabled={sim.laeuft} onClick={() => { api.simStart("runde"); goTab("control"); }}><Play size={15} /> Eine Runde</button>
          <button style={S.secondaryBtn} disabled={sim.laeuft} onClick={() => { api.simStart("match"); goTab("control"); }}><FastForward size={15} /> Ganzes Match</button>
          <button style={S.secondaryBtn} disabled={!sim.laeuft} onClick={() => api.simStop()}><Square size={14} /> Stopp</button>
          <button style={{ ...S.ghostBtn }} onClick={() => api.simNeu()}><RotateCcw size={14} /> Zurücksetzen</button>
          <span style={{ fontSize: 13, color: SUB, marginLeft: 8 }}>
            {sim.laeuft ? <b style={{ color: ACCENT_HI }}>läuft ({sim.modus === "match" ? "Match" : "Runde"}) · </b> : null}
            Simulation: <b style={{ color: CT }}>{sim.ct}</b> : <b style={{ color: TT }}>{sim.t}</b> nach {sim.runde} Runden
          </span>
        </div>
      </Section>
      <Section title={`Event auslösen · ${spiel?.name}`}
        right={<div style={{ display: "flex", gap: 4 }}>{["CT", "T"].map((t) => (
          <button key={t} onClick={() => setTeam(t)} style={{ ...S.smallBtn, padding: "5px 12px", background: team === t ? (t === "CT" ? CT : TT) : "transparent", color: team === t ? "#111" : SUB, fontWeight: 700 }}>{t}</button>
        ))}</div>}>
        {!EVENT_TYPES.length && <div style={S.empty}>Keine Events.</div>}
        {GRUPPEN.map((g) => (
          <div key={g} style={{ marginBottom: 14 }}>
            <div className="sp-section-label">{g}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {EVENT_TYPES.filter((e) => e.gruppe === g).map((e) => (
                <button key={e.id} className="glow-hover" onClick={() => ausloesen(e)}
                  style={{ ...S.secondaryBtn, background: "#1e1c26", padding: "10px 14px", fontSize: 13 }}>
                  <span style={{ color: ACCENT, display: "inline-flex" }}><EventIcon type={e.id} /></span>{e.label}
                  {e.team && !e.id.startsWith("bomb") && <span style={{ fontSize: 10, color: team === "CT" ? CT : TT, fontWeight: 700 }}>{team}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Section>
    </>
  );
}
