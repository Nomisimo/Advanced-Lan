import React, { useState } from "react";
import { S } from "../theme.js";
import { Section, SimKnoepfe, TeamWahl, EventKnoepfe, SIM_KILLS } from "../ui.jsx";
import { api } from "../api.js";
import { SPIEL_BY_ID } from "../../core/spiele.js";

export default function SimTab({ status, cfg, goTab }) {
  const spiel = SPIEL_BY_ID[cfg.aktivesSpiel];
  const TEAMS = spiel?.teams || [];
  const [teamWahl, setTeam] = useState(0);
  const team = TEAMS[teamWahl] || TEAMS[0] || "";
  const sim = status.sim?.spiel === cfg.aktivesSpiel ? status.sim : { ...status.sim, anzeige: null, runde: 0 };
  const teamFuer = (e) => e.fest || (e.team ? team : "");
  const ausloesen = (e) => api.eventAusloesen({ type: e.id, team: teamFuer(e), player: e.spieler || (cfg.aktivesSpiel === "rl" && e.team && !e.id.startsWith("match")) ? "Testspieler" : "", kills: SIM_KILLS[e.id] || 1 });

  return (
    <>
      <Section title={`${spiel?.name || ""}-Match simulieren`}>
        {!spiel?.sim ? <div style={S.empty}>Für dieses Spiel gibt es keinen Simulator.</div>
          : <SimKnoepfe spiel={spiel} sim={sim} start={(m) => { api.simStart(m); goTab("control"); }} stop={() => api.simStop()} neu={() => api.simNeu()} />}
      </Section>
      <Section title={`Event auslösen · ${spiel?.name}`} right={<TeamWahl teams={TEAMS} team={team} setTeam={setTeam} />}>
        <EventKnoepfe spiel={spiel} team={team} ausloesen={ausloesen} teamZeigen />
      </Section>
    </>
  );
}
