import React from "react";
import { S, ACCENT, ACCENT_HI, LINE, SUB, MUTED, ERR, OK, WARN, CT, TT, GLOW, teamFarbe } from "../theme.js";
import { Section, TeamChip, Dot, EventIcon, eventLabel, zeit, Leer, SpielChip, th, td } from "../ui.jsx";
import { api } from "../api.js";
import { SPIELE } from "../../core/spiele.js";
import { Bomb, CircleCheck, CircleX, CircleMinus, Unplug, Crown } from "lucide-react";

const PHASEN = { warmup: "Aufwärmen", live: "Live", intermission: "Halbzeit", gameover: "Match vorbei" };
const RUNDEN = { freezetime: "Freezetime", live: "Runde läuft", over: "Runde vorbei" };
const BOMBE = { planted: ["gelegt", ERR], defused: ["entschärft", CT], exploded: ["explodiert", TT] };
const FRISCH = 15000; // ms: so lange gelten Daten eines PCs als aktuell

/* ── Aktives Spiel: nur hier wird es gewählt ─────────────────────────── */
function SpielWahl({ cfg, mutate }) {
  const genutzt = SPIELE.filter((s) => cfg.spiele?.[s.id]);
  return (
    <Section title="Aktives Spiel">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {genutzt.map((s) => {
          const an = s.id === cfg.aktivesSpiel;
          return (
            <button key={s.id} onClick={() => !an && mutate((d) => { d.aktivesSpiel = s.id; })}
              style={{ flex: 1, minWidth: 140, padding: "14px 16px", borderRadius: 10, cursor: "pointer", textAlign: "left", border: `1px solid ${an ? s.farbe : LINE}`,
                background: an ? s.farbe + "22" : "#1e1c26", color: "#ece9f2", boxShadow: an ? `0 0 16px ${s.farbe}66` : "none" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: an ? s.farbe : SUB, letterSpacing: 1 }}>{s.kurz}</div>
              <div style={{ fontSize: 12, color: an ? "#fff" : MUTED }}>{s.name}</div>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

const Kennzahl = ({ label, wert, farbe }) => (
  <div style={{ flex: 1, minWidth: 80 }}>
    <div style={{ fontSize: 22, fontWeight: 800, color: farbe || "#fff", fontVariantNumeric: "tabular-nums" }}>{wert}</div>
    <div style={{ fontSize: 11, color: SUB }}>{label}</div>
  </div>
);

function Ausgabe({ cfg, status }) {
  const z = status.zaehler || {};
  return (
    <Section title={cfg.armed ? "Ausgabe scharf" : "Ausgabe aus"} style={{ borderColor: cfg.armed ? ERR : LINE, boxShadow: cfg.armed ? "0 0 16px rgba(255,93,93,.25)" : GLOW }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Kennzahl label="Ereignisse" wert={z.ereignisse || 0} farbe={ACCENT_HI} />
        <Kennzahl label="Verworfen" wert={z.verworfen || 0} farbe={z.verworfen ? WARN : MUTED} />
        <Kennzahl label="OSC gesendet" wert={z.gesendet || 0} farbe={OK} />
        <Kennzahl label="Fehler" wert={z.fehler || 0} farbe={z.fehler ? ERR : MUTED} />
      </div>
    </Section>
  );
}

/* ── Statistik: aktuelle Runde und Match ──────────────────────────────── */
const Zahl = ({ label, wert, farbe }) => (
  <div style={{ background: "#1a1820", border: `1px solid ${LINE}`, borderRadius: 8, padding: "8px 10px", minWidth: 0 }}>
    <div style={{ fontSize: 18, fontWeight: 800, color: farbe || "#fff", fontVariantNumeric: "tabular-nums" }}>{wert}</div>
    <div style={{ fontSize: 10, color: SUB, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
  </div>
);

function Statistik({ cfg, status }) {
  const st = status.statistik;
  const stand = status.stand;
  const daten = st && st.spiel === cfg.aktivesSpiel && (st.match.runden || st.runde.nr != null || st.runde.kills);
  if (cfg.aktivesSpiel !== "cs2") return <Section title="Statistik"><Leer>Keine Daten.</Leer></Section>;
  if (!daten && !stand) return <Section title="Statistik"><Leer>Noch keine Daten.</Leer></Section>;
  const r = st?.runde || {}, m = st?.match || { siege: {} };
  const bombe = BOMBE[stand?.bombe || r.bombe];
  const hs = m.kills ? Math.round((m.headshots / m.kills) * 100) : 0;
  return (
    <Section title="Statistik" right={<span style={{ display: "flex", gap: 6 }}>
      {stand?.map && <span style={S.chip}>{stand.map}</span>}
      {stand?.phase && <span style={S.chip}>{PHASEN[stand.phase] || stand.phase}</span>}
    </span>}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, marginBottom: 14 }}>
        <Team name="CT" score={stand?.ct ?? m.siege.CT} farbe={CT} sieger={stand?.rundenPhase === "over" && stand?.sieger === "CT"} />
        <div style={{ fontSize: 24, color: MUTED }}>:</div>
        <Team name="T" score={stand?.tt ?? m.siege.T} farbe={TT} sieger={stand?.rundenPhase === "over" && stand?.sieger === "T"} />
      </div>
      <div className="sp-section-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        Runde {r.nr ?? stand?.runde ?? "–"}
        {(stand?.rundenPhase || r.phase) && <span style={{ ...S.chip, borderColor: ACCENT + "88", color: ACCENT_HI, textTransform: "none" }}>{RUNDEN[stand?.rundenPhase || r.phase]}</span>}
        {bombe && <span style={{ ...S.chip, borderColor: bombe[1], color: bombe[1], textTransform: "none" }}><Bomb size={11} /> {bombe[0]}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
        <Zahl label="Kills" wert={r.kills || 0} />
        <Zahl label="Headshots" wert={r.headshots || 0} />
        <Zahl label="Sieger" wert={r.sieger || "–"} farbe={r.sieger ? teamFarbe(r.sieger) : MUTED} />
        <Zahl label="MVP" wert={r.mvp || st?.letzteRunde?.mvp || "–"} farbe={r.mvp ? ACCENT_HI : MUTED} />
      </div>
      <div className="sp-section-label">Match</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 14 }}>
        <Zahl label="Runden" wert={m.runden || 0} />
        <Zahl label="Kills" wert={m.kills || 0} />
        <Zahl label="HS-Quote" wert={`${hs}%`} />
        <Zahl label="Multikills" wert={m.multikills || 0} />
        <Zahl label="Aces" wert={m.aces || 0} farbe={m.aces ? ACCENT_HI : undefined} />
      </div>
      {st?.top?.length > 0 && (
        <table style={{ ...S.table, marginTop: 0 }}>
          <thead><tr><th style={th()}>Spieler</th><th style={th()}>Team</th><th style={th({ textAlign: "right" })}>K</th><th style={th({ textAlign: "right" })}>D</th><th style={th({ textAlign: "right" })}>HS</th><th style={th({ textAlign: "right" })}>MVP</th></tr></thead>
          <tbody>{st.top.map((p, i) => (
            <tr key={p.name}>
              <td style={td({ fontWeight: i === 0 ? 700 : 400 })}>{i === 0 && <Crown size={12} color={ACCENT_HI} style={{ marginRight: 5, verticalAlign: -1 }} />}{p.name}</td>
              <td style={td()}><TeamChip team={p.team} /></td>
              <td style={td({ textAlign: "right", fontWeight: 700 })}>{p.kills}</td>
              <td style={td({ textAlign: "right", color: SUB })}>{p.tode}</td>
              <td style={td({ textAlign: "right", color: SUB })}>{p.headshots}</td>
              <td style={td({ textAlign: "right", color: SUB })}>{p.mvps}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </Section>
  );
}

const Team = ({ name, score, farbe, sieger }) => (
  <div style={{ textAlign: "center", minWidth: 80 }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: farbe, letterSpacing: 1 }}>{name}</div>
    <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.05, color: "#fff", textShadow: sieger ? `0 0 18px ${farbe}` : "none" }}>{score ?? 0}</div>
  </div>
);

/* ── Verbindungscheck ─────────────────────────────────────────────────── */
const Ampel = ({ ok, teil, title }) => (
  <span title={title} style={{ display: "inline-flex", color: ok ? OK : teil ? WARN : ERR }}>
    {ok ? <CircleCheck size={15} /> : teil ? <CircleMinus size={15} /> : <CircleX size={15} />}
  </span>
);

function Verbindungscheck({ cfg, status, jetzt }) {
  const pcs = [...status.pcs].sort((a, b) => Number(b.verbunden) - Number(a.verbunden) || a.pcId.localeCompare(b.pcId, "de", { numeric: true }));
  const pruefen = (p) => {
    const verbunden = !!p.verbunden;
    const daten = verbunden && p.t && jetzt - p.t < FRISCH;
    const spiel = !p.spiel || p.spiel === cfg.aktivesSpiel;
    return { verbunden, daten, spiel, ok: verbunden && daten && spiel };
  };
  const ok = pcs.filter((p) => pruefen(p).ok).length;
  return (
    <Section title="Verbindungscheck" right={pcs.length > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: ok === pcs.length ? OK : WARN }}>{ok} / {pcs.length} PCs ok</span>}>
      {pcs.length === 0 ? <Leer>Kein PC in der Session.</Leer> : (
        <table style={{ ...S.table, marginTop: 0 }}>
          <thead><tr>
            <th style={th()}>PC</th><th style={th({ textAlign: "center" })}>Verbindung</th><th style={th({ textAlign: "center" })}>Daten</th><th style={th({ textAlign: "center" })}>Spiel</th>
            <th style={th()}>Ping</th><th style={th()}>Spieler</th><th style={th()}>Erkennt</th><th style={th()}>Zuletzt</th><th style={th()}></th>
          </tr></thead>
          <tbody>
            {pcs.map((p) => {
              const c = pruefen(p), s = p.status || {};
              return (
                <tr key={p.pcId} style={{ opacity: p.verbunden ? 1 : 0.55 }}>
                  <td style={td({ fontWeight: 700, whiteSpace: "nowrap" })}><Dot color={c.ok ? OK : p.verbunden ? WARN : "#4d475c"} glow={c.ok} /> <span style={{ marginLeft: 4 }}>{p.pcId}</span>{p.sim && <span style={{ ...S.badge, marginLeft: 6, background: "#2f2c3a", color: SUB }}>SIM</span>}</td>
                  <td style={td({ textAlign: "center" })}><Ampel ok={c.verbunden} title={c.verbunden ? "verbunden" : "getrennt"} /></td>
                  <td style={td({ textAlign: "center" })}><Ampel ok={c.daten} teil={c.verbunden} title={c.daten ? "Daten kommen" : "keine aktuellen Daten"} /></td>
                  <td style={td({ textAlign: "center" })}>{p.spiel ? <SpielChip spiel={p.spiel} aktiv={c.spiel} /> : <span style={{ color: MUTED }}>–</span>}</td>
                  <td style={td({ color: p.ping == null ? MUTED : p.ping > 50 ? WARN : SUB, fontSize: 12, fontVariantNumeric: "tabular-nums" })}>{p.sim ? "–" : p.ping == null ? "–" : `${p.ping} ms`}</td>
                  <td style={td({ fontSize: 12 })}>{s.spieler ? <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>{s.spieler} <TeamChip team={s.team} /></span> : <span style={{ color: MUTED }}>–</span>}</td>
                  <td style={td()}><span style={{ display: "inline-flex", gap: 4 }}>{(p.spiele || []).map((x) => <SpielChip key={x} spiel={x} aktiv={x === cfg.aktivesSpiel} />)}</span></td>
                  <td style={td({ color: SUB, fontSize: 12, whiteSpace: "nowrap" })}>{p.t ? `${Math.max(0, Math.round((jetzt - p.t) / 1000))} s` : "–"}</td>
                  <td style={td({ textAlign: "right" })}>{p.verbunden && !p.sim && <button style={S.dangerBtn} title="Trennen" onClick={() => confirm(`${p.pcId} trennen?`) && api.pcTrennen(p.pcId)}><Unplug size={12} /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Section>
  );
}

/* ── Log ──────────────────────────────────────────────────────────────── */
export function EventZeile({ e, neu }) {
  const team = e.ev.team;
  return (
    <div className={neu ? "neu" : ""} style={{ padding: "7px 10px", borderBottom: `1px solid ${LINE}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{zeit(e.t)}</span>
        <span style={{ color: team ? teamFarbe(team) : ACCENT_HI, display: "inline-flex" }}><EventIcon type={e.ev.type} /></span>
        <b style={{ fontSize: 13 }}>{eventLabel(e.ev.type)}</b>
        <TeamChip team={team} />
        {e.ev.player && <span style={{ fontSize: 12, color: "#d4d0de" }}>{e.ev.player}{e.ev.kills > 1 && e.ev.type === "kill" ? ` (${e.ev.kills})` : ""}</span>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: MUTED }}>{e.quelle === "manuell" ? "manuell" : e.ev.pc}</span>
      </div>
      <div style={{ ...S.mono, fontSize: 11, marginTop: 2, paddingLeft: 66, color: e.fehler?.length ? ERR : e.gesperrt || !e.scharf ? MUTED : "#d9c6ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {e.address}
        <span style={{ marginLeft: 8, color: e.gesperrt ? MUTED : !e.scharf ? WARN : OK }}>{e.gesperrt ? "gesperrt" : !e.scharf ? "nicht gesendet" : `→ ${e.ziele}`}</span>
      </div>
    </div>
  );
}

function Log({ log }) {
  const neuesteId = log[0]?.id;
  return (
    <Section title="Events" right={log.length > 0 && <span style={{ fontSize: 11, color: MUTED }}>{log.length}</span>} style={{ position: "sticky", top: 0 }}>
      <div style={{ height: "calc(100vh - 400px)", minHeight: 300, overflowY: "auto", border: `1px solid ${LINE}`, borderRadius: 8, background: "#1a1820" }}>
        {log.length === 0 ? <div style={{ ...S.empty, padding: 14 }}>Noch keine Events.</div> : log.map((e) => <EventZeile key={e.id} e={e} neu={e.id === neuesteId} />)}
      </div>
    </Section>
  );
}

export default function ControlTab({ cfg, mutate, status, log, jetzt }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 20 }}>
        <SpielWahl cfg={cfg} mutate={mutate} />
        <Ausgabe cfg={cfg} status={status} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 20, alignItems: "start" }}>
        <div>
          <Verbindungscheck cfg={cfg} status={status} jetzt={jetzt} />
          <Statistik cfg={cfg} status={status} />
        </div>
        <Log log={log} />
      </div>
    </>
  );
}
