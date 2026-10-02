import React from "react";
import { S, ACCENT_HI, LINE, MUTED, OK, ERR, SUB, teamFarbe } from "../theme.js";
import { api } from "../api.js";
import { Section, TeamChip, EventIcon, eventLabel, zeit, SpielChip } from "../ui.jsx";
import { Send, CircleCheck, CircleX } from "lucide-react";

const TESTS = ["round_end", "bomb_planted", "kill"];

export default function EventsTab({ g, log }) {
  const c = g.client;
  return (
    <Section title="An die Regie geschickt"
      right={<div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: SUB, marginRight: 6 }}>{c.gesendet} gesendet{c.verworfen ? ` · ${c.verworfen} nicht genutzt` : ""}</span>
        {TESTS.map((t) => <button key={t} style={S.smallBtn} disabled={c.zustand !== "verbunden"} onClick={() => api.testEvent(t)} title="Test-Event"><Send size={11} /> {eventLabel(t)}</button>)}
      </div>}>
      <div style={{ height: "calc(100vh - 260px)", minHeight: 260, overflowY: "auto", border: `1px solid ${LINE}`, borderRadius: 8, background: "#1a1820" }}>
        {log.length === 0 ? <div style={{ ...S.empty, padding: 14 }}>Noch keine Events.</div> : log.map((e, i) => (
          <div key={e.id} className={i === 0 ? "neu" : ""} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: `1px solid ${LINE}`, fontSize: 13 }}>
            <span style={{ fontSize: 11, color: MUTED }}>{zeit(e.t)}</span>
            <SpielChip spiel={e.spiel || "cs2"} />
            <span style={{ color: e.ev.team ? teamFarbe(e.ev.team) : ACCENT_HI, display: "inline-flex" }}><EventIcon type={e.ev.type} /></span>
            <b>{eventLabel(e.ev.type)}</b>
            <TeamChip team={e.ev.team} />
            {e.ev.player && <span style={{ color: "#d4d0de" }}>{e.ev.player}</span>}
            {e.ev.test && <span style={{ ...S.badge, background: "#2f2c3a", color: SUB }}>Test</span>}
            <span style={{ flex: 1 }} />
            {e.gesendet ? <span title="gesendet" style={{ color: OK, display: "inline-flex" }}><CircleCheck size={14} /></span> : <span title="nicht verbunden" style={{ color: ERR, display: "inline-flex" }}><CircleX size={14} /></span>}
          </div>
        ))}
      </div>
    </Section>
  );
}
