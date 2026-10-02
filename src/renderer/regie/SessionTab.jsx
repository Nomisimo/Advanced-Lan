import React, { useState } from "react";
import { S, SUB, OK, ERR, WARN } from "../theme.js";
import { Section, Field } from "../ui.jsx";
import { api } from "../api.js";
import { Lock, LockOpen, Eye, EyeOff } from "lucide-react";

export default function SessionTab({ cfg, mutate, status, notify }) {
  const [zeigen, setZeigen] = useState(false);
  const ses = status.session;
  const set = (k, v) => mutate((d) => { d.session[k] = v; });
  const oeffnen = async () => { const s = await api.sessionOeffnen(); if (!s.regie?.session.offen) notify(s.regie?.session.fehler || "Session ließ sich nicht öffnen.", "err"); };
  return (
    <Section title="Session" style={{ maxWidth: 720 }}
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
        {ses.offen ? <span>Offen · {ses.verbunden} PCs</span> : <span style={{ color: ses.fehler ? ERR : SUB }}>{ses.fehler || "Geschlossen"}</span>}
      </div>
    </Section>
  );
}
