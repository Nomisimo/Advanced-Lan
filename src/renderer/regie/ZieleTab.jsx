import React from "react";
import { S, SUB } from "../theme.js";
import { Section, th, td, Kbd } from "../ui.jsx";
import { api } from "../api.js";
import { uid } from "../../core/defaults.js";
import { Plus, Trash2, Send } from "lucide-react";

const TYPEN = { ma3: "grandMA3", playout: "Playout", osc: "OSC allgemein" };

export default function ZieleTab({ cfg, mutate, notify }) {
  const setZiel = (id, k, v) => mutate((d) => { const t = d.targets.find((x) => x.id === id); if (t) t[k] = v; });
  const benutzt = (id) => cfg.rules.filter((r) => r.target === id).length;
  return (
    <>
      <Section title="OSC-Ziele" subtitle="Hierhin schickt die Regie ihre Cues, per UDP."
        right={<button style={S.primaryBtn} onClick={() => mutate((d) => { d.targets.push({ id: uid(), name: "Neues Ziel", typ: "osc", host: "", port: 8000 }); })}><Plus size={14} /> Ziel hinzufügen</button>}>
        <table style={S.table}>
          <thead><tr><th style={th()}>Name</th><th style={th()}>Typ</th><th style={th()}>IP-Adresse</th><th style={th()}>Port (UDP)</th><th style={th()}>Cues</th><th style={th()}></th></tr></thead>
          <tbody>
            {cfg.targets.map((t) => (
              <tr key={t.id}>
                <td style={td()}><input style={S.inputSm} value={t.name} onChange={(e) => setZiel(t.id, "name", e.target.value)} /></td>
                <td style={td({ width: 160 })}><select style={S.selectSm} value={t.typ} onChange={(e) => setZiel(t.id, "typ", e.target.value)}>{Object.entries(TYPEN).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
                <td style={td({ width: 180 })}><input style={{ ...S.inputSm, ...S.mono }} value={t.host} placeholder="192.168.1.50" onChange={(e) => setZiel(t.id, "host", e.target.value.trim())} /></td>
                <td style={td({ width: 110 })}><input style={S.inputSm} type="number" min="1" max="65535" value={t.port} onChange={(e) => setZiel(t.id, "port", +e.target.value || 0)} /></td>
                <td style={td({ color: SUB })}>{benutzt(t.id)}</td>
                <td style={td({ whiteSpace: "nowrap", textAlign: "right" })}>
                  <button style={S.smallBtn} title="Schickt /lanparty/test an dieses Ziel" onClick={async () => { const r = await api.zielTesten(t.id); r.ok ? notify(`Test an ${t.host}:${t.port} geschickt.`) : notify(r.fehler, "err"); }}><Send size={12} /> Test</button>
                  <button style={{ ...S.dangerBtn, marginLeft: 6 }} onClick={() => (!benutzt(t.id) || confirm(`${benutzt(t.id)} Cues nutzen „${t.name}“. Trotzdem löschen?`)) && mutate((d) => { d.targets = d.targets.filter((x) => x.id !== t.id); })}><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="grandMA3 einrichten">
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, fontSize: 13 }}>
          <li>In der MA3: <b>Menu → In &amp; Out → OSC</b>, eine Zeile anlegen.</li>
          <li>Interface auf das Netz der Regie stellen, <b>Port</b> wie hier (Standard 8000), <b>Prefix</b> <Kbd>gma3</Kbd>.</li>
          <li><b>Receive</b> und <b>Receive Command</b> einschalten, OSC oben in der Liste aktivieren.</li>
          <li>Hier auf <b>Test</b> drücken: In der MA3-Kommandozeile bzw. im OSC-Monitor muss <Kbd>/lanparty/test</Kbd> ankommen.</li>
        </ol>
        <p style={S.hint}>Die Feldnamen stammen aus dem MA3-Handbuch, bitte an der eigenen Softwareversion prüfen. Das Playout (z. B. QLab, Resolume, CasparCG über Companion) bekommt Adressen wie <Kbd>/lanparty/round_end</Kbd> mit dem Gewinnerteam als Text. Audio über Dante läuft über den Playout-Rechner.</p>
      </Section>
    </>
  );
}
