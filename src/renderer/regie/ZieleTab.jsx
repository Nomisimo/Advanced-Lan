import React from "react";
import { S, SUB } from "../theme.js";
import { Section, th, td, Kbd } from "../ui.jsx";
import { api } from "../api.js";
import { uid } from "../../core/defaults.js";
import { Plus, Trash2, Send } from "lucide-react";

export default function ZieleTab({ cfg, mutate, notify }) {
  const setZiel = (id, k, v) => mutate((d) => { const t = d.targets.find((x) => x.id === id); if (t) t[k] = v; });
  return (
    <Section title="Ziele"
      right={<button style={S.primaryBtn} onClick={() => mutate((d) => { d.targets.push({ id: uid(), name: "", host: "", port: 8000 }); })}><Plus size={14} /> Ziel hinzufügen</button>}>
      <table style={S.table}>
        <thead><tr><th style={th()}>Notiz</th><th style={th()}>IP-Adresse</th><th style={th()}>Port (UDP)</th><th style={th()}></th></tr></thead>
        <tbody>
          {cfg.targets.map((t) => (
            <tr key={t.id}>
              <td style={td()}><input style={S.inputSm} value={t.name} placeholder="optional" onChange={(e) => setZiel(t.id, "name", e.target.value)} /></td>
              <td style={td({ width: 200 })}><input style={{ ...S.inputSm, ...S.mono }} value={t.host} placeholder="192.168.1.50" onChange={(e) => setZiel(t.id, "host", e.target.value.trim())} /></td>
              <td style={td({ width: 120 })}><input style={S.inputSm} type="number" min="1" max="65535" value={t.port} onChange={(e) => setZiel(t.id, "port", +e.target.value || 0)} /></td>
              <td style={td({ whiteSpace: "nowrap", textAlign: "right" })}>
                <button style={S.smallBtn} title="/lan/test senden" onClick={async () => { const r = await api.zielTesten(t.id); r.ok ? notify(`/lan/test an ${t.host}:${t.port} geschickt.`) : notify(r.fehler, "err"); }}><Send size={12} /> Test</button>
                <button style={{ ...S.dangerBtn, marginLeft: 6 }} onClick={() => mutate((d) => { d.targets = d.targets.filter((x) => x.id !== t.id); })}><Trash2 size={12} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {cfg.targets.length === 0 && <div style={S.empty}>Kein Ziel.</div>}
    </Section>
  );
}
