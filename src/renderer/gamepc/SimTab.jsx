import React, { useState } from "react";
import { S, ACCENT, ACCENT_HI, LINE, SUB, MUTED, OK, ERR, CT, TT, BLAU, ORANGE, teamFarbe } from "../theme.js";
import { Section, EventIcon, SpielChip, eventLabel, zeit } from "../ui.jsx";
import { api } from "../api.js";
import { SPIEL_BY_ID } from "../../core/spiele.js";
import { Play, Square, RotateCcw, FastForward, Plug, CircleCheck, CircleX } from "lucide-react";

const BOMBEN_TEAM = { bomb_planted: "T", bomb_exploded: "T", bomb_defused: "CT" };
const KILLS = { multikill_3: 3, multikill_4: 4, ace: 5 };

// Simulator des Game-PCs: spielt das aktive Spiel der Session, als liefe es auf diesem PC.
// So lässt sich vom Platz aus prüfen, ob Events bei der Regie ankommen und dort Befehle auslösen.
export default function SimTab({ cfg, g, log, goTab, notify }) {
  const c = g.client;
  const verbunden = c.zustand === "verbunden";
  const spielId = c.aktivesSpiel;
  const spiel = SPIEL_BY_ID[spielId];
  const rl = spielId === "rl";
  const TEAMS = rl ? [["BLUE", BLAU], ["ORANGE", ORANGE]] : [["CT", CT], ["T", TT]];
  const [teamWahl, setTeam] = useState(0);
  const team = TEAMS[teamWahl][0];
  const sim = g.sim || {};
  const kannMatch = spielId === "cs2" || rl;
  const ergebnis = (r) => r?.fehler && notify(r.fehler, "err");
  const ausloesen = (e) => api.testEvent(e.id, spielId, BOMBEN_TEAM[e.id] || (e.team ? team : ""), KILLS[e.id] || 1);
  const simLog = log.filter((e) => e.sim).slice(0, 12);

  if (!verbunden) return (
    <Section title="Simulator">
      <div style={{ display: "flex", alignItems: "center", gap: 12, border: `1px dashed ${LINE}`, borderRadius: 8, padding: 16 }}>
        <span style={{ flex: 1, color: SUB }}>Der Simulator läuft nur mit verbundener Session: Er spielt das Spiel, das die Regie gerade nutzt, und schickt die Events wirklich an die Regie.</span>
        <button style={S.primaryBtn} onClick={() => goTab("session")}><Plug size={14} /> Zur Session</button>
      </div>
    </Section>
  );

  const gruppen = [...new Set((spiel?.events || []).map((e) => e.gruppe))];
  return (
    <>
      <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{spiel?.name || spielId}-Match simulieren <SpielChip spiel={spielId} aktiv /></span>}
        subtitle={`Spielt das aktive Spiel der Session „${c.session}“ als ${cfg.pcId || "dieser PC"}${rl ? "" : " (Spieler 1, CT)"}. Die Daten laufen durch dieselbe Erkennung wie echte Spieldaten und gehen an die Regie. Ist dort die Ausgabe an, lösen sie echte Befehle aus.`}>
        {!kannMatch ? <div style={S.empty}>Für dieses Spiel gibt es keinen Simulator.</div> : (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button style={S.primaryBtn} disabled={sim.laeuft} onClick={async () => ergebnis(await api.gamePcSimStart("runde"))}><Play size={15} /> {rl ? "Bis zum nächsten Tor" : "Eine Runde"}</button>
            <button style={S.secondaryBtn} disabled={sim.laeuft} onClick={async () => ergebnis(await api.gamePcSimStart("match"))}><FastForward size={15} /> Ganzes Match</button>
            <button style={S.secondaryBtn} disabled={!sim.laeuft} onClick={() => api.gamePcSimStop()}><Square size={14} /> Stopp</button>
            <button style={S.ghostBtn} onClick={() => api.gamePcSimNeu()}><RotateCcw size={14} /> Zurücksetzen</button>
            <span style={{ fontSize: 13, color: SUB, marginLeft: 8 }}>
              {sim.laeuft ? <b style={{ color: ACCENT_HI }}>läuft ({sim.modus === "match" ? "Match" : rl ? "bis zum Tor" : "Runde"}) · </b> : null}
              {sim.spiel === "rl"
                ? <>Simulation: <b style={{ color: BLAU }}>{sim.blau || 0}</b> : <b style={{ color: ORANGE }}>{sim.orange || 0}</b> nach {sim.runde || 0} Anstößen</>
                : <>Simulation: <b style={{ color: CT }}>{sim.ct || 0}</b> : <b style={{ color: TT }}>{sim.t || 0}</b> nach {sim.runde || 0} Runden</>}
            </span>
          </div>
        )}
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 20, alignItems: "start" }}>
        <Section title="Event auslösen"
          right={<div style={{ display: "flex", gap: 4 }}>{TEAMS.map(([t, farbe], i) => (
            <button key={t} onClick={() => setTeam(i)} style={{ ...S.smallBtn, padding: "5px 12px", background: team === t ? farbe : "transparent", color: team === t ? "#111" : SUB, fontWeight: 700 }}>{t}</button>
          ))}</div>}>
          {gruppen.map((gr) => (
            <div key={gr} style={{ marginBottom: 14 }}>
              <div className="sp-section-label">{gr}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {spiel.events.filter((e) => e.gruppe === gr).map((e) => (
                  <button key={e.id} className="glow-hover" onClick={() => ausloesen(e)} style={{ ...S.secondaryBtn, background: "#1e1c26", padding: "9px 12px", fontSize: 13 }}>
                    <span style={{ color: ACCENT, display: "inline-flex" }}><EventIcon type={e.id} spiel={spielId} /></span>{e.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
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
