import React from "react";
import { S, LINE, SUB, MUTED, OK, WARN } from "../theme.js";
import { Section, Check, Field, KartenWahl, useKarten } from "../ui.jsx";
import { SPIELE } from "../../core/spiele.js";

// Welche Spiele die Regie nutzt. Nur diese erscheinen in „Control“ und „Signale“.
function Spiele({ cfg, mutate, notify }) {
  const umschalten = (id, an) => mutate((d) => {
    const neu = { ...d.spiele, [id]: an };
    if (!Object.values(neu).some(Boolean)) return notify("Mindestens ein Spiel muss genutzt werden.", "warn");
    d.spiele = neu;
    if (!neu[d.aktivesSpiel]) d.aktivesSpiel = Object.keys(neu).find((k) => neu[k]);
  });
  return (
    <Section title="Spiele">
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
        {SPIELE.map((s) => {
          const an = !!cfg.spiele?.[s.id];
          return (
            <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderBottom: `1px solid ${LINE}`, cursor: "pointer", background: an ? s.farbe + "10" : "transparent" }}>
              <input type="checkbox" checked={an} onChange={(e) => umschalten(s.id, e.target.checked)} style={{ accentColor: s.farbe, width: 16, height: 16 }} />
              <span style={{ fontWeight: 800, color: an ? s.farbe : MUTED, minWidth: 44, letterSpacing: 0.5 }}>{s.kurz}</span>
              <span style={{ flex: 1, fontWeight: 600, color: an ? "#fff" : SUB }}>{s.name}</span>
              <span style={{ fontSize: 12, color: s.quelle ? SUB : WARN }}>{s.quelle || "noch keine Datenquelle"}</span>
              <span style={{ fontSize: 12, color: MUTED, minWidth: 70, textAlign: "right" }}>{s.events.length} Events</span>
            </label>
          );
        })}
      </div>
    </Section>
  );
}

function RegieCheck({ cfg, status }) {
  const ses = status.session;
  const punkte = [
    { label: "Kein Spiel auf diesem PC", ok: !status.spielAufRegie, detail: status.spielAufRegie ? `läuft: ${status.spielAufRegie}` : "ok" },
    { label: "Session offen", ok: ses.offen, detail: ses.offen ? `„${cfg.session.name}“ auf Port ${ses.port}` : ses.fehler || "geschlossen" },
    { label: "Ziel eingetragen", ok: cfg.targets.some((t) => t.host && t.port), detail: `${cfg.targets.filter((t) => t.host && t.port).length} Ziel(e)` },
    { label: "Aktives Spiel hat eine Datenquelle", ok: !!SPIELE.find((s) => s.id === cfg.aktivesSpiel)?.quelle, detail: SPIELE.find((s) => s.id === cfg.aktivesSpiel)?.name },
    { label: "Ausgabe an", ok: !!cfg.armed, warn: true, detail: cfg.armed ? "an" : "aus (nach jedem Start)" },
  ];
  const offen = punkte.filter((p) => !p.ok && !p.warn).length;
  return (
    <Section title="Check" right={<span style={{ fontSize: 12, fontWeight: 700, color: offen ? WARN : OK }}>{offen ? `${offen} offen` : "Alles bereit"}</span>}>
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>{punkte.map((p) => <Check key={p.label} {...p} />)}</div>
    </Section>
  );
}

// Netzwerkkarten: Empfang der Game-PCs und Senden der OSC-Befehle getrennt wählbar
export function Netzwerk({ cfg, mutate, status }) {
  const karten = useKarten();
  const set = (k, v) => mutate((d) => { d.netz = { ...d.netz, [k]: v }; });
  const eigene = cfg.targets.filter((t) => t.netz).length;
  return (
    <Section title="Netzwerkkarten" subtitle="Automatisch: das Betriebssystem wählt. Mit fester Karte bleibt jeder Verkehr in seinem Netz, z. B. Game-PCs im LAN und Licht im eigenen Netz.">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Empfangen: Session für die Game-PCs" hint={status.session.offen ? `lauscht auf ${status.session.ip || "allen Karten"}, Port ${status.session.port}` : "Session ist geschlossen"}>
          <KartenWahl karten={karten} wert={cfg.netz?.empfang} onChange={(v) => set("empfang", v)} leer="Alle Karten" />
        </Field>
        <Field label="Senden: OSC-Befehle an die Ziele" hint={`Standard für alle Ziele${eigene ? `, ${eigene} Ziel(e) mit eigener Karte` : ""} (Tab „Ziele“)`}>
          <KartenWahl karten={karten} wert={cfg.netz?.senden} onChange={(v) => set("senden", v)} />
        </Field>
      </div>
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

export default function SetupTab(props) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, alignItems: "start" }}>
        <Spiele {...props} />
        <RegieCheck {...props} />
      </div>
      <Netzwerk {...props} />
    </>
  );
}
