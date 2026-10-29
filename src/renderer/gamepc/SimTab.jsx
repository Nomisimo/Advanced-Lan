import React, { useState } from "react";
import { S, ACCENT_HI, LINE, SUB, MUTED, OK, ERR, teamFarbe } from "../theme.js";
import { Section, EventIcon, SpielChip, SimKnoepfe, TeamWahl, EventKnoepfe, SIM_KILLS, eventLabel, zeit } from "../ui.jsx";
import { api } from "../api.js";
import { SPIEL_BY_ID } from "../../core/spiele.js";
import { Plug, CircleCheck, CircleX } from "lucide-react";

// Simulator des Game-PCs: spielt das aktive Spiel der Session, als liefe es auf diesem PC.
// So lässt sich vom Platz aus prüfen, ob Events bei der Regie ankommen und dort Befehle auslösen.
export default function SimTab({ cfg, g, log, goTab, notify }) {
  const c = g.client;
  const verbunden = c.zustand === "verbunden";
  const spielId = c.aktivesSpiel;
  const spiel = SPIEL_BY_ID[spielId];
  const TEAMS = spiel?.teams || [];
  const [teamWahl, setTeam] = useState(0);
  const team = TEAMS[teamWahl] || TEAMS[0] || "";
  const sim = g.sim?.spiel === spielId ? g.sim : { ...g.sim, anzeige: null, runde: 0 };
  const kannMatch = !!spiel?.sim;
  const ergebnis = (r) => r?.fehler && notify(r.fehler, "err");
  const ausloesen = (e) => api.testEvent(e.id, spielId, e.fest || (e.team ? team : ""), SIM_KILLS[e.id] || 1);
  // Wer dieser PC in der Simulation ist
  const rolle = spielId === "cs2" ? " (Spieler 1, CT)" : spielId === "dota2" ? " (Spieler 1, Radiant)" : spiel?.bild ? ` (${cfg.bild?.spiele?.[spielId]?.team || "TEAM A"})` : "";
  const simLog = log.filter((e) => e.sim).slice(0, 12);

  if (!verbunden) return (
    <Section title="Simulator">
      <div style={{ display: "flex", alignItems: "center", gap: 12, border: `1px dashed ${LINE}`, borderRadius: 8, padding: 16 }}>
        <span style={{ flex: 1, color: SUB }}>Der Simulator läuft nur mit verbundener Session: Er spielt das Spiel, das die Regie gerade nutzt, und schickt die Events wirklich an die Regie.</span>
        <button style={S.primaryBtn} onClick={() => goTab("session")}><Plug size={14} /> Zur Session</button>
      </div>
    </Section>
  );

  return (
    <>
      <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{spiel?.name || spielId}-Match simulieren <SpielChip spiel={spielId} aktiv /></span>}
        subtitle={`Spielt das aktive Spiel der Session „${c.session}“ als ${cfg.pcId || "dieser PC"}${rolle}. Die Daten laufen durch dieselbe Erkennung wie echte Spieldaten und gehen an die Regie. Ist dort die Ausgabe an, lösen sie echte Befehle aus.`}>
        {!kannMatch ? <div style={S.empty}>Für dieses Spiel gibt es keinen Simulator.</div>
          : <SimKnoepfe spiel={spiel} sim={sim} start={async (m) => ergebnis(await api.gamePcSimStart(m))} stop={() => api.gamePcSimStop()} neu={() => api.gamePcSimNeu()} />}
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 20, alignItems: "start" }}>
        <Section title="Event auslösen" right={<TeamWahl teams={TEAMS} team={team} setTeam={setTeam} />}>
          <EventKnoepfe spiel={spiel} team={team} ausloesen={ausloesen} />
        </Section>
        <Section title="Zuletzt simuliert" right={<button style={S.smallBtn} onClick={() => goTab("events")}>Alle Events</button>}>
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, background: "#1a1820", minHeight: 120 }}>
            {simLog.length === 0 ? <div style={{ ...S.empty, padding: 14 }}>Noch nichts simuliert.</div> : simLog.map((e, i) => (
              <div key={e.id} className={i === 0 ? "neu" : ""} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderBottom: `1px solid ${LINE}`, fontSize: 12 }}>
                <span style={{ color: MUTED, fontSize: 11 }}>{zeit(e.t)}</span>
                <span style={{ color: e.ev.team ? teamFarbe(e.ev.team) : ACCENT_HI, display: "inline-flex" }}><EventIcon type={e.ev.type} spiel={e.spiel} size={13} /></span>
                <b>{eventLabel(e.ev.type, e.spiel)}</b>
                {e.ev.player && <span style={{ color: SUB }}>{e.ev.player}</span>}
                <span style={{ flex: 1 }} />
                {e.gesendet ? <CircleCheck size={13} color={OK} /> : <CircleX size={13} color={ERR} />}
              </div>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}
