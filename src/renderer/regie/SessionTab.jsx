import React, { useState } from "react";
import { S, SUB, MUTED, OK, ERR, WARN } from "../theme.js";
import { Section, Field, Dot, th, td } from "../ui.jsx";
import { api } from "../api.js";
import { Lock, LockOpen, Eye, EyeOff, Unplug } from "lucide-react";

const PLATTFORM = { win32: "Windows", darwin: "macOS", linux: "Linux" };
const pingFarbe = (ms) => (ms == null ? MUTED : ms > 50 ? ERR : ms > 10 ? WARN : OK);

// Wer in der Session ist: echte Game-PCs (simulierte stehen im Tab „Control“)
function Uebersicht({ status, version }) {
  const pcs = status.pcs.filter((p) => !p.sim).sort((a, b) => (b.verbunden - a.verbunden) || a.pcId.localeCompare(b.pcId, "de", { numeric: true }));
  const andereVersion = (v) => v && version && v !== version;
  return (
    <Section title="Verbunden" right={<span style={{ fontSize: 12, color: SUB }}>{pcs.filter((p) => p.verbunden).length} von {pcs.length} PCs online</span>}>
      {!pcs.length ? <div style={S.empty}>Noch kein Game-PC beigetreten.</div> : (
        <table style={{ ...S.table, marginTop: 0 }}>
          <thead><tr>{["", "PC-ID", "Hostname", "IP", "MAC", "Ping", "App-Version", "Netzwerkkarte", ""].map((h, i) => <th key={i} style={th()}>{h}</th>)}</tr></thead>
          <tbody>{pcs.map((p) => {
            const g = p.geraet || {};
            return (
              <tr key={p.pcId} style={{ opacity: p.verbunden ? 1 : 0.5 }}>
                <td style={td({ width: 18 })}><Dot color={p.verbunden ? OK : MUTED} glow={p.verbunden} title={p.verbunden ? "verbunden" : "getrennt"} /></td>
                <td style={td({ fontWeight: 800 })}>{p.pcId}</td>
                <td style={td()}>{g.hostname || "–"}{g.plattform && <span style={{ color: MUTED, fontSize: 11 }}> · {PLATTFORM[g.plattform] || g.plattform}</span>}</td>
                <td style={td(S.mono)}>{p.remote || "–"}</td>
                <td style={td({ ...S.mono, color: SUB })}>{g.mac || "–"}</td>
                <td style={td({ color: p.verbunden ? pingFarbe(p.ping) : MUTED, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" })}>{p.verbunden && p.ping != null ? `${p.ping} ms` : "–"}</td>
                <td style={td({ ...S.mono, color: andereVersion(g.app) ? WARN : SUB })} title={andereVersion(g.app) ? `Regie hat ${version}` : undefined}>{g.app || "älter als beta.3"}</td>
                <td style={td({ fontSize: 12, color: SUB })}>{g.karte || "–"}</td>
                <td style={td({ textAlign: "right", width: 90 })}>{p.verbunden && <button style={S.smallBtn} onClick={() => api.pcTrennen(p.pcId)} title="Diesen PC aus der Session werfen"><Unplug size={12} /> Trennen</button>}</td>
              </tr>
            );
          })}</tbody>
        </table>
      )}
      <div style={S.hint}>Ping: Antwortzeit der Verbindung, alle 3 s gemessen. Grün bis 10 ms, orange bis 50 ms, darüber rot. Eine andere App-Version als die der Regie ist orange markiert.</div>
    </Section>
  );
}

export default function SessionTab(props) {
  return (
    <>
      <SessionEinstellungen {...props} />
      <Uebersicht {...props} />
    </>
  );
}

function SessionEinstellungen({ cfg, mutate, status, notify }) {
  const [zeigen, setZeigen] = useState(false);
  const ses = status.session;
  const set = (k, v) => mutate((d) => { d.session[k] = v; });
  const oeffnen = async () => { const s = await api.sessionOeffnen(); if (!s.regie?.session.offen) notify(s.regie?.session.fehler || "Session ließ sich nicht öffnen.", "err"); };
  return (
    <Section title="Session"
      right={ses.offen
        ? <button style={{ ...S.secondaryBtn, borderColor: ERR, color: ERR }} onClick={() => api.sessionSchliessen()}><Lock size={14} /> Schließen</button>
        : <button style={S.primaryBtn} disabled={!cfg.session.passwort || !cfg.session.name} onClick={oeffnen}><LockOpen size={15} /> Öffnen</button>}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Field label="Name" style={{ flex: 1, minWidth: 220 }}>
          <input style={S.input} value={cfg.session.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Passwort" style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input style={{ ...S.input, flex: 1 }} type={zeigen ? "text" : "password"} value={cfg.session.passwort} onChange={(e) => set("passwort", e.target.value)} />
            <button style={S.ghostBtn} onClick={() => setZeigen((z) => !z)}>{zeigen ? <EyeOff size={14} /> : <Eye size={14} />}</button>
          </div>
        </Field>
      </div>
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: ses.offen ? OK : ses.fehler ? ERR : WARN, boxShadow: ses.offen ? `0 0 8px ${OK}` : "none" }} />
        {ses.offen ? <span>Offen · {ses.verbunden} PCs · Port {ses.port}{ses.ip ? ` auf ${ses.ip}` : ""}</span> : <span style={{ color: ses.fehler ? ERR : SUB }}>{ses.fehler || "Geschlossen"}</span>}
      </div>
    </Section>
  );
}
