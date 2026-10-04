import React, { useState } from "react";
import { S, ACCENT, ACCENT_HI, SUB, teamFarbe } from "../theme.js";
import { Section, EventIcon, SimStand } from "../ui.jsx";
import { api } from "../api.js";
import { SPIEL_BY_ID } from "../../core/spiele.js";
import { Play, Square, RotateCcw, FastForward } from "lucide-react";

const KILLS = { multikill_3: 3, multikill_4: 4, ace: 5 };

export default function SimTab({ status, cfg, goTab }) {
  const spiel = SPIEL_BY_ID[cfg.aktivesSpiel];
  const EVENT_TYPES = spiel?.events || [];
  const GRUPPEN = [...new Set(EVENT_TYPES.map((e) => e.gruppe))];
  const TEAMS = spiel?.teams || [];
  const [teamWahl, setTeam] = useState(0);
  const team = TEAMS[teamWahl] || TEAMS[0] || "";
  const kannSim = !!spiel?.sim;
  const sim = status.sim?.spiel === cfg.aktivesSpiel ? status.sim : { ...status.sim, anzeige: null, runde: 0 };
  const teamFuer = (e) => e.fest || (e.team ? team : "");
  const ausloesen = (e) => api.eventAusloesen({ type: e.id, team: teamFuer(e), player: e.spieler || (cfg.aktivesSpiel === "rl" && e.team && !e.id.startsWith("match")) ? "Testspieler" : "", kills: KILLS[e.id] || 1 });

  return (
    <>
      <Section title={`${spiel?.name || ""}-Match simulieren`}>
        {!kannSim ? <div style={S.empty}>Für dieses Spiel gibt es keinen Simulator.</div> : (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={S.primaryBtn} disabled={sim.laeuft} onClick={() => { api.simStart("runde"); goTab("control"); }}><Play size={15} /> {spiel.sim}</button>
          <button style={S.secondaryBtn} disabled={sim.laeuft} onClick={() => { api.simStart("match"); goTab("control"); }}><FastForward size={15} /> Ganzes Match</button>
          <button style={S.secondaryBtn} disabled={!sim.laeuft} onClick={() => api.simStop()}><Square size={14} /> Stopp</button>
          <button style={{ ...S.ghostBtn }} onClick={() => api.simNeu()}><RotateCcw size={14} /> Zurücksetzen</button>
          <span style={{ fontSize: 13, color: SUB, marginLeft: 8 }}>
            {sim.laeuft ? <b style={{ color: ACCENT_HI }}>läuft ({sim.modus === "match" ? "Match" : spiel.sim}) · </b> : null}
            <SimStand sim={sim} />
          </span>
        </div>)}
      </Section>
      <Section title={`Event auslösen · ${spiel?.name}`}
        right={TEAMS.length > 0 && <div style={{ display: "flex", gap: 4 }}>{TEAMS.map((t, i) => (
          <button key={t} onClick={() => setTeam(i)} style={{ ...S.smallBtn, padding: "5px 12px", background: team === t ? teamFarbe(t) : "transparent", color: team === t ? "#111" : SUB, fontWeight: 700 }}>{t}</button>
        ))}</div>}>
        {!EVENT_TYPES.length && <div style={S.empty}>Keine Events.</div>}
        {GRUPPEN.map((g) => (
          <div key={g} style={{ marginBottom: 14 }}>
            <div className="sp-section-label">{g}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {EVENT_TYPES.filter((e) => e.gruppe === g).map((e) => (
                <button key={e.id} className="glow-hover" onClick={() => ausloesen(e)}
                  style={{ ...S.secondaryBtn, background: "#1e1c26", padding: "10px 14px", fontSize: 13 }}>
                  <span style={{ color: ACCENT, display: "inline-flex" }}><EventIcon type={e.id} spiel={cfg.aktivesSpiel} /></span>{e.label}
                  {e.team && !e.fest && <span style={{ fontSize: 10, color: teamFarbe(team), fontWeight: 700 }}>{team}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Section>
    </>
  );
}
