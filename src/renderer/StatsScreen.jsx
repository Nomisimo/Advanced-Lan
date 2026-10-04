import React, { useState, useEffect } from "react";
import { ACCENT, ACCENT_HI, LINE, SUB, MUTED, OK, WARN, BG, teamFarbe } from "./theme.js";
import { api } from "./api.js";
import { APP_ICON } from "./Kopf.jsx";
import { EventIcon, eventLabel, zeit } from "./ui.jsx";
import { SPIEL_BY_ID } from "../core/spiele.js";
import { statsDaten, statsEvents } from "../core/stats-screen.js";
import { Crown, Trophy } from "lucide-react";

// Game-Stats-Screen für Publikum und Stream: immer 1920×1080 gestaltet, auf die Fenstergröße skaliert.
// Läuft im Pop-out-Fenster und im unsichtbaren NDI-Fenster der Regie (index.html#stats).
const B = 1920, H = 1080;
const FRISCH = 15000;
const FONT = "'Segoe UI',system-ui,sans-serif";

function useSkalierung() {
  const mass = () => Math.min(window.innerWidth / B, window.innerHeight / H);
  const [s, setS] = useState(mass);
  useEffect(() => { const f = () => setS(mass()); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return s;
}

function logEinfuegen(l, e) {
  const neu = l.some((x) => x.id === e.id) ? l.map((x) => (x.id === e.id ? e : x)) : [e, ...l];
  return neu.slice(0, 200);
}

const Panel = ({ children, style }) => (
  <div style={{ background: "linear-gradient(180deg, rgba(35,33,44,.92), rgba(27,25,34,.92))", border: `1px solid ${LINE}`, borderRadius: 18, boxShadow: "0 0 30px rgba(157,92,255,.12), inset 0 1px 0 rgba(255,255,255,.04)", ...style }}>{children}</div>
);
const Titel = ({ children }) => <div style={{ fontSize: 22, fontWeight: 700, color: SUB, textTransform: "uppercase", letterSpacing: 2, marginBottom: 14 }}>{children}</div>;

function TeamBlock({ t, rechts }) {
  const f = teamFarbe(t.name);
  return (
    <Panel style={{ flex: 1, display: "flex", flexDirection: rechts ? "row-reverse" : "row", alignItems: "center", gap: 36, padding: "0 46px", borderColor: t.sieger ? f : LINE, boxShadow: t.sieger ? `0 0 40px ${f}66` : undefined, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", [rechts ? "right" : "left"]: 0, top: 0, bottom: 0, width: 10, background: f, boxShadow: `0 0 24px ${f}` }} />
      <div style={{ flex: 1, textAlign: rechts ? "right" : "left" }}>
        <div style={{ fontSize: 56, fontWeight: 800, color: f, letterSpacing: 3, textShadow: `0 0 18px ${f}88` }}>{t.name}</div>
        {t.sieger && <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", display: "inline-flex", alignItems: "center", gap: 10, marginTop: 6 }}><Trophy size={28} color={f} /> Sieger</div>}
      </div>
      <div style={{ fontSize: 190, fontWeight: 800, lineHeight: 1, color: "#fff", fontVariantNumeric: "tabular-nums", textShadow: `0 0 34px ${f}aa` }}>{t.score}</div>
    </Panel>
  );
}

function Mitte({ d }) {
  return (
    <div style={{ width: 380, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center" }}>
      {d.mitte && <div style={{ fontSize: d.mitte.gross.length > 6 ? 64 : 84, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{d.mitte.gross}</div>}
      {d.mitte?.klein && <div style={{ fontSize: 28, color: ACCENT_HI, fontWeight: 600, textShadow: "0 0 12px rgba(157,92,255,.7)" }}>{d.mitte.klein}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
        {d.vorbei && <Chip farbe={WARN}>Match vorbei</Chip>}
        {d.chips.map((c) => <Chip key={c}>{c}</Chip>)}
      </div>
    </div>
  );
}

const Chip = ({ children, farbe }) => (
  <span style={{ fontSize: 22, padding: "6px 16px", borderRadius: 30, border: `1px solid ${farbe || LINE}`, color: farbe || "#d4d0de", background: "rgba(26,24,32,.8)", whiteSpace: "nowrap" }}>{children}</span>
);

function BattleRoyale({ d, spiel }) {
  return (
    <Panel style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 120 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 200, fontWeight: 800, lineHeight: 1, color: "#fff", textShadow: `0 0 34px ${spiel.farbe}aa` }}>{d.br.uebrig ?? "–"}</div>
        <div style={{ fontSize: 32, color: SUB, marginTop: 10 }}>Spieler übrig</div>
      </div>
      {d.br.sieger && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 72, fontWeight: 800, color: spiel.farbe, textShadow: `0 0 26px ${spiel.farbe}`, display: "inline-flex", alignItems: "center", gap: 18 }}><Crown size={64} /> {d.br.sieger}</div>
          <div style={{ fontSize: 32, color: SUB, marginTop: 10 }}>Squad gewinnt</div>
        </div>
      )}
      {d.chips.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{d.vorbei && <Chip farbe={WARN}>Match vorbei</Chip>}{d.chips.map((c) => <Chip key={c}>{c}</Chip>)}</div>}
    </Panel>
  );
}

function Bestenliste({ d, mitTeam }) {
  const zelle = { padding: "8px 14px", fontSize: 28, borderBottom: `1px solid ${LINE}` };
  const kopf = { ...zelle, fontSize: 20, color: SUB, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", borderBottom: `2px solid ${LINE}` };
  return (
    <Panel style={{ flex: 1, padding: "26px 32px", minWidth: 0 }}>
      <Titel>Beste Spieler</Titel>
      {d.top.length === 0 ? <div style={{ fontSize: 26, color: MUTED, fontStyle: "italic" }}>Noch keine Spielerdaten.</div> : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
          <thead><tr>
            <th style={{ ...kopf, textAlign: "left", width: 50 }}>#</th>
            <th style={{ ...kopf, textAlign: "left" }}>Spieler</th>
            {d.spalten.map(([k, l]) => <th key={k} style={{ ...kopf, textAlign: "right" }}>{l}</th>)}
          </tr></thead>
          <tbody>{d.top.slice(0, 5).map((p, i) => {
            const f = mitTeam && p.team ? teamFarbe(p.team) : ACCENT;
            return (
              <tr key={p.name} style={{ background: i === 0 ? "rgba(157,92,255,.12)" : "transparent" }}>
                <td style={{ ...zelle, color: i === 0 ? ACCENT_HI : MUTED, fontWeight: 800 }}>{i === 0 ? <Crown size={28} style={{ verticalAlign: -4 }} /> : i + 1}</td>
                <td style={{ ...zelle, fontWeight: i === 0 ? 800 : 600, borderLeft: `5px solid ${f}`, maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</td>
                {d.spalten.map(([k], j) => <td key={k} style={{ ...zelle, textAlign: "right", fontWeight: j === 0 ? 800 : 400, color: j === 0 ? "#fff" : SUB }}>{p[k] ?? 0}</td>)}
              </tr>
            );
          })}</tbody>
        </table>
      )}
    </Panel>
  );
}

function LetzteEvents({ events }) {
  const neueste = events[0]?.id;
  return (
    <Panel style={{ width: 760, padding: "26px 32px", overflow: "hidden" }}>
      <Titel>Letzte Events</Titel>
      {events.length === 0 ? <div style={{ fontSize: 26, color: MUTED, fontStyle: "italic" }}>Noch keine Events.</div> : events.map((e) => {
        const f = e.ev.team ? teamFarbe(e.ev.team) : ACCENT_HI;
        return (
          <div key={e.id} className={e.id === neueste ? "neu" : ""} style={{ display: "flex", alignItems: "center", gap: 18, padding: "7px 12px", borderBottom: `1px solid ${LINE}`, borderRadius: 8 }}>
            <span style={{ color: f, display: "inline-flex", filter: `drop-shadow(0 0 6px ${f})` }}><EventIcon type={e.ev.type} spiel={e.ev.spiel} size={34} /></span>
            <span style={{ fontSize: 28, fontWeight: 700, whiteSpace: "nowrap" }}>{eventLabel(e.ev.type, e.ev.spiel)}</span>
            <span style={{ fontSize: 26, color: f, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.ev.player || e.ev.team || ""}</span>
            <span style={{ fontSize: 20, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{zeit(e.t)}</span>
          </div>
        );
      })}
    </Panel>
  );
}

export function StatsBuehne({ status, cfg, log, jetzt = Date.now() }) {
  const spiel = SPIEL_BY_ID[status?.aktivesSpiel || cfg?.regie?.aktivesSpiel];
  const d = statsDaten(spiel, status?.statistik, status?.stand);
  const live = status?.stand?.t && jetzt - status.stand.t < FRISCH;
  const events = statsEvents(log, spiel?.id, 6);
  return (
    <div style={{ width: B, height: H, position: "relative", overflow: "hidden", fontFamily: FONT, color: "#ece9f2", background: `radial-gradient(1200px 700px at 8% -10%, rgba(157,92,255,.28), transparent 60%), radial-gradient(1000px 600px at 105% 110%, ${spiel?.farbe || ACCENT}33, transparent 60%), ${BG}`, padding: "34px 44px", display: "flex", flexDirection: "column", gap: 26 }}>
      {/* Kopf */}
      <div style={{ display: "flex", alignItems: "center", gap: 22, height: 78 }}>
        <img src={APP_ICON} alt="" style={{ width: 70, height: 70, filter: "drop-shadow(0 0 14px rgba(157,92,255,.85))" }} />
        <div style={{ fontWeight: 800, fontSize: 40, letterSpacing: 3, color: ACCENT_HI, textShadow: "0 0 16px rgba(157,92,255,.8)" }}>ADVANCED LAN</div>
        <div style={{ flex: 1 }} />
        {spiel && <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: 2, padding: "8px 22px", borderRadius: 10, background: spiel.farbe, color: "#14121a", boxShadow: `0 0 24px ${spiel.farbe}aa` }}>{spiel.kurz}</span>}
        {spiel && <span style={{ fontSize: 36, fontWeight: 700 }}>{spiel.name}</span>}
        <div style={{ flex: 1 }} />
        {cfg?.regie?.session?.name && <span style={{ fontSize: 26, color: SUB }}>{cfg.regie.session.name}</span>}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 24, fontWeight: 800, letterSpacing: 2, color: live ? OK : MUTED }}>
          <span style={{ width: 18, height: 18, borderRadius: "50%", background: live ? OK : MUTED, boxShadow: live ? `0 0 14px ${OK}` : "none", animation: live ? "pulsGruen 1.6s ease-in-out infinite" : "none" }} />{live ? "LIVE" : "WARTET"}
        </span>
      </div>

      {/* Spielstand */}
      <div style={{ display: "flex", gap: 26, height: 330 }}>
        {d.leer ? (
          <Panel style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <div style={{ fontSize: 64, fontWeight: 800, color: "#fff" }}>Warten auf Spieldaten …</div>
            <div style={{ fontSize: 28, color: SUB }}>{spiel ? `${spiel.name}: der Screen füllt sich, sobald das Match läuft` : "Kein aktives Spiel"}</div>
          </Panel>
        ) : d.br ? <BattleRoyale d={d} spiel={spiel} /> : d.teams ? (
          <><TeamBlock t={d.teams[0]} /><Mitte d={d} /><TeamBlock t={d.teams[1]} rechts /></>
        ) : <Panel style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><Mitte d={d} /></Panel>}
      </div>

      {/* Zahlen des Matches */}
      {d.zahlen.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${d.zahlen.length}, 1fr)`, gap: 18, height: 116 }}>
          {d.zahlen.map(([label, w]) => (
            <Panel key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{w}</div>
              <div style={{ fontSize: 20, color: SUB, textTransform: "uppercase", letterSpacing: 1.5, marginTop: 8 }}>{label}</div>
            </Panel>
          ))}
        </div>
      )}

      {/* Beste Spieler und letzte Events */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 26 }}>
        <Bestenliste d={d} mitTeam={!!d.teams} />
        <LetzteEvents events={events} />
      </div>
    </div>
  );
}

export default function StatsScreen() {
  const [status, setStatus] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [log, setLog] = useState([]);
  const [jetzt, setJetzt] = useState(Date.now());
  const s = useSkalierung();
  useEffect(() => {
    document.title = "Advanced LAN · Game Stats";
    const laden = () => api.getConfig().then(setCfg);
    laden();
    api.status().then((st) => setStatus(st?.regie || null));
    api.regieLog().then((l) => setLog(l || []));
    const ab = [api.onStatus((st) => setStatus(st?.regie || null)), api.onRegieEvent((e) => setLog((l) => logEinfuegen(l, e)))];
    const t = setInterval(() => { setJetzt(Date.now()); laden(); }, 2000);
    return () => { ab.forEach((f) => f && f()); clearInterval(t); };
  }, []);
  return (
    <div onDoubleClick={() => api.statsVollbild?.()} title="Doppelklick: Vollbild" style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: B, height: H, transform: `translate(-50%, -50%) scale(${s})`, transformOrigin: "center" }}>
        <StatsBuehne status={status} cfg={cfg} log={log} jetzt={jetzt} />
      </div>
    </div>
  );
}
