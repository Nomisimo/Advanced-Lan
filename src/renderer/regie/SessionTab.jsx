import React, { useEffect, useState } from "react";
import { S, SUB, MUTED, OK, ERR, WARN, ACCENT } from "../theme.js";
import { Section, Field, Kbd } from "../ui.jsx";
import { api } from "../api.js";
import { Lock, LockOpen, Eye, EyeOff } from "lucide-react";

export default function SessionTab({ cfg, mutate, status, notify }) {
  const [zeigen, setZeigen] = useState(false);
  const [adressen, setAdressen] = useState([]);
  useEffect(() => { api.netzAdressen().then(setAdressen); }, []);
  const ses = status.session;
  const set = (k, v) => mutate((d) => { d.session[k] = v; });
  const oeffnen = async () => { const s = await api.sessionOeffnen(); if (!s.regie?.session.offen) notify(s.regie?.session.fehler || "Session ließ sich nicht öffnen.", "err"); };

  return (
    <>
      <Section title="Session" subtitle="Die Regie öffnet eine Session im LAN. Game-PCs sehen sie automatisch und treten mit dem Passwort bei."
        right={ses.offen
          ? <button style={{ ...S.secondaryBtn, borderColor: ERR, color: ERR }} onClick={() => api.sessionSchliessen()}><Lock size={14} /> Session schließen</button>
          : <button style={S.primaryBtn} disabled={!cfg.session.passwort || !cfg.session.name} onClick={oeffnen}><LockOpen size={15} /> Session öffnen</button>}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Name der Session" style={{ minWidth: 240 }}>
            <input style={S.input} value={cfg.session.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Passwort" style={{ minWidth: 240 }} hint={ses.offen ? "Ändern trennt alle PCs, sie müssen das neue Passwort eingeben." : undefined}>
            <div style={{ display: "flex", gap: 6 }}>
              <input style={{ ...S.input, flex: 1 }} type={zeigen ? "text" : "password"} value={cfg.session.passwort} onChange={(e) => set("passwort", e.target.value)} placeholder="Pflichtfeld" />
              <button style={S.ghostBtn} onClick={() => setZeigen((z) => !z)} title={zeigen ? "Verbergen" : "Anzeigen"}>{zeigen ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            </div>
          </Field>
          <Field label="Port (TCP)">
            <input style={{ ...S.input, width: 110 }} type="number" key={cfg.session.port} defaultValue={cfg.session.port}
              onBlur={(e) => { const p = Math.round(+e.target.value); if (p >= 1024 && p <= 65535) { if (p !== cfg.session.port) set("port", p); } else e.target.value = cfg.session.port; }}
              onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
          </Field>
        </div>
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: ses.offen ? OK : ses.fehler ? ERR : WARN, boxShadow: ses.offen ? `0 0 8px ${OK}` : "none" }} />
          {ses.offen ? <span>Offen auf Port {ses.port}. {ses.verbunden} PCs verbunden.</span> : <span style={{ color: ses.fehler ? ERR : SUB }}>{ses.fehler || "Geschlossen. Game-PCs können nicht beitreten."}</span>}
        </div>
      </Section>
      <Section title="Netzwerk">
        <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, color: "#d4d0de" }}>
          Die Regie veröffentlicht die Session per <b>mDNS</b> (Multicast <Kbd>224.0.0.251:5353</Kbd>, Dienst <Kbd>_lanregie._tcp</Kbd>). Game-PCs verbinden sich per WebSocket auf
          Port <Kbd>{cfg.session.port}</Kbd>. Das Passwort geht dabei nicht im Klartext übers Netz (Challenge-Response mit HMAC-SHA256).
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d0de" }}>
          Findet ein Game-PC die Session nicht (anderes Subnetz, Multicast im Switch gesperrt), trägt man dort die IP der Regie von Hand ein:
          {adressen.length ? adressen.map((a) => <span key={a.ip}> <Kbd>{a.ip}</Kbd> <span style={{ color: MUTED }}>({a.name})</span></span>) : " –"}
        </p>
        <p style={S.hint}>Windows-Firewall auf der Regie: eingehend TCP {cfg.session.port} erlauben. Auf allen PCs: UDP 5353 (mDNS) erlauben. Beim ersten Start fragt Windows meist selbst nach.</p>
      </Section>
    </>
  );
}
