import React, { useRef, useState } from "react";
import { S, ACCENT, ACCENT_HI, LINE, SUB, MUTED, FELD, GLOW } from "../theme.js";
import { Field } from "../ui.jsx";
import { HINTERGRUENDE, VERLAUF_ARTEN, VERLAUF_VORLAGEN, MAX_STOPPS, verlaufCss, farbeBei, rgba } from "../../core/stats-layout.js";
import { Palette, ImagePlus, Trash2, ArrowLeftRight, Plus } from "lucide-react";

// Hintergrund des Stats-Screens: Vorlage, eigene Farbe, eigener Verlauf (mit Verlauf-Editor) oder eigenes Bild.
// aendern(patch, vorher): patch für layout.hg; fokus(): Stand vor einer fortlaufenden Änderung (Regler, Farbwähler) merken.
export default function HintergrundEditor({ layout, setArt, aendern, fokus, bildSetzen }) {
  const hg = layout.hg;
  const art = layout.hintergrund;
  return (
    <div data-testid="hintergrund-editor" style={{ border: `1px solid ${LINE}`, borderRadius: 8, background: FELD, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}><Palette size={14} /> Hintergrund</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        {HINTERGRUENDE.map(([k, l]) => (
          <button key={k} onClick={() => setArt(k)} data-testid={`hg-${k}`}
            style={{ ...S.smallBtn, justifyContent: "flex-start", padding: "5px 7px", ...(art === k ? { background: ACCENT, borderColor: ACCENT } : {}) }}>{l}</button>
        ))}
      </div>
      {art === "farbe" && (
        <Field label="Farbe">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="color" value={hg.farbe} onFocus={fokus} onPointerDown={fokus} onChange={(e) => aendern({ farbe: e.target.value }, null)} style={{ width: 44, height: 28, border: "none", background: "transparent", padding: 0, cursor: "pointer" }} />
            <span style={{ ...S.mono, color: SUB }}>{hg.farbe}</span>
          </div>
        </Field>
      )}
      {art === "eigen" && <VerlaufEditor v={hg.verlauf} aendern={(v, vorher) => aendern({ verlauf: v }, vorher)} fokus={fokus} />}
      {art === "bild" && (
        <>
          {layout.bilder[hg.bild] ? <img src={layout.bilder[hg.bild]} alt="" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 6, border: `1px solid ${LINE}` }} />
            : <div style={{ ...S.hint, marginTop: 0 }}>Noch kein Bild gewählt.</div>}
          <button style={S.secondaryBtn} onClick={bildSetzen}><ImagePlus size={13} /> {hg.bild ? "Anderes Bild" : "Bild wählen"}</button>
          <Field label="Darstellung">
            <div style={{ display: "flex", gap: 3 }}>
              {[["fuellen", "Füllen"], ["einpassen", "Einpassen"]].map(([k, l]) => (
                <button key={k} onClick={() => aendern({ passung: k })} style={{ ...S.smallBtn, flex: 1, ...(hg.passung === k ? { background: ACCENT, borderColor: ACCENT } : {}) }}>{l}</button>
              ))}
            </div>
          </Field>
          <Regler label="Abdunkeln" wert={hg.abdunkeln} max={90} einheit="%" fokus={fokus} onChange={(v) => aendern({ abdunkeln: v }, null)} />
        </>
      )}
    </div>
  );
}

export function Regler({ label, wert, min = 0, max = 100, einheit = "", fokus, onChange, testid }) {
  return (
    <Field label={<span style={{ display: "flex", justifyContent: "space-between" }}><span>{label}</span><span style={{ color: "#ece9f2", fontVariantNumeric: "tabular-nums" }}>{wert}{einheit}</span></span>}>
      <input type="range" data-testid={testid} min={min} max={max} value={wert} onPointerDown={fokus} onFocus={fokus} onChange={(e) => onChange(Number(e.target.value))} style={{ accentColor: ACCENT, width: "100%" }} />
    </Field>
  );
}

// Verlauf-Editor: Farbstopps auf der Leiste ziehen, Klick auf die Leiste setzt einen neuen Stopp
function VerlaufEditor({ v, aendern, fokus }) {
  const [aktiv, setAktiv] = useState(0);
  const leiste = useRef(null);
  const zug = useRef(null);
  const i = Math.min(aktiv, v.stopps.length - 1);
  const stopp = v.stopps[i];
  // Stopps bleiben sortiert; der gezogene behält seine Auswahl
  const mitStopps = (stopps, waehle) => {
    const sortiert = stopps.map((s, k) => ({ s, k })).sort((a, b) => a.s.pos - b.s.pos);
    if (waehle != null) setAktiv(sortiert.findIndex((x) => x.k === waehle));
    return { ...v, stopps: sortiert.map((x) => x.s) };
  };
  const posAus = (ev) => { const r = leiste.current.getBoundingClientRect(); return Math.round(Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100))); };
  const stoppAendern = (patch, vorher) => aendern(mitStopps(v.stopps.map((s, k) => (k === i ? { ...s, ...patch } : s)), i), vorher);
  const neuerStopp = (ev) => {
    if (v.stopps.length >= MAX_STOPPS) return;
    const pos = posAus(ev);
    aendern(mitStopps([...v.stopps, { ...farbeBei(v, pos), pos }], v.stopps.length));
  };
  const ziehenStart = (ev, k) => {
    ev.stopPropagation(); ev.preventDefault();
    setAktiv(k);
    fokus();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    zug.current = { k };
  };
  const ziehen = (ev) => {
    if (!zug.current) return;
    const pos = posAus(ev), k = zug.current.k;
    const neu = v.stopps.map((s, j) => (j === k ? { ...s, pos } : s));
    const sortiert = neu.map((s, j) => ({ s, j })).sort((a, b) => a.s.pos - b.s.pos);
    zug.current.k = sortiert.findIndex((x) => x.j === k);
    setAktiv(zug.current.k);
    aendern({ ...v, stopps: sortiert.map((x) => x.s) }, null);
  };
  const ende = () => { zug.current = null; };
  const leistenCss = `linear-gradient(90deg, ${v.stopps.map((s) => `${rgba(s.farbe, s.alpha)} ${s.pos}%`).join(", ")})`;
  const karo = "repeating-conic-gradient(#3a3647 0% 25%, #23212c 0% 50%) 0 0 / 12px 12px";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="verlauf-editor">
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {VERLAUF_VORLAGEN.map(([name, vl]) => (
          <button key={name} title={name} onClick={() => { aendern(JSON.parse(JSON.stringify(vl))); setAktiv(0); }}
            style={{ width: 34, height: 22, borderRadius: 4, border: `1px solid ${LINE}`, background: verlaufCss(vl), cursor: "pointer", padding: 0 }} />
        ))}
      </div>
      <div style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 6, border: `1px solid ${LINE}`, background: `${verlaufCss(v)}, ${karo}` }} data-testid="verlauf-vorschau" />
      <div style={{ display: "flex", gap: 3 }}>
        {VERLAUF_ARTEN.map(([k, l]) => (
          <button key={k} onClick={() => aendern({ ...v, art: k })} style={{ ...S.smallBtn, flex: 1, ...(v.art === k ? { background: ACCENT, borderColor: ACCENT } : {}) }}>{l}</button>
        ))}
      </div>
      {/* Leiste mit den Farbstopps */}
      <div style={{ position: "relative", paddingBottom: 16 }}>
        <div ref={leiste} data-testid="verlauf-leiste" onPointerDown={neuerStopp} title="Klicken: Farbstopp hinzufügen"
          style={{ height: 26, borderRadius: 5, border: `1px solid ${LINE}`, background: `${leistenCss}, ${karo}`, cursor: v.stopps.length < MAX_STOPPS ? "copy" : "default" }} />
        {v.stopps.map((s, k) => (
          <span key={k} data-testid={`stopp-${k}`} onPointerDown={(ev) => ziehenStart(ev, k)} onPointerMove={ziehen} onPointerUp={ende} onPointerCancel={ende}
            title={`${s.farbe} · ${s.pos}%`}
            style={{ position: "absolute", left: `${s.pos}%`, top: 18, width: 14, height: 18, marginLeft: -7, boxSizing: "border-box", borderRadius: "3px 3px 4px 4px", cursor: "ew-resize", touchAction: "none",
              background: s.farbe, border: `2px solid ${k === i ? "#fff" : LINE}`, boxShadow: k === i ? GLOW : "0 1px 3px rgba(0,0,0,.6)" }}>
            <span style={{ position: "absolute", left: "50%", top: -7, marginLeft: -5, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: `6px solid ${k === i ? "#fff" : LINE}` }} />
          </span>
        ))}
      </div>
      {stopp && (
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "end" }}>
          <Field label="Farbe">
            <input type="color" data-testid="stopp-farbe" value={stopp.farbe} onFocus={fokus} onPointerDown={fokus} onChange={(e) => stoppAendern({ farbe: e.target.value }, null)} style={{ width: 44, height: 28, border: "none", background: "transparent", padding: 0, cursor: "pointer" }} />
          </Field>
          <Regler label="Position" wert={stopp.pos} einheit="%" fokus={fokus} onChange={(pos) => stoppAendern({ pos }, null)} />
          <span />
          <Regler label="Deckkraft" wert={stopp.alpha} einheit="%" fokus={fokus} onChange={(alpha) => stoppAendern({ alpha }, null)} />
        </div>
      )}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        <button style={S.smallBtn} disabled={v.stopps.length >= MAX_STOPPS} onClick={() => { const pos = Math.round((v.stopps[i].pos + (v.stopps[i + 1]?.pos ?? 100)) / 2); aendern(mitStopps([...v.stopps, { ...farbeBei(v, pos), pos }], v.stopps.length)); }}><Plus size={12} /> Stopp</button>
        <button style={S.smallBtn} onClick={() => { aendern({ ...v, stopps: v.stopps.map((s) => ({ ...s, pos: 100 - s.pos })).reverse() }); setAktiv(v.stopps.length - 1 - i); }}><ArrowLeftRight size={12} /> Umkehren</button>
        <span style={{ flex: 1 }} />
        <button style={S.dangerBtn} disabled={v.stopps.length <= 2} onClick={() => { aendern({ ...v, stopps: v.stopps.filter((_, k) => k !== i) }); setAktiv(Math.max(0, i - 1)); }} title="Ausgewählten Farbstopp löschen"><Trash2 size={12} /></button>
      </div>
      {v.art !== "radial" && <Regler label={v.art === "konisch" ? "Drehung" : "Winkel"} wert={v.winkel} max={360} einheit="°" fokus={fokus} onChange={(winkel) => aendern({ ...v, winkel }, null)} testid="verlauf-winkel" />}
      {v.art !== "linear" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Regler label="Mitte X" wert={v.x} einheit="%" fokus={fokus} onChange={(x) => aendern({ ...v, x }, null)} />
          <Regler label="Mitte Y" wert={v.y} einheit="%" fokus={fokus} onChange={(y) => aendern({ ...v, y }, null)} />
        </div>
      )}
      <div style={{ fontSize: 10, color: MUTED }}>Klick auf die Leiste: neuer Farbstopp · Stopps ziehen zum Verschieben</div>
    </div>
  );
}
