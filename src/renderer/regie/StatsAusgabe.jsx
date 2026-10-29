import React, { useState, useEffect } from "react";
import { S, LINE, SUB, MUTED, OK, WARN, ERR } from "../theme.js";
import { Section, Field, Toggle, Dot } from "../ui.jsx";
import { api } from "../api.js";
import { MonitorPlay, X, Cast } from "lucide-react";

const MAC = typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);

// Game-Stats-Screen: einschalten, Pop-out-Fenster und NDI-Stream (Tab „Stats-Screen“, darunter der Editor)
export default function StatsAusgabe({ cfg, mutate, status }) {
  const s = cfg.stats || {}, st = status.stats || {}, ndi = st.ndi || {};
  const [ndiCheck, setNdiCheck] = useState(null);
  const [name, setName] = useState(s.ndiName || "");
  useEffect(() => { if (api.ndiPruefen) api.ndiPruefen().then(setNdiCheck); else setNdiCheck({ verfuegbar: false, fehler: "nur in der App, nicht in der Browser-Vorschau" }); }, []);
  useEffect(() => setName(s.ndiName || ""), [s.ndiName]);
  const set = (k, v) => mutate((d) => { d.stats = { ...d.stats, [k]: v }; });
  const an = !!s.an, ndiGeht = ndiCheck?.verfuegbar !== false;
  const ndiText = !an ? "aus" : !s.ndi ? "aus" : ndi.fehler ? ndi.fehler : ndi.laeuft ? `sendet als „${ndi.name}“ · ${ndi.aufloesung}, ${ndi.fps} fps · ${ndi.verbindungen || 0} Empfänger · ${ndi.bilder || 0} Bilder` : "startet …";
  const ndiFarbe = !an || !s.ndi ? MUTED : ndi.fehler ? ERR : ndi.laeuft ? OK : WARN;
  return (
    <Section title="Ausgabe" subtitle="Spielstand, Zahlen des Matches, beste Spieler und letzte Events des aktiven Spiels für Publikum und Stream. Als eigenes Fenster (zweiter Bildschirm, Beamer) oder als NDI-Quelle für OBS, vMix und Co."
      right={<Toggle checked={an} label="Einschalten" onChange={(v) => set("an", v)} />}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16, alignItems: "start", opacity: an ? 1 : 0.5 }}>
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
          {an && s.ndi && ndi.laeuft && !ndi.verbindungen && <div style={{ fontSize: 11, color: WARN, marginTop: 8, lineHeight: 1.5 }}>{MAC ? "Kein Empfänger sieht die Quelle? Unter Systemeinstellungen → Datenschutz & Sicherheit → Lokales Netzwerk muss Advanced LAN erlaubt sein. Ist der Schalter schon an, einmal aus- und wieder einschalten und die App neu starten. Sender und Empfänger müssen im selben Netz sein." : "Kein Empfänger sieht die Quelle? Die Windows-Firewall muss Advanced LAN im privaten Netz erlauben (Windows-Sicherheit → Firewall → App zulassen), und Sender und Empfänger müssen im selben Netz sein."}</div>}
          <div style={{ fontSize: 10, color: MUTED, marginTop: 8 }}>1920×1080, 30 fps, im selben Netz.{ndi.version ? ` ${ndi.version}.` : ""} NDI® ist eine eingetragene Marke von Vizrt NDI AB.</div>
        </div>
      </div>
    </Section>
  );
}
