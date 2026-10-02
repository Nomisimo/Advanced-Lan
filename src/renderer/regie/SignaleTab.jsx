import React from "react";
import { S, ACCENT, SUB, MUTED } from "../theme.js";
import { Section, Toggle, th, td, Kbd, EventIcon } from "../ui.jsx";
import { api } from "../api.js";
import { SPIEL_BY_ID } from "../../core/spiele.js";
import { oscAdresse, freigegeben } from "../../core/signal.js";
import { Send } from "lucide-react";

export default function SignaleTab({ cfg, mutate, notify }) {
  const spiel = SPIEL_BY_ID[cfg.aktivesSpiel];
  const events = spiel?.events || [];
  const setzen = (type, an) => mutate((d) => { d.signale = d.signale || {}; d.signale[d.aktivesSpiel] = { ...(d.signale[d.aktivesSpiel] || {}), [type]: an }; });
  const alle = (an) => mutate((d) => { d.signale = d.signale || {}; d.signale[d.aktivesSpiel] = Object.fromEntries(events.map((e) => [e.id, an])); });
  const testen = async (type) => {
    const k = await api.signalTesten(cfg.aktivesSpiel, type);
    if (!cfg.targets.length) notify("Keine Ziele eingetragen (Tab „Ziele“).", "warn");
    else if (k) notify(`Gesendet an ${cfg.targets.length} Ziel(e): ${k.address}`);
  };

  if (!events.length) return (
    <Section title={`Signale · ${spiel?.name}`}><div style={S.empty}>Für {spiel?.name} gibt es noch keine Ereignisse.</div></Section>
  );

  return (
    <Section title={`Signale · ${spiel?.name}`}
      subtitle="Die Regie sendet nur, was passiert ist. Was ein Empfänger daraus macht (Licht, Ton, Video), wird dort eingestellt. Hier lässt sich nur festlegen, welche Ereignisse überhaupt rausgehen."
      right={<div style={{ display: "flex", gap: 6 }}><button style={S.smallBtn} onClick={() => alle(true)}>Alle an</button><button style={S.smallBtn} onClick={() => alle(false)}>Alle aus</button></div>}>
      <table style={S.table}>
        <thead><tr><th style={th({ width: 40 })}>Senden</th><th style={th()}>Ereignis</th><th style={th()}>OSC-Adresse</th><th style={th()}></th></tr></thead>
        <tbody>
          {events.map((e) => {
            const an = freigegeben(cfg, cfg.aktivesSpiel, e.id);
            return (
              <tr key={e.id} style={{ opacity: an ? 1 : 0.5 }}>
                <td style={td()}><Toggle checked={an} onChange={(v) => setzen(e.id, v)} /></td>
                <td style={td()}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ color: ACCENT, display: "inline-flex" }}><EventIcon type={e.id} /></span>{e.label}</span></td>
                <td style={td({ ...S.mono, color: "#d9c6ff" })}>{oscAdresse({ type: e.id, spiel: cfg.aktivesSpiel, pcId: "PC 03" }, e.spieler)}</td>
                <td style={td({ textAlign: "right" })}><button style={S.smallBtn} title="Jetzt an alle Ziele senden (auch wenn die Ausgabe aus ist)" onClick={() => testen(e.id)}><Send size={12} /> Test</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={S.hint}>
        Spieler-Ereignisse enthalten die PC-ID in der Adresse (Beispiel <Kbd>pc03</Kbd>), Ereignisse für das ganze Spiel nicht.
        Jedes Signal hat dieselben vier Argumente: Team <Kbd>s</Kbd>, Spieler <Kbd>s</Kbd>, PC-ID <Kbd>s</Kbd>, Runde <Kbd>i</Kbd>.
        Leere Werte werden als leerer Text bzw. 0 geschickt.
      </p>
    </Section>
  );
}
