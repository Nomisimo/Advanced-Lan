import React from "react";
import { S, ACCENT, MUTED } from "../theme.js";
import { Section, Toggle, th, td, EventIcon, SpielChip } from "../ui.jsx";
import { api } from "../api.js";
import { SPIELE } from "../../core/spiele.js";
import { oscAdresse, freigegeben } from "../../core/signal.js";
import { Send } from "lucide-react";

// Ein Abschnitt je genutztem Spiel (Tab „Setup“)
function SpielSignale({ spiel, cfg, mutate, notify }) {
  const events = spiel.events;
  const setzen = (type, an) => mutate((d) => { d.signale = d.signale || {}; d.signale[spiel.id] = { ...(d.signale[spiel.id] || {}), [type]: an }; });
  const alle = (an) => mutate((d) => { d.signale = d.signale || {}; d.signale[spiel.id] = Object.fromEntries(events.map((e) => [e.id, an])); });
  const testen = async (type) => {
    if (!cfg.targets.length) return notify("Kein Ziel eingetragen.", "warn");
    const k = await api.signalTesten(spiel.id, type);
    if (k) notify(`${k.address} → ${cfg.targets.length} Ziel(e)`);
  };
  const aktiv = spiel.id === cfg.aktivesSpiel;
  return (
    <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{spiel.name} <SpielChip spiel={spiel.id} aktiv={aktiv} />{aktiv && <span style={{ fontSize: 11, color: ACCENT, fontWeight: 600 }}>aktiv</span>}</span>}
      right={events.length > 0 && <div style={{ display: "flex", gap: 6 }}><button style={S.smallBtn} onClick={() => alle(true)}>Alle an</button><button style={S.smallBtn} onClick={() => alle(false)}>Alle aus</button></div>}>
      {!events.length ? <div style={S.empty}>Noch keine Datenquelle, keine Events.</div> : (
        <table style={{ ...S.table, marginTop: 0 }}>
          <thead><tr><th style={th({ width: 40 })}>An</th><th style={th()}>Event</th><th style={th()}>OSC-Adresse</th><th style={th()}></th></tr></thead>
          <tbody>
            {events.map((e) => {
              const an = freigegeben(cfg, spiel.id, e.id);
              return (
                <tr key={e.id} style={{ opacity: an ? 1 : 0.5 }}>
                  <td style={td()}><Toggle checked={an} onChange={(v) => setzen(e.id, v)} /></td>
                  <td style={td()}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ color: ACCENT, display: "inline-flex" }}><EventIcon type={e.id} /></span>{e.label}</span></td>
                  <td style={td({ ...S.mono, color: "#d9c6ff" })}>{oscAdresse({ type: e.id, spiel: spiel.id, pcId: "<pc>" }, e.spieler).replace("/pc/", "/<pc>/")}</td>
                  <td style={td({ textAlign: "right" })}><button style={S.smallBtn} title="Test an alle Ziele" onClick={() => testen(e.id)}><Send size={12} /> Test</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Section>
  );
}

export default function SignaleTab(props) {
  const genutzt = SPIELE.filter((s) => props.cfg.spiele?.[s.id]);
  return <>{genutzt.map((s) => <SpielSignale key={s.id} spiel={s} {...props} />)}</>;
}
