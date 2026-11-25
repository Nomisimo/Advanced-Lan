import React, { useState } from "react";
import { S, SUB } from "../theme.js";
import { Section, SimKnoepfe, TeamWahl, EventKnoepfe, SIM_KILLS } from "../ui.jsx";
import { api } from "../api.js";
import { SPIEL_BY_ID } from "../../core/spiele.js";

// Über die Session verbundene Game-PCs (nicht simuliert, nicht der PC der Regie selbst)
const sessionPcs = (status) => (status.pcs || []).filter((p) => p.verbunden && !p.sim && p.remote !== "dieser PC")
  .sort((a, b) => a.pcId.localeCompare(b.pcId, undefined, { numeric: true }));

export default function SimTab({ status, cfg, goTab }) {
  const spiel = SPIEL_BY_ID[cfg.aktivesSpiel];
  const TEAMS = spiel?.teams || [];
  const [teamWahl, setTeam] = useState(0);
  const [alsPc, setAlsPc] = useState("");
  const team = TEAMS[teamWahl] || TEAMS[0] || "";
  const sim = status.sim?.spiel === cfg.aktivesSpiel ? status.sim : { ...status.sim, anzeige: null, runde: 0 };
  const pcs = sessionPcs(status);
  const pc = pcs.find((p) => p.pcId === alsPc);
  const teamFuer = (e) => e.fest || (e.team ? team : "");
  const testName = (e) => (e.spieler || (cfg.aktivesSpiel === "rl" && e.team && !e.id.startsWith("match")) ? "Testspieler" : "");
  const ausloesen = (e) => api.eventAusloesen({ type: e.id, team: teamFuer(e), player: pc && testName(e) ? pc.spieler || pc.pcId : testName(e), kills: SIM_KILLS[e.id] || 1, ...(pc ? { pcId: pc.pcId } : {}) });
  // Läuft schon ein Match mit genau diesen PCs, zeigt die Zeile dessen Teams
  const imMatch = sim.echt && sim.spiel === cfg.aktivesSpiel ? sim.pcs : null;

  return (
    <>
      <Section title={`${spiel?.name || ""}-Match simulieren`}>
        {!spiel?.sim ? <div style={S.empty}>Für dieses Spiel gibt es keinen Simulator.</div>
          : <>
            <SimKnoepfe spiel={spiel} sim={sim} start={(m) => { api.simStart(m); goTab("control"); }} stop={() => api.simStop()} neu={() => api.simNeu()} />
            <div style={{ ...S.hint, marginBottom: 0 }} data-testid="sim-pcs">
              {pcs.length
                ? <>Simuliert mit den {pcs.length} verbundenen Session-PCs: {(imMatch || pcs.map((p) => ({ pcId: p.pcId, name: p.spieler || p.pcId, team: "" }))).map((p) => `${p.pcId}${p.name !== p.pcId ? ` (${p.name})` : ""}${p.team ? ` · ${p.team}` : ""}`).join(", ")}. Fehlende Spieler bis zur Matchgröße sind Bots ohne PC.</>
                : <>Keine Game-PCs in der Session: Der Simulator nutzt virtuelle PCs (SIM 01 …).</>}
            </div>
          </>}
      </Section>
      <Section title={`Event auslösen · ${spiel?.name}`} right={<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {pcs.length > 0 && <label style={{ fontSize: 13, color: SUB, display: "flex", gap: 6, alignItems: "center" }}>als
          <select style={{ ...S.selectSm, width: 170 }} value={pc ? pc.pcId : ""} onChange={(e) => setAlsPc(e.target.value)} data-testid="sim-als-pc">
            <option value="">Regie</option>
            {pcs.map((p) => <option key={p.pcId} value={p.pcId}>{p.pcId}{p.spieler ? ` (${p.spieler})` : ""}</option>)}
          </select></label>}
        <TeamWahl teams={TEAMS} team={team} setTeam={setTeam} />
      </div>}>
        <EventKnoepfe spiel={spiel} team={team} ausloesen={ausloesen} teamZeigen />
      </Section>
    </>
  );
}
