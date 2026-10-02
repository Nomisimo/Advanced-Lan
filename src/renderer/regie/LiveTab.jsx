import React from "react";
import { S, ACCENT, ACCENT_HI, LINE, SUB, MUTED, ERR, OK, WARN, CT, TT, PANEL, GLOW, teamFarbe } from "../theme.js";
import { Section, TeamChip, Dot, EventIcon, eventLabel, zeit, Leer } from "../ui.jsx";
import { SpielChip } from "./PcsTab.jsx";
import { SPIEL_BY_ID } from "../../core/spiele.js";
import { Bomb, Heart, Shield, Crosshair, Flame } from "lucide-react";

const PHASEN = { warmup: "Aufwärmen", live: "Live", intermission: "Halbzeit", gameover: "Match vorbei" };
const RUNDEN = { freezetime: "Freezetime", live: "Runde läuft", over: "Runde vorbei" };
const BOMBE = { planted: ["Bombe gelegt", ERR], defused: ["Bombe entschärft", CT], exploded: ["Bombe explodiert", TT] };

function Scoreboard({ spiel }) {
  if (!spiel) return <Leer>Noch keine Spieldaten. Sobald ein PC CS2 startet (oder der Simulator läuft), steht hier der Spielstand.</Leer>;
  const bombe = BOMBE[spiel.bombe];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22 }}>
        <Team name="CT" score={spiel.ct} farbe={CT} sieger={spiel.rundenPhase === "over" && spiel.sieger === "CT"} />
        <div style={{ fontSize: 26, color: MUTED, fontWeight: 300 }}>:</div>
        <Team name="T" score={spiel.tt} farbe={TT} sieger={spiel.rundenPhase === "over" && spiel.sieger === "T"} />
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <span style={S.chip}>{spiel.map || "–"}</span>
        <span style={S.chip}>{PHASEN[spiel.phase] || spiel.phase || "–"}</span>
        {spiel.rundenPhase && <span style={{ ...S.chip, borderColor: ACCENT + "88", color: ACCENT_HI }}>{RUNDEN[spiel.rundenPhase] || spiel.rundenPhase}</span>}
        {bombe && <span style={{ ...S.chip, borderColor: bombe[1], color: bombe[1] }}><Bomb size={12} /> {bombe[0]}</span>}
      </div>
    </div>
  );
}

const Team = ({ name, score, farbe, sieger }) => (
  <div style={{ textAlign: "center", minWidth: 90 }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: farbe, letterSpacing: 1 }}>{name === "CT" ? "COUNTER-TERRORISTS" : "TERRORISTS"}</div>
    <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.1, color: "#fff", textShadow: sieger ? `0 0 18px ${farbe}` : "none" }}>{score}</div>
  </div>
);

const Kennzahl = ({ label, wert, farbe }) => (
  <div style={{ flex: 1, minWidth: 90 }}>
    <div style={{ fontSize: 22, fontWeight: 800, color: farbe || "#fff" }}>{wert}</div>
    <div style={{ fontSize: 11, color: SUB }}>{label}</div>
  </div>
);

const Wert = ({ icon: Ic, title, farbe, children }) => (
  <span title={title} style={{ display: "inline-flex", alignItems: "center", gap: 3, color: farbe, fontWeight: farbe ? 700 : 400 }}><Ic size={11} />{children}</span>
);

function PcKarte({ p, aktivesSpiel }) {
  const c = p.status || {};
  const on = p.verbunden, imSpiel = p.spiel === aktivesSpiel;
  const tot = c.health === 0;
  const farbe = c.team ? teamFarbe(c.team) : LINE;
  return (
    <div className="glow-hover" style={{ background: "#1e1c26", border: `1px solid ${LINE}`, borderLeft: `3px solid ${on ? farbe : LINE}`, borderRadius: 8, padding: "10px 12px", opacity: on && imSpiel ? 1 : 0.55 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Dot color={on ? (imSpiel ? OK : ERR) : "#4d475c"} glow={on} title={on ? (imSpiel ? "verbunden" : "anderes Spiel, Ereignisse werden verworfen") : "getrennt"} />
        <b style={{ fontSize: 13 }}>{p.pcId}</b>
        <span style={{ flex: 1 }} />
        {!imSpiel && <SpielChip spiel={p.spiel} />}
        <TeamChip team={c.team} />
      </div>
      <div style={{ fontSize: 13, marginTop: 6, color: tot ? MUTED : "#fff", textDecoration: tot ? "line-through" : "none", minHeight: 18 }}>
        {c.spieler || (c.zuschauer ? <span style={{ color: SUB }}>schaut {c.zuschauer} zu</span> : <span style={{ color: MUTED }}>{on ? "wartet auf Spieldaten" : "getrennt"}</span>)}
      </div>
      {c.health != null && (
        <>
          <div style={{ height: 4, background: "#2f2c3a", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
            <div style={{ width: `${c.health}%`, height: "100%", background: c.health > 50 ? OK : c.health > 20 ? WARN : ERR, transition: "width .3s" }} />
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 11, color: SUB, marginTop: 6, whiteSpace: "nowrap" }}>
            <Wert icon={Heart} title="Leben">{c.health}</Wert>
            <Wert icon={Shield} title="Rüstung">{c.armor}</Wert>
            <Wert icon={Crosshair} title="Kills / Tode im Match">{c.kills}/{c.deaths}</Wert>
            {c.roundKills > 0 && <Wert icon={Flame} title="Kills in dieser Runde" farbe={ACCENT_HI}>{c.roundKills}</Wert>}
          </div>
        </>
      )}
    </div>
  );
}

export function EventZeile({ e, neu }) {
  const team = e.ev.team;
  return (
    <div className={neu ? "neu" : ""} style={{ padding: "8px 10px", borderBottom: `1px solid ${LINE}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{zeit(e.t)}</span>
        <span style={{ color: team ? teamFarbe(team) : ACCENT_HI, display: "inline-flex" }}><EventIcon type={e.ev.type} /></span>
        <b style={{ fontSize: 13 }}>{eventLabel(e.ev.type)}</b>
        <TeamChip team={team} />
        {e.ev.player && <span style={{ fontSize: 12, color: "#d4d0de" }}>{e.ev.player}{e.ev.kills > 1 && e.ev.type === "kill" ? ` (${e.ev.kills})` : ""}</span>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: MUTED }}>{e.quelle === "manuell" ? "manuell" : e.ev.pc}</span>
      </div>
      {e.sends.map((s, i) => (
        <div key={i} style={{ ...S.mono, fontSize: 11, marginTop: 3, paddingLeft: 66, color: s.fehler ? ERR : s.uebersprungen ? MUTED : e.scharf ? "#d9c6ff" : MUTED }}>
          {s.fehler ? `✕ ${s.fehler}` : s.uebersprungen ? `– ${s.uebersprungen}` : `→ ${s.ziel}  ${s.address}${s.args.length ? `  ${s.args.map((a) => JSON.stringify(a)).join(" ")}` : ""}`}
          {!e.scharf && !s.uebersprungen && !s.fehler && <span style={{ color: WARN, marginLeft: 8 }}>nicht gesendet (Ausgabe aus)</span>}
        </div>
      ))}
    </div>
  );
}

export default function LiveTab({ cfg, status, log, goTab }) {
  const z = status.zaehler || {};
  const neuesteId = log[0]?.id;
  const spiel = SPIEL_BY_ID[cfg.aktivesSpiel];
  const pcs = [...status.pcs].sort((a, b) => (a.status?.team || "~").localeCompare(b.status?.team || "~") || a.pcId.localeCompare(b.pcId, "de", { numeric: true }));
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        <Section title={`Spielstand · ${spiel?.name || cfg.aktivesSpiel}`} style={{ marginBottom: 20 }}>
          {cfg.aktivesSpiel === "cs2" ? <Scoreboard spiel={status.stand} />
            : <Leer>Für {spiel?.name} gibt es noch keine Datenquelle. Events dieses Spiels kommen erst, wenn die Game-PCs sie liefern.</Leer>}
        </Section>
        <Section title="Ausgabe" style={{ marginBottom: 20, borderColor: cfg.armed ? ERR : LINE, boxShadow: cfg.armed ? "0 0 16px rgba(255,93,93,.25)" : GLOW }}>
          <p style={S.subtitle}>{cfg.armed ? "Scharf: Cues gehen per OSC an die Ziele." : "Aus: Ereignisse werden erkannt und angezeigt, aber nicht gesendet. Zum Proben und Einrichten."}</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Kennzahl label="Ereignisse" wert={z.ereignisse || 0} farbe={ACCENT_HI} />
            <Kennzahl label="Verworfen (anderes Spiel)" wert={z.verworfen || 0} farbe={z.verworfen ? WARN : MUTED} />
            <Kennzahl label="OSC gesendet" wert={z.gesendet || 0} farbe={OK} />
            <Kennzahl label="Fehler" wert={z.fehler || 0} farbe={z.fehler ? ERR : MUTED} />
          </div>
        </Section>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
        <Section title="Game-PCs" subtitle="Rot = verbunden, aber mit einem anderen Spiel als dem aktiven.">
          {pcs.length === 0 ? <Leer>Noch kein PC verbunden. <a href="#" onClick={(e) => { e.preventDefault(); goTab(status.session.offen ? "sim" : "session"); }}>{status.session.offen ? "Zum Simulator" : "Session öffnen"}</a></Leer> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 10 }}>
              {pcs.map((p) => <PcKarte key={p.pcId} p={p} aktivesSpiel={cfg.aktivesSpiel} />)}
            </div>
          )}
        </Section>
        <Section title="Ereignisse" subtitle="Neueste oben. Darunter die OSC-Nachrichten, die der Cue ausgelöst hat."
          right={log.length > 0 && <span style={{ fontSize: 11, color: MUTED }}>{log.length}</span>}>
          <div style={{ maxHeight: "calc(100vh - 470px)", minHeight: 260, overflowY: "auto", border: `1px solid ${LINE}`, borderRadius: 8, background: "#1a1820" }}>
            {log.length === 0 ? <div style={{ ...S.empty, padding: 14 }}>Noch keine Ereignisse. Im Tab „Simulator“ lässt sich eine Runde abspielen.</div>
              : log.map((e) => <EventZeile key={e.id} e={e} neu={e.id === neuesteId} />)}
          </div>
        </Section>
      </div>
    </>
  );
}
