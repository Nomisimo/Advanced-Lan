import React, { useState, useEffect } from "react";
import { S, ACCENT, LINE, SUB, MUTED, OK, WARN, ERR } from "./theme.js";
import { api } from "./api.js";
import Kopf from "./Kopf.jsx";
import { Section, Field, Toggle, Dot, KartenWahl, useKarten } from "./ui.jsx";
import AppEinstellungen from "./AppEinstellungen.jsx";
import { GRUPPE, DATEN_PORT } from "../core/stats-sync-cfg.js";
import { MonitorPlay, X, Radio } from "lucide-react";

// Modus „Stats-Screen-PC“: zeigt nur die Stats-Screens der Regie als Fenster (Beamer, zweiter Bildschirm).
// Layout, Stand und Events kommen per UDP von der Regie (Multicast, sonst Unicast), siehe core/stats-sync.js.
export default function StatsPcApp({ cfg: alles, mutate: mutateAlles, status, version, notify, modusWechseln }) {
  const cfg = alles.statspc;
  const st = status.statspc || {};
  const mutate = (fn) => mutateAlles((d) => fn(d.statspc));
  const karten = useKarten();
  const [zText, zFarbe] = st.fehler && !st.laeuft ? ["Fehler", ERR] : st.verbunden ? [st.layout ? "Verbunden" : "Verbunden, Layout lädt …", st.layout ? OK : WARN] : ["Sucht die Regie …", WARN];
  const fenster = (id) => !!st.ausgabe?.screens?.[id]?.fenster;
  return (
    <div style={S.app}>
      <Kopf modus="STATS-SCREEN" version={version} modusWechseln={modusWechseln} meta={<>
        <span style={{ color: zFarbe }}>{zText}</span>
        {st.verbunden && st.regie && <span> mit {st.session ? `„${st.session}“` : "der Regie"} ({st.regie.ip})</span>}
      </>} />
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <main style={S.main}>
          <Section title="Verbindung zur Regie" subtitle="Die Regie schickt Layout, Spielstand und Events per UDP: an alle über Multicast, an diesen PC zusätzlich direkt (Unicast), wenn der Multicast hier nicht ankommt. Verlorene Pakete heilen sich in einer Sekunde von selbst."
            right={<span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: zFarbe }}><Dot color={zFarbe} glow={st.verbunden} /> {zText}</span>}>
            <div data-testid="statspc-status" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 14 }}>
              <Wert label="Regie" wert={st.regie ? `${st.regie.name || "Regie"} · ${st.regie.ip}` : "noch keine"} />
              <Wert label="Weg" wert={st.weg === "multicast" ? "Multicast" : st.weg === "unicast" ? "Unicast (direkt)" : "–"} farbe={st.weg ? OK : MUTED} />
              <Wert label="Letztes Paket" wert={st.letztes == null ? "–" : st.letztes < 1000 ? `vor ${st.letztes} ms` : `vor ${Math.round(st.letztes / 1000)} s`} farbe={st.letztes != null && st.letztes < 2000 ? OK : WARN} />
              <Wert label="Layout" wert={st.layout ? "aktuell" : st.verbunden ? "wird geholt" : "–"} farbe={st.layout ? OK : MUTED} />
            </div>
            {st.fehler && <div style={{ fontSize: 12, color: st.laeuft ? WARN : ERR, marginBottom: 10 }}>{st.fehler}</div>}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <Field label="Adresse der Regie" hint="Leer = automatisch (Multicast und Session-Suche). Eintragen, wenn die Regie in einem anderen Netz ist." style={{ width: 260 }}>
                <TextFeld wert={cfg.regie} placeholder="automatisch" setzen={(v) => mutate((d) => { d.regie = v; })} testid="statspc-regie" />
              </Field>
              <Field label="Netzwerkkarte" style={{ width: 260 }}>
                <KartenWahl karten={karten} wert={cfg.netz} onChange={(v) => mutate((d) => { d.netz = v; })} leer="Automatisch (alle Karten)" />
              </Field>
              <Field label="Multicast-Gruppe" style={{ width: 150 }}>
                <TextFeld wert={cfg.gruppe} placeholder={GRUPPE} setzen={(v) => mutate((d) => { d.gruppe = v; })} />
              </Field>
              <Field label="Port" hint="Wie in der Regie (Setup)" style={{ width: 100 }}>
                <TextFeld wert={String(cfg.port)} placeholder={String(DATEN_PORT)} setzen={(v) => mutate((d) => { d.port = Number(v); })} />
              </Field>
            </div>
          </Section>

          <Section title="Screens" subtitle="Alle Stats-Screens der Regie. Jedes Fenster auf einen Bildschirm oder Beamer ziehen, Doppelklick schaltet Vollbild. Offene Fenster gehen beim nächsten Start wieder auf."
            right={<Toggle checked={cfg.vollbild} label="Gleich als Vollbild" onChange={(v) => mutate((d) => { d.vollbild = v; })} />}>
            {!st.screens?.length ? <div style={S.empty}>{st.verbunden ? "Layout wird geholt …" : "Noch keine Verbindung zur Regie. In der Regie unter Setup „Stats-Screen-PCs“ einschalten."}</div> : (
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
                {st.screens.map((x) => (
                  <div key={x.id} data-testid={`statspc-screen-${x.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderBottom: `1px solid ${LINE}`, background: "#1a1820" }}>
                    <Radio size={14} color={fenster(x.id) ? OK : SUB} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{x.name}</div>
                      <div style={{ fontSize: 11, color: SUB }}>{x.b}×{x.h} px</div>
                    </div>
                    <button style={fenster(x.id) ? { ...S.secondaryBtn, borderColor: ACCENT } : S.secondaryBtn} onClick={() => api.statsFenster(!fenster(x.id), x.id)} data-testid={`statspc-fenster-${x.id}`}>
                      {fenster(x.id) ? <><X size={14} /> Fenster schließen</> : <><MonitorPlay size={14} /> Fenster öffnen</>}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>
          <AppEinstellungen cfg={alles} status={status} mutate={mutateAlles} notify={notify} />
        </main>
      </div>
    </div>
  );
}

const Wert = ({ label, wert, farbe }) => (
  <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: "8px 10px", background: "#1a1820", minWidth: 0 }}>
    <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 700, color: farbe || "#ece9f2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wert}</div>
  </div>
);

// Speichert erst beim Verlassen oder Enter
function TextFeld({ wert, setzen, placeholder, testid }) {
  const [v, setV] = useState(wert || "");
  useEffect(() => setV(wert || ""), [wert]);
  return <input data-testid={testid} style={S.inputSm} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)}
    onBlur={() => (v.trim() !== (wert || "") ? setzen(v.trim()) : null)} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />;
}
