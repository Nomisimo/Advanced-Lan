import React, { useState, useEffect } from "react";
import { S, ACCENT, LINE, SUB, MUTED, OK, FELD, GLOW } from "../theme.js";
import { Field, Dot } from "../ui.jsx";
import { uiConfirm } from "../dialog.jsx";
import { ANZEIGEN, migrateLayout } from "../../core/stats-layout.js";
import { MAX_SCREENS, GROESSE_MIN, GROESSE_MAX, NAME_MAX, FORMATE, neuerScreen, freierNdiName, groesse } from "../../core/stats-screens.js";
import { Plus, Copy, Trash2, Monitor, X, Check } from "lucide-react";

// Vorlagen für einen neuen Screen: alle Anzeigen oder nur ein Element, das den ganzen Screen füllt
const VORLAGEN = [["standard", "Alle Anzeigen (Standard-Layout)"], ["leer", "Leer (nur Hintergrund)"], ...ANZEIGEN.map((a) => [a.typ, `Nur: ${a.label}`]), ["spieler", "Nur: Spieler-Karte"], ["wert", "Nur: einzelner Wert (Zahl)"], ["text", "Nur: eigener Text"]];

const kopie = (x) => JSON.parse(JSON.stringify(x));

// Leiste über dem Editor: Screens wählen, anlegen, duplizieren, löschen, Name und Größe in Pixeln
export default function ScreenLeiste({ cfg, mutate, status, screen }) {
  const screens = cfg.stats?.screens || [];
  const [neu, setNeu] = useState(null); // offenes Formular für einen neuen Screen
  const setStats = (fn) => mutate((d) => { d.stats = fn(kopie(d.stats)); });
  const waehlen = (id) => setStats((s) => ({ ...s, aktiv: id }));
  const aendern = (patch) => setStats((s) => ({ ...s, screens: s.screens.map((x) => (x.id === screen.id ? { ...x, ...patch } : x)) }));
  const anlegen = ({ name, b, h, vorlage }) => setStats((s) => {
    const n = neuerScreen({ name, b, h, vorlage });
    n.ndiName = freierNdiName(`Advanced LAN ${n.name}`, s.screens.map((x) => x.ndiName));
    return { ...s, aktiv: n.id, screens: [...s.screens, n] };
  });
  const duplizieren = () => setStats((s) => {
    const n = { ...kopie(screen), ...neuerScreen(), name: `${screen.name} (Kopie)`.slice(0, NAME_MAX), b: screen.b, h: screen.h, layout: kopie(screen.layout), ndi: false };
    n.ndiName = freierNdiName(screen.ndiName, s.screens.map((x) => x.ndiName));
    return { ...s, aktiv: n.id, screens: [...s.screens, n] };
  });
  const loeschen = async () => {
    if (screens.length < 2) return;
    if (!(await uiConfirm(`Screen „${screen.name}“ mit seinem Layout löschen? Pop-out-Fenster und NDI-Quelle des Screens gehen aus.`))) return;
    setStats((s) => { const rest = s.screens.filter((x) => x.id !== screen.id); return { ...s, aktiv: rest[0].id, screens: rest }; });
  };
  // Neue Größe: Elemente bleiben in der Fläche; mitSkalieren: Positionen und Größen anteilig mitnehmen
  const groesseSetzen = (b, h, mitSkalieren) => {
    const g = groesse(b, h);
    if (g.b === screen.b && g.h === screen.h) return;
    let l = screen.layout;
    if (mitSkalieren) {
      const fx = g.b / screen.b, fy = g.h / screen.h;
      l = { ...l, elemente: l.elemente.map((e) => ({ ...e, x: e.x * fx, y: e.y * fy, b: e.b * fx, h: e.h * fy, ...(e.typ === "text" ? { groesse: Math.max(10, Math.min(400, Math.round(e.groesse * Math.min(fx, fy)))) } : {}) })) };
    }
    aendern({ ...g, layout: migrateLayout(l, g) });
  };
  const st = status.stats?.screens || {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }} data-testid="screen-leiste">
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {screens.map((x) => {
          const an = x.id === screen.id, s = st[x.id] || {};
          return (
            <button key={x.id} data-testid={`screen-${x.id}`} onClick={() => waehlen(x.id)} title={`${x.name}: ${x.b}×${x.h} px`}
              style={{ ...S.secondaryBtn, ...(an ? { borderColor: ACCENT, color: "#fff", boxShadow: GLOW, background: "rgba(157,92,255,.16)" } : {}) }}>
              <Monitor size={13} /> {x.name} <span style={{ fontSize: 10, color: an ? "#d4d0de" : MUTED }}>{x.b}×{x.h}</span>
              {(s.fenster || s.ndi?.laeuft) && <Dot color={OK} glow size={7} title={[s.fenster && "Fenster offen", s.ndi?.laeuft && "NDI sendet"].filter(Boolean).join(", ")} />}
            </button>
          );
        })}
        <button style={S.secondaryBtn} disabled={screens.length >= MAX_SCREENS} onClick={() => setNeu(neu ? null : { name: `Screen ${screens.length + 1}`, b: 800, h: 200, vorlage: "spielstand" })}
          title={`Weiteren Screen anlegen (höchstens ${MAX_SCREENS}), jeder mit eigener NDI-Quelle`} data-testid="screen-neu"><Plus size={14} /> Neuer Screen</button>
      </div>

      {neu && <NeuerScreen wert={neu} setWert={setNeu} abbrechen={() => setNeu(null)} anlegen={() => { anlegen(neu); setNeu(null); }} />}

      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", border: `1px solid ${LINE}`, borderRadius: 8, background: FELD, padding: "10px 12px" }}>
        <Field label="Name des Screens" style={{ width: 200 }}>
          <TextFeld wert={screen.name} max={NAME_MAX} testid="screen-name" setzen={(v) => aendern({ name: v })} />
        </Field>
        <Groesse screen={screen} setzen={groesseSetzen} />
        <span style={{ flex: 1 }} />
        <button style={S.smallBtn} disabled={screens.length >= MAX_SCREENS} onClick={duplizieren} title="Screen mit Layout kopieren"><Copy size={12} /> Duplizieren</button>
        <button style={S.dangerBtn} disabled={screens.length < 2} onClick={loeschen} title={screens.length < 2 ? "Der letzte Screen bleibt" : "Screen löschen"}><Trash2 size={12} /> Löschen</button>
      </div>
    </div>
  );
}

// Textfeld, das erst beim Verlassen oder Enter speichert
function TextFeld({ wert, max, setzen, testid }) {
  const [v, setV] = useState(wert);
  useEffect(() => setV(wert), [wert]);
  return <input data-testid={testid} style={S.inputSm} value={v} maxLength={max} onChange={(e) => setV(e.target.value)}
    onBlur={() => (v.trim() && v.trim() !== wert ? setzen(v.trim()) : setV(wert))} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />;
}

// Größe in Pixeln: Formate zur Auswahl oder frei; „Inhalt mitskalieren“ nimmt die Elemente anteilig mit
function Groesse({ screen, setzen }) {
  const [b, setB] = useState(String(screen.b)), [h, setH] = useState(String(screen.h));
  const [mit, setMit] = useState(false);
  useEffect(() => { setB(String(screen.b)); setH(String(screen.h)); }, [screen.b, screen.h]);
  const format = FORMATE.find(([fb, fh]) => fb === screen.b && fh === screen.h);
  const uebernehmen = () => setzen(Number(b), Number(h), mit);
  const feld = (wert, set, testid) => <input type="number" data-testid={testid} style={{ ...S.inputSm, width: 76 }} min={GROESSE_MIN} max={GROESSE_MAX} value={wert}
    onChange={(e) => set(e.target.value)} onBlur={uebernehmen} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />;
  return (
    <>
      <Field label="Format">
        <select style={{ ...S.selectSm, width: 190 }} value={format ? `${format[0]}x${format[1]}` : ""} data-testid="screen-format"
          onChange={(e) => { const f = FORMATE.find(([fb, fh]) => `${fb}x${fh}` === e.target.value); if (f) setzen(f[0], f[1], mit); }}>
          {!format && <option value="">Eigene Größe</option>}
          {FORMATE.map(([fb, fh, n]) => <option key={`${fb}x${fh}`} value={`${fb}x${fh}`}>{n} ({fb}×{fh})</option>)}
        </select>
      </Field>
      <Field label="Breite × Höhe (Pixel)" hint={`${GROESSE_MIN} bis ${GROESSE_MAX} px`}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>{feld(b, setB, "screen-b")}<span style={{ color: SUB }}>×</span>{feld(h, setH, "screen-h")}</div>
      </Field>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: SUB, paddingBottom: 6 }} title="Beim Ändern der Größe Positionen, Größen und Schrift der Elemente anteilig mitnehmen. Aus: Elemente bleiben, wo sie sind (und werden nur in die Fläche geholt).">
        <input type="checkbox" checked={mit} onChange={(e) => setMit(e.target.checked)} /> Inhalt mitskalieren
      </label>
    </>
  );
}

function NeuerScreen({ wert, setWert, abbrechen, anlegen }) {
  const set = (k, v) => setWert({ ...wert, [k]: v });
  const g = groesse(wert.b, wert.h);
  return (
    <div style={{ border: `1px solid ${ACCENT}`, borderRadius: 8, background: FELD, padding: 12, boxShadow: GLOW, display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }} data-testid="screen-neu-form">
      <Field label="Name" style={{ width: 180 }}><input style={S.inputSm} value={wert.name} maxLength={NAME_MAX} onChange={(e) => set("name", e.target.value)} data-testid="neu-name" /></Field>
      <Field label="Format">
        <select style={{ ...S.selectSm, width: 190 }} value={FORMATE.some(([b, h]) => b === g.b && h === g.h) ? `${g.b}x${g.h}` : ""}
          onChange={(e) => { const f = FORMATE.find(([b, h]) => `${b}x${h}` === e.target.value); if (f) setWert({ ...wert, b: f[0], h: f[1] }); }}>
          <option value="">Eigene Größe</option>
          {FORMATE.map(([b, h, n]) => <option key={`${b}x${h}`} value={`${b}x${h}`}>{n} ({b}×{h})</option>)}
        </select>
      </Field>
      <Field label="Breite × Höhe (Pixel)">
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="number" style={{ ...S.inputSm, width: 76 }} min={GROESSE_MIN} max={GROESSE_MAX} value={wert.b} onChange={(e) => set("b", e.target.value)} data-testid="neu-b" />
          <span style={{ color: SUB }}>×</span>
          <input type="number" style={{ ...S.inputSm, width: 76 }} min={GROESSE_MIN} max={GROESSE_MAX} value={wert.h} onChange={(e) => set("h", e.target.value)} data-testid="neu-h" />
        </div>
      </Field>
      <Field label="Inhalt" hint="„Nur …“: das Element füllt den ganzen Screen, Hintergrund transparent">
        <select style={{ ...S.selectSm, width: 230 }} value={wert.vorlage} onChange={(e) => set("vorlage", e.target.value)} data-testid="neu-vorlage">
          {VORLAGEN.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <span style={{ flex: 1 }} />
      <button style={S.secondaryBtn} onClick={abbrechen}><X size={14} /> Abbrechen</button>
      <button style={S.primaryBtn} onClick={anlegen} data-testid="neu-anlegen"><Check size={14} /> Anlegen ({g.b}×{g.h})</button>
    </div>
  );
}
