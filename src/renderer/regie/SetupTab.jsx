import React, { useState, useEffect } from "react";
import { S, LINE, SUB, MUTED, OK, WARN, ERR, ACCENT, GLOW } from "../theme.js";
import { Section, Check, Field, KartenWahl, useKarten, Toggle, Dot } from "../ui.jsx";
import { api } from "../api.js";
import { StatsBuehne } from "../StatsScreen.jsx";
import { SPIELE } from "../../core/spiele.js";
import { MonitorPlay, X, Cast } from "lucide-react";

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

function RegieCheck({ cfg, status, standalone }) {
  const ses = status.session;
  const punkte = [
    // Standalone: das Spiel läuft hier absichtlich, die Session ist nur für zusätzliche Game-PCs
    ...(standalone ? [] : [{ label: "Kein Spiel auf diesem PC", ok: !status.spielAufRegie, detail: status.spielAufRegie ? `läuft: ${status.spielAufRegie}` : "ok" }]),
    standalone ? { label: "Session für weitere PCs", ok: ses.offen, warn: true, detail: ses.offen ? `„${cfg.session.name}“ auf Port ${ses.port}` : "optional, zu" }
      : { label: "Session offen", ok: ses.offen, detail: ses.offen ? `„${cfg.session.name}“ auf Port ${ses.port}` : ses.fehler || "geschlossen" },
    { label: "Ziel eingetragen", ok: cfg.targets.some((t) => t.host && t.port), detail: `${cfg.targets.filter((t) => t.host && t.port).length} Ziel(e)` },
    { label: "Aktives Spiel hat eine Datenquelle", ok: !!SPIELE.find((s) => s.id === cfg.aktivesSpiel)?.quelle, detail: SPIELE.find((s) => s.id === cfg.aktivesSpiel)?.name },
    ...(SPIELE.find((s) => s.id === cfg.aktivesSpiel)?.gep ? [{ label: "Overwolf liefert Spieldaten", ok: false, warn: true, detail: "erst mit Overwolf-Freigabe und signierter App, der Simulator geht schon" }] : []),
    { label: "Ausgabe an", ok: !!cfg.armed, warn: true, detail: cfg.armed ? "an" : "aus (nach jedem Start)" },
  ];
  const offen = punkte.filter((p) => !p.ok && !p.warn).length;
  return (
    <Section title="Check" right={<span style={{ fontSize: 12, fontWeight: 700, color: offen ? WARN : OK }}>{offen ? `${offen} offen` : "Alles bereit"}</span>}>
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>{punkte.map((p) => <Check key={p.label} {...p} />)}</div>
    </Section>
  );
}

// Game-Stats-Screen: Pop-out-Fenster und NDI-Stream (nur Regie und Standalone)
function StatsScreenSetup({ cfg, mutate, status, log }) {
  const s = cfg.stats || {}, st = status.stats || {}, ndi = st.ndi || {};
  const [ndiCheck, setNdiCheck] = useState(null);
  const [name, setName] = useState(s.ndiName || "");
  useEffect(() => { if (api.ndiPruefen) api.ndiPruefen().then(setNdiCheck); else setNdiCheck({ verfuegbar: false, fehler: "nur in der App, nicht in der Browser-Vorschau" }); }, []);
  useEffect(() => setName(s.ndiName || ""), [s.ndiName]);
  const set = (k, v) => mutate((d) => { d.stats = { ...d.stats, [k]: v }; });
  const an = !!s.an, ndiGeht = ndiCheck?.verfuegbar !== false;
  const ndiText = !an ? "aus" : !s.ndi ? "aus" : ndi.fehler ? ndi.fehler : ndi.laeuft ? `sendet als „${ndi.name}“ · ${ndi.aufloesung}, ${ndi.fps} fps · ${ndi.verbindungen || 0} Empfänger` : "startet …";
  const ndiFarbe = !an || !s.ndi ? MUTED : ndi.fehler ? ERR : ndi.laeuft ? OK : WARN;
  return (
    <Section title="Game-Stats-Screen" subtitle="Spielstand, Zahlen des Matches, beste Spieler und letzte Events des aktiven Spiels für Publikum und Stream. Als eigenes Fenster (zweiter Bildschirm, Beamer) oder als NDI-Quelle für OBS, vMix und Co."
      right={<Toggle checked={an} label="Einschalten" onChange={(v) => set("an", v)} />}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) 384px", gap: 16, alignItems: "start", opacity: an ? 1 : 0.5 }}>
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: 14, background: "#1a1820" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 6 }}><MonitorPlay size={15} /> Pop-out-Fenster <span style={{ flex: 1 }} /><Dot color={st.fenster ? OK : MUTED} glow={st.fenster} /></div>
          <div style={{ fontSize: 12, color: SUB, lineHeight: 1.5, marginBottom: 12 }}>Auf einen zweiten Bildschirm ziehen, Doppelklick schaltet Vollbild. Auch über den Knopf <b>Stats</b> oben in der Kopfzeile.</div>
          <button disabled={!an} style={st.fenster ? S.secondaryBtn : S.primaryBtn} onClick={() => api.statsFenster(!st.fenster)}>
            {st.fenster ? <><X size={14} /> Fenster schließen</> : <><MonitorPlay size={14} /> Fenster öffnen</>}
          </button>
        </div>
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: 14, background: "#1a1820" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 6 }}><Cast size={15} /> NDI-Stream <span style={{ flex: 1 }} /><Toggle disabled={!an || !ndiGeht} checked={s.ndi} label="Senden" onChange={(v) => set("ndi", v)} /></div>
          <Field label="Name der NDI-Quelle" hint="So erscheint die Quelle in OBS, vMix oder NDI Studio Monitor">
            <input style={S.input} value={name} disabled={!an} maxLength={60} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name.trim() !== s.ndiName ? set("ndiName", name.trim()) : setName(s.ndiName || "")} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
          </Field>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, marginTop: 10, color: ndiFarbe }}><Dot color={ndiFarbe} glow={ndi.laeuft} /> {ndiGeht ? ndiText : `nicht verfügbar: ${ndiCheck?.fehler || ""}`}</div>
          <div style={{ fontSize: 10, color: MUTED, marginTop: 8 }}>1920×1080, 30 fps, im selben Netz. NDI® ist eine eingetragene Marke von Vizrt NDI AB.</div>
        </div>
        <div>
          <div style={{ width: 384, height: 216, borderRadius: 8, overflow: "hidden", border: `1px solid ${an ? ACCENT : LINE}`, boxShadow: an ? GLOW : "none", position: "relative" }}>
            <div style={{ width: 1920, height: 1080, transform: "scale(0.2)", transformOrigin: "0 0", pointerEvents: "none" }}>
              <StatsBuehne status={status} cfg={{ regie: cfg }} log={log} />
            </div>
          </div>
          <div style={{ fontSize: 10, color: MUTED, marginTop: 6, textAlign: "center" }}>Vorschau</div>
        </div>
      </div>
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
      <StatsScreenSetup {...props} />
      <Netzwerk {...props} />
    </>
  );
}
