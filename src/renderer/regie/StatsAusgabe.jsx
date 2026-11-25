import React, { useState, useEffect } from "react";
import { S, LINE, SUB, MUTED, OK, WARN, ERR, ACCENT } from "../theme.js";
import { Section, Toggle, Dot, Field, KartenWahl, useKarten } from "../ui.jsx";
import { api } from "../api.js";
import { NDI_NAME_MAX, freierNdiName } from "../../core/stats-screens.js";
import { MonitorPlay, X, Cast } from "lucide-react";

const MAC = typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);
const kopie = (x) => JSON.parse(JSON.stringify(x));

// Game-Stats-Screens: einschalten, je Screen Pop-out-Fenster und eigene NDI-Quelle (Tab „Stats-Screen“, unter dem Editor)
export default function StatsAusgabe({ cfg, mutate, status }) {
  const s = cfg.stats || {}, st = status.stats || {};
  const screens = s.screens || [];
  const [ndiCheck, setNdiCheck] = useState(null);
  const karten = useKarten();
  useEffect(() => { if (api.ndiPruefen) api.ndiPruefen().then(setNdiCheck); else setNdiCheck({ verfuegbar: false, fehler: "nur in der App, nicht in der Browser-Vorschau" }); }, []);
  const setAn = (v) => mutate((d) => { d.stats = { ...d.stats, an: v }; });
  const setScreen = (id, patch) => mutate((d) => { d.stats = { ...d.stats, screens: kopie(d.stats.screens).map((x) => (x.id === id ? { ...x, ...patch } : x)) }; });
  const an = !!s.an, ndiGeht = ndiCheck?.verfuegbar !== false;
  const ohneEmpfaenger = an && screens.some((x) => x.ndi && st.screens?.[x.id]?.ndi?.laeuft && !st.screens[x.id].ndi.verbindungen);
  return (
    <Section title="Ausgabe" subtitle="Jeder Screen als eigenes Fenster (zweiter Bildschirm, Beamer) und als eigene NDI-Quelle für OBS, vMix und Co. Jede Quelle sendet in der Größe ihres Screens."
      right={<Toggle checked={an} label="Einschalten" onChange={setAn} />}>
      <div style={{ opacity: an ? 1 : 0.5 }}>
        {!ndiGeht && <div style={{ fontSize: 12, color: WARN, marginBottom: 8 }}>NDI nicht verfügbar: {ndiCheck?.fehler || ""}</div>}
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
          {screens.map((x, i) => (
            <ScreenZeile key={x.id} x={x} st={st.screens?.[x.id] || {}} an={an} ndiGeht={ndiGeht} erste={i === 0} aktiv={x.id === s.aktiv}
              setNdi={(v) => setScreen(x.id, { ndi: v })}
              setName={(v) => setScreen(x.id, { ndiName: freierNdiName(v, screens.filter((y) => y.id !== x.id).map((y) => y.ndiName)) })} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
          <Field label="Netzwerkkarte für NDI" style={{ width: 320 }} hint={st.ndi?.karteFehler ? "" : st.ndi?.karte && st.ndi?.umgebung ? `NDI sendet nur über ${st.ndi.karte} (${st.ndi.ip})` : st.ndi?.karte ? "Noch nicht wirksam, Neustart nötig" : "Automatisch: NDI nutzt alle Karten"}>
            <div data-testid="ndi-karte"><KartenWahl karten={karten} wert={cfg.netz?.ndi} leer="Automatisch (alle Karten)" onChange={(v) => mutate((d) => { d.netz = { ...d.netz, ndi: v }; })} /></div>
          </Field>
          {st.ndi?.neustart && <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 4 }} data-testid="ndi-neustart">
            <span style={{ fontSize: 11, color: WARN, maxWidth: 340, lineHeight: 1.4 }}>Die Karte gilt erst nach einem Neustart der App: das NDI SDK liest sie nur beim Start.</span>
            {api.appNeustart && <button style={S.smallBtn} onClick={() => api.appNeustart()}>App neu starten</button>}
          </div>}
          {st.ndi?.karteFehler && <div style={{ fontSize: 11, color: WARN, paddingBottom: 6, maxWidth: 380, lineHeight: 1.4 }}>{st.ndi.karteFehler}</div>}
        </div>
        {ohneEmpfaenger && <div style={{ fontSize: 11, color: WARN, marginTop: 8, lineHeight: 1.5 }}>{MAC ? "Kein Empfänger sieht eine Quelle? Unter Systemeinstellungen → Datenschutz & Sicherheit → Lokales Netzwerk muss Advanced LAN erlaubt sein. Ist der Schalter schon an, einmal aus- und wieder einschalten und die App neu starten. Sender und Empfänger müssen im selben Netz sein." : "Kein Empfänger sieht eine Quelle? Die Windows-Firewall muss Advanced LAN im privaten Netz erlauben (Windows-Sicherheit → Firewall → App zulassen), und Sender und Empfänger müssen im selben Netz sein."}</div>}
        <div style={{ fontSize: 10, color: MUTED, marginTop: 8 }}>{st.ndi?.fps || 30} fps, im selben Netz. Transparenter Hintergrund: die Quelle sendet mit Alpha-Kanal (Key in vMix/OBS nicht nötig). Jede Quelle braucht etwas Rechenleistung, viele große Screens gleichzeitig belasten die Regie.{st.ndi?.version ? ` ${st.ndi.version}.` : ""} NDI® ist eine eingetragene Marke von Vizrt NDI AB.</div>
      </div>
    </Section>
  );
}

function ScreenZeile({ x, st, an, ndiGeht, erste, aktiv, setNdi, setName }) {
  const ndi = st.ndi || {};
  const [name, setNameLokal] = useState(x.ndiName || "");
  useEffect(() => setNameLokal(x.ndiName || ""), [x.ndiName]);
  const ndiText = !an || !x.ndi ? "aus" : ndi.fehler ? ndi.fehler : ndi.laeuft ? `sendet als „${ndi.name}“ · ${ndi.aufloesung}${ndi.alpha ? " mit Alpha" : ""} · ${ndi.verbindungen || 0} Empfänger · ${ndi.bilder || 0} Bilder` : "startet …";
  const ndiFarbe = !an || !x.ndi ? MUTED : ndi.fehler ? ERR : ndi.laeuft ? OK : WARN;
  return (
    <div data-testid={`ausgabe-${x.id}`} style={{ display: "grid", gridTemplateColumns: "minmax(150px,1fr) auto minmax(220px,1.4fr) auto", gap: 12, alignItems: "center", padding: "10px 12px", borderBottom: `1px solid ${LINE}`, background: aktiv ? "rgba(157,92,255,.07)" : "#1a1820" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: aktiv ? "#fff" : undefined }}>{x.name}{erste && <span style={{ fontSize: 10, color: MUTED, fontWeight: 400 }}> · Knopf „Stats“ oben</span>}</div>
        <div style={{ fontSize: 11, color: SUB }}>{x.b}×{x.h} px{x.layout?.hintergrund === "transparent" ? " · transparent" : ""}</div>
      </div>
      <button disabled={!an} style={st.fenster ? { ...S.secondaryBtn, borderColor: ACCENT } : S.secondaryBtn} onClick={() => api.statsFenster(!st.fenster, x.id)} data-testid={`fenster-${x.id}`}
        title="Auf einen zweiten Bildschirm ziehen, Doppelklick schaltet Vollbild">
        {st.fenster ? <><X size={14} /> Fenster schließen</> : <><MonitorPlay size={14} /> Fenster öffnen</>}
      </button>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Cast size={14} color={SUB} />
          <input style={S.inputSm} value={name} disabled={!an} maxLength={NDI_NAME_MAX} placeholder="Name der NDI-Quelle" title="So erscheint die Quelle in OBS, vMix oder NDI Studio Monitor" data-testid={`ndi-name-${x.id}`}
            onChange={(e) => setNameLokal(e.target.value)} onBlur={() => (name.trim() && name.trim() !== x.ndiName ? setName(name.trim()) : setNameLokal(x.ndiName || ""))} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, marginTop: 5, color: ndiFarbe, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Dot color={ndiFarbe} glow={ndi.laeuft} /> {ndiText}</div>
      </div>
      <Toggle disabled={!an || !ndiGeht} checked={!!x.ndi} label="NDI senden" onChange={setNdi} />
    </div>
  );
}
