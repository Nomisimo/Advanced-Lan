import React, { useState, useEffect } from "react";
import { S, LINE, SUB, MUTED, OK, WARN, teamFarbe } from "../theme.js";
import { api } from "../api.js";
import { Section, Check, TeamChip, SpielChip, Kbd } from "../ui.jsx";
import { SPIELE } from "../../core/spiele.js";
import { CFG_ORDNER, CFG_DATEI } from "../../core/cfg.js";
import { RL_INI_DATEI, RL_INI_ORDNER } from "../../core/rl-ini.js";
import { FileDown, Download, RefreshCw } from "lucide-react";

const Liste = ({ punkte }) => <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>{punkte.map((p) => <Check key={p.id} {...p} />)}</div>;

export default function SetupTab({ g, notify }) {
  const [check, setCheck] = useState(null);
  const laden = () => api.setupCheck().then(setCheck);
  useEffect(() => { laden(); const t = setInterval(laden, 3000); return () => clearInterval(t); }, []);
  const fertig = async (r, text) => { if (r?.ok) notify(text); else if (r?.fehler) notify(r.fehler, "err"); laden(); };
  const alle = check ? [...check.allgemein, ...check.cs2, ...check.rl] : [];
  const offen = alle.filter((p) => !p.ok).length;

  return (
    <>
      <Section title="Ist korrekt aufgesetzt?" right={<span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        {check && <span style={{ fontSize: 13, fontWeight: 800, color: offen ? WARN : OK, textShadow: offen ? "none" : `0 0 8px ${OK}` }}>{offen ? `${offen} von ${alle.length} offen` : "Alles bereit"}</span>}
        <button style={S.smallBtn} onClick={laden}><RefreshCw size={12} /> Prüfen</button>
      </span>}>
        {check ? <Liste punkte={check.allgemein} /> : <div style={S.empty}>Prüfe …</div>}
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
        <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Counter-Strike 2 <SpielChip spiel="cs2" /></span>}
          right={<div style={{ display: "flex", gap: 8 }}>
            <button style={S.primaryBtn} onClick={async () => fertig(await api.cfgInstallieren(), "cfg installiert. CS2 neu starten.")}><Download size={15} /> cfg installieren</button>
            <button style={S.secondaryBtn} onClick={async () => fertig(await api.cfgSpeichern(), "cfg gespeichert.")}><FileDown size={14} /> Speichern unter …</button>
          </div>}>
          {check && <Liste punkte={check.cs2} />}
          {check && !check.cs2[0]?.ok && <p style={S.hint}><Kbd>{CFG_DATEI}</Kbd> → <Kbd>{CFG_ORDNER}</Kbd></p>}
          {g.status && (
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 14, padding: "10px 12px", background: "#1a1820", border: `1px solid ${LINE}`, borderLeft: `3px solid ${teamFarbe(g.status.team)}`, borderRadius: 8, fontSize: 13 }}>
              <b>{g.status.spieler || (g.status.zuschauer ? `schaut ${g.status.zuschauer} zu` : "im Menü")}</b>
              <TeamChip team={g.status.team} />
              {g.status.health != null && <span style={{ color: SUB }}>{g.status.health} HP · {g.status.kills}/{g.status.deaths}</span>}
              {g.stand && <span style={{ color: SUB, marginLeft: "auto" }}>{g.stand.map} · {g.stand.ct}:{g.stand.tt}</span>}
            </div>
          )}
        </Section>

        <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Rocket League <SpielChip spiel="rl" /></span>}
          right={<div style={{ display: "flex", gap: 8 }}>
            <button style={S.primaryBtn} onClick={async () => fertig(await api.rlIniInstallieren(), "Stats API eingeschaltet. Rocket League neu starten.")}><Download size={15} /> Stats API einschalten</button>
            <button style={S.secondaryBtn} onClick={async () => fertig(await api.rlIniSpeichern(), "ini gespeichert.")}><FileDown size={14} /> Speichern unter …</button>
          </div>}>
          {check && <Liste punkte={check.rl} />}
          {check && !check.rl[0]?.ok && <p style={S.hint}><Kbd>{RL_INI_DATEI}</Kbd> → <Kbd>{RL_INI_ORDNER}</Kbd></p>}
          {g.rl?.stand && (
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 14, padding: "10px 12px", background: "#1a1820", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13 }}>
              <b>{g.rl.stand.arena || "Match"}</b>
              <span style={{ color: SUB }}>{g.rl.stand.spieler} Spieler</span>
              <span style={{ color: SUB, marginLeft: "auto" }}>{g.rl.stand.blau}:{g.rl.stand.orange}</span>
            </div>
          )}
        </Section>
      </div>
      <div>
        <Section title="Weitere Spiele">
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
            {SPIELE.filter((s) => s.id !== "cs2" && s.id !== "rl").map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: `1px solid ${LINE}`, fontSize: 13 }}>
                <SpielChip spiel={s.id} aktiv={false} />
                <span style={{ flex: 1, color: SUB }}>{s.name}</span>
                <span style={{ fontSize: 12, color: MUTED }}>{s.quelle || "noch keine Datenquelle"}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}
