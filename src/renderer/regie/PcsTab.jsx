import React from "react";
import { S, SUB, MUTED, OK, ERR } from "../theme.js";
import { Section, TeamChip, Dot, th, td } from "../ui.jsx";
import { api } from "../api.js";
import { SPIEL_BY_ID } from "../../core/spiele.js";
import { Unplug } from "lucide-react";

export const SpielChip = ({ spiel, aktiv }) => {
  const s = SPIEL_BY_ID[spiel];
  if (!s) return <span style={{ color: MUTED }}>{spiel || "–"}</span>;
  return <span style={{ ...S.badge, background: s.farbe + (aktiv ? "33" : "11"), color: aktiv ? s.farbe : MUTED, border: `1px solid ${s.farbe}${aktiv ? "88" : "33"}` }}>{s.kurz}</span>;
};

export default function PcsTab({ cfg, status, jetzt }) {
  const pcs = [...status.pcs].sort((a, b) => Number(b.verbunden) - Number(a.verbunden) || a.pcId.localeCompare(b.pcId, "de", { numeric: true }));
  return (
    <Section title="Verbundene Game-PCs" subtitle="Game-PCs treten der Session mit ihrer PC-ID bei und schicken alles, was sie erkennen. Ereignisse eines anderen Spiels als dem aktiven verwirft die Regie.">
      {pcs.length === 0 ? <div style={S.empty}>Noch kein PC verbunden. Auf den Game-PCs die LAN-Regie im Modus „Game-PC“ starten und die Session „{cfg.session.name}“ wählen.</div> : (
        <table style={S.table}>
          <thead><tr>
            <th style={th({ width: 30 })}></th><th style={th()}>PC-ID</th><th style={th()}>Erkennt</th><th style={th()}>Meldet gerade</th><th style={th()}>Spieler</th><th style={th()}>Team</th>
            <th style={th()}>Leben</th><th style={th()}>K / D</th><th style={th()}>Adresse</th><th style={th()}>Zuletzt</th><th style={th()}></th>
          </tr></thead>
          <tbody>
            {pcs.map((p) => {
              const s = p.status || {};
              const aktiv = !p.spiel || p.spiel === cfg.aktivesSpiel;
              return (
                <tr key={p.pcId} style={{ opacity: p.verbunden ? 1 : 0.5 }}>
                  <td style={td()}><Dot color={p.verbunden ? (aktiv ? OK : ERR) : "#4d475c"} glow={p.verbunden} title={p.verbunden ? (aktiv ? "verbunden, aktives Spiel" : "verbunden, anderes Spiel: Ereignisse werden verworfen") : "getrennt"} /></td>
                  <td style={td({ fontWeight: 700 })}>{p.pcId}{p.sim && <span style={{ ...S.badge, marginLeft: 6, background: "#2f2c3a", color: SUB }}>Simulator</span>}</td>
                  <td style={td()}><span style={{ display: "inline-flex", gap: 4 }}>{(p.spiele || []).map((x) => <SpielChip key={x} spiel={x} aktiv={x === cfg.aktivesSpiel} />)}</span></td>
                  <td style={td()}>{p.spiel ? <SpielChip spiel={p.spiel} aktiv={aktiv} /> : <span style={{ color: MUTED }}>–</span>}</td>
                  <td style={td()}>{s.spieler || (s.zuschauer ? <span style={{ color: SUB }}>schaut {s.zuschauer} zu</span> : <span style={{ color: MUTED }}>–</span>)}</td>
                  <td style={td()}><TeamChip team={s.team} /></td>
                  <td style={td()}>{s.health ?? "–"}</td>
                  <td style={td()}>{s.kills ?? 0} / {s.deaths ?? 0}</td>
                  <td style={td({ color: SUB, fontSize: 12 })}>{p.remote || "–"}</td>
                  <td style={td({ color: SUB, fontSize: 12 })}>{p.t ? `vor ${Math.max(0, Math.round((jetzt - p.t) / 1000))} s` : "–"}</td>
                  <td style={td({ textAlign: "right" })}>{p.verbunden && !p.sim && <button style={S.dangerBtn} title="Verbindung trennen" onClick={() => confirm(`${p.pcId} trennen?`) && api.pcTrennen(p.pcId)}><Unplug size={12} /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Section>
  );
}
