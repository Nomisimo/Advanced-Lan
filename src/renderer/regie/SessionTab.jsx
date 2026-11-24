import React, { useState, useEffect } from "react";
import { S, SUB, MUTED, OK, ERR, WARN } from "../theme.js";
import { Section, Field, Dot, KartenWahl, useKarten, th, td } from "../ui.jsx";
import { api } from "../api.js";
import { SPIELER_MAX } from "../../core/protokoll.js";
import { Lock, LockOpen, Eye, EyeOff, Unplug, MessageSquareText, Maximize } from "lucide-react";

const PLATTFORM = { win32: "Windows", darwin: "macOS", linux: "Linux" };
const pingFarbe = (ms) => (ms == null ? MUTED : ms > 50 ? ERR : ms > 10 ? WARN : OK);

// Spielername eines PCs: hier eintragen (der PC übernimmt ihn) oder das Namens-Popup am PC zeigen lassen.
// Läuft dort ein Spiel im exklusiven Vollbild, ist das Popup unsichtbar und wartet: dann hilft nur Eintragen hier.
function SpielerZelle({ p, notify }) {
  const [name, setName] = useState(p.spieler || "");
  useEffect(() => setName(p.spieler || ""), [p.spieler]);
  const h = p.hinweis || {};
  const melden = (r) => r?.fehler && notify(r.fehler, "err");
  const uebernehmen = async () => { if (name.trim() !== (p.spieler || "")) melden(await api.regieSpielerSetzen(p.pcId, name)); };
  if (!p.verbunden) return <span style={{ color: p.spieler ? "#ece9f2" : MUTED }}>{p.spieler || "–"}</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 170 }}>
      <div style={{ display: "flex", gap: 4 }}>
        <input style={{ ...S.input, padding: "4px 7px", fontSize: 13, flex: 1, minWidth: 0 }} value={name} placeholder={p.pcId} maxLength={SPIELER_MAX}
          title="Steht auf dem Game-Stats-Screen. Enter: an den PC schicken"
          onChange={(e) => setName(e.target.value)} onBlur={uebernehmen} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
        <button style={S.smallBtn} onClick={async () => melden(await api.regieNameFragen(p.pcId))} title="Namens-Popup am Game-PC zeigen"><MessageSquareText size={12} /></button>
      </div>
      {(h.vollbild === "exklusiv" || h.nameOffen) && <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {h.vollbild === "exklusiv" && <span style={{ ...S.badge, background: "#3a2f14", color: WARN, display: "inline-flex", alignItems: "center", gap: 3 }} title="Spiel läuft im exklusiven Vollbild: Overlay und Namens-Popup sind am PC nicht zu sehen. Im Spiel randloses Vollbild einstellen."><Maximize size={10} /> Exklusives Vollbild</span>}
        {h.nameOffen && <span style={{ ...S.badge, background: "#3a1f24", color: ERR }} title="Das Namens-Popup wartet, bis das Spiel das Vollbild verlässt. Name hier eintragen.">Name offen</span>}
      </div>}
    </div>
  );
}

// Wer in der Session ist: echte Game-PCs (simulierte stehen im Tab „Control“)
function Uebersicht({ status, version, notify }) {
  const pcs = status.pcs.filter((p) => !p.sim).sort((a, b) => (b.verbunden - a.verbunden) || a.pcId.localeCompare(b.pcId, "de", { numeric: true }));
  const andereVersion = (v) => v && version && v !== version;
  return (
    <Section title="Verbunden" right={<span style={{ fontSize: 12, color: SUB }}>{pcs.filter((p) => p.verbunden).length} von {pcs.length} PCs online</span>}>
      {!pcs.length ? <div style={S.empty}>Noch kein Game-PC beigetreten.</div> : (
        <table style={{ ...S.table, marginTop: 0 }}>
          <thead><tr>{["", "PC-ID", "Spieler", "Hostname", "IP", "MAC", "Ping", "App-Version", "Netzwerkkarte", ""].map((h, i) => <th key={i} style={th()}>{h}</th>)}</tr></thead>
          <tbody>{pcs.map((p) => {
            const g = p.geraet || {};
            return (
              <tr key={p.pcId} style={{ opacity: p.verbunden ? 1 : 0.5 }}>
                <td style={td({ width: 18 })}><Dot color={p.verbunden ? OK : MUTED} glow={p.verbunden} title={p.verbunden ? "verbunden" : "getrennt"} /></td>
                <td style={td({ fontWeight: 800 })}>{p.pcId}</td>
                <td style={td()}><SpielerZelle p={p} notify={notify} /></td>
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
      <div style={S.hint}>Ping: Antwortzeit der Verbindung, alle 3 s gemessen. Grün bis 10 ms, orange bis 50 ms, darüber rot. Eine andere App-Version als die der Regie ist orange markiert. Spieler: Name eintragen und Enter, der Game-PC übernimmt ihn; die Sprechblase zeigt das Namens-Popup am PC. Über einem Spiel im <b>exklusiven Vollbild</b> ist das Popup nicht zu sehen und wartet, bis der Spieler das Spiel verlässt: dann den Namen hier eintragen.</div>
    </Section>
  );
}

export default function SessionTab(props) {
  return (
    <>
      <SessionEinstellungen {...props} />
      <Uebersicht {...props} />
      <Empfangskarte {...props} />
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

// Über welche Netzwerkkarte die Session die Game-PCs empfängt, dazu alle Karten dieses PCs
function Empfangskarte({ cfg, mutate, status }) {
  const karten = useKarten();
  return (
    <Section title="Netzwerkkarte" subtitle="Automatisch: das Betriebssystem wählt. Mit fester Karte bleibt jeder Verkehr in seinem Netz, z. B. Game-PCs im LAN und Licht im eigenen Netz (OSC-Karte im Tab „Ziele“).">
      <Field label="Empfangen: Session für die Game-PCs" hint={status.session.offen ? `lauscht auf ${status.session.ip || "allen Karten"}, Port ${status.session.port}` : "Session ist geschlossen"} style={{ maxWidth: 520 }}>
        <KartenWahl karten={karten} wert={cfg.netz?.empfang} onChange={(v) => mutate((d) => { d.netz = { ...d.netz, empfang: v }; })} leer="Alle Karten" />
      </Field>
      <table style={S.table}>
        <thead><tr>{["Karte", "IP", "Maske", "MAC"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>{karten.map((k) => (
          <tr key={k.name + k.ip}>
            <td style={{ ...S.td, fontWeight: 600 }}>{k.name}</td>
            <td style={{ ...S.td, ...S.mono }}>{k.ip}</td>
            <td style={{ ...S.td, ...S.mono, color: SUB }}>{k.maske}</td>
            <td style={{ ...S.td, ...S.mono, color: SUB }}>{k.mac}</td>
          </tr>
        ))}</tbody>
      </table>
      {!karten.length && <div style={S.empty}>Keine aktive Netzwerkkarte gefunden.</div>}
    </Section>
  );
}
