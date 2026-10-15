import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { S, ACCENT, ACCENT_HI, LINE, SUB, MUTED, OK, ERR, WARN, FELD, GLOW } from "../theme.js";
import { Section, Field, Toggle, Dot } from "../ui.jsx";
import { uiConfirm } from "../dialog.jsx";
import { api } from "../api.js";
import { StatsBuehne } from "../StatsScreen.jsx";
import { SPIEL_BY_ID } from "../../core/spiele.js";
import { B, H, MIN, MAX_TEXTE, ANZEIGE, HINTERGRUENDE, PLATZHALTER, standardLayout, migrateLayout, neuerText, einrasten } from "../../core/stats-layout.js";
import { statsBeispiel } from "../../core/stats-beispiel.js";
import { Type, Eye, EyeOff, Undo2, Redo2, RotateCcw, Copy, Trash2, ArrowUpToLine, ArrowDownToLine, AlignLeft, AlignCenter, AlignRight, MonitorPlay, Cast, Move } from "lucide-react";

// Editor des Game-Stats-Screens: Anzeigen und Texte per Drag and Drop auf der 1920×1080-Fläche anordnen,
// Größe an den Griffen ändern, Texte schreiben. Gespeichert in cfg.regie.stats.layout; Pop-out-Fenster und NDI zeigen es sofort.
const RASTER = [[0, "Aus"], [10, "10 px"], [20, "20 px"], [40, "40 px"]];
const GRIFFE = [["o", "l"], ["o"], ["o", "r"], ["r"], ["u", "r"], ["u"], ["u", "l"], ["l"]];
const CURSOR = { o: "ns-resize", u: "ns-resize", l: "ew-resize", r: "ew-resize", ol: "nwse-resize", ur: "nwse-resize", or: "nesw-resize", ul: "nesw-resize" };
const FARBEN = ["#ffffff", "#c39bff", "#9d5cff", "#2ecc71", "#f2b33d", "#ff5d5d", "#4ea1ff", "#a39eb3"];
const UNDO_MAX = 60;

const elLabel = (e) => (e.typ === "text" ? (e.text || "").split("\n")[0].slice(0, 28) || "Leerer Text" : ANZEIGE[e.typ]?.label || e.typ);
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function useBreite(ref) {
  const [b, setB] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setB(el.clientWidth));
    ro.observe(el); setB(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return b;
}

const Zahl = ({ label, wert, onChange, min = 0, max = 9999 }) => (
  <Field label={label}>
    <input type="number" style={S.inputSm} value={wert} min={min} max={max} onChange={(e) => e.target.value !== "" && onChange(Math.round(Number(e.target.value)))} />
  </Field>
);

export default function ScreenTab({ cfg, mutate, status, log, goTab }) {
  const gespeichert = useMemo(() => migrateLayout(cfg.stats?.layout), [cfg.stats?.layout]);
  const [layout, setLayout] = useState(gespeichert);
  const [auswahl, setAuswahl] = useState(null);
  const [raster, setRaster] = useState(() => { try { return Number(localStorage.getItem("advancedlan_screen_raster") ?? 10); } catch { return 10; } });
  const [beispiel, setBeispiel] = useState(true);
  const [linien, setLinien] = useState([]);
  const [undo, setUndo] = useState([]);
  const [redo, setRedo] = useState([]);
  const zug = useRef(null); // laufendes Ziehen
  const textPunkt = useRef(null); // Stand vor dem Tippen in ein Textfeld, für Rückgängig
  const saveTimer = useRef(null);
  const flaeche = useRef(null);
  const breite = useBreite(flaeche);
  const s = breite ? breite / B : 0.5;
  useEffect(() => { try { localStorage.setItem("advancedlan_screen_raster", String(raster)); } catch {} }, [raster]);

  // Von außen geändert (anderes Fenster, Import): übernehmen, solange hier nicht gezogen wird
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  useEffect(() => { if (!zug.current && !saveTimer.current && !gleich(gespeichert, layoutRef.current)) setLayout(gespeichert); }, [gespeichert]);

  const speichern = useCallback((neu, sofort) => {
    clearTimeout(saveTimer.current);
    const los = () => { saveTimer.current = null; mutate((d) => { d.stats = { ...d.stats, layout: neu }; }); };
    if (sofort) los(); else saveTimer.current = setTimeout(los, 250);
  }, [mutate]);
  useEffect(() => () => { if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; } }, []);

  // Änderung übernehmen: vorher = Stand für Rückgängig (null: kein neuer Schritt)
  const setzen = useCallback((neu, vorher = layoutRef.current, sofort = false) => {
    if (vorher && !gleich(vorher, neu)) { setUndo((u) => [...u.slice(-UNDO_MAX + 1), vorher]); setRedo([]); }
    setLayout(neu);
    speichern(neu, sofort);
  }, [speichern]);
  const elAendern = (id, patch, vorher) => setzen({ ...layoutRef.current, elemente: layoutRef.current.elemente.map((e) => (e.id === id ? { ...e, ...patch } : e)) }, vorher);
  const rueckgaengig = () => { if (!undo.length) return; const v = undo[undo.length - 1]; setUndo(undo.slice(0, -1)); setRedo((r) => [...r, layout]); setLayout(v); speichern(v, true); };
  const wiederholen = () => { if (!redo.length) return; const v = redo[redo.length - 1]; setRedo(redo.slice(0, -1)); setUndo((u) => [...u, layout]); setLayout(v); speichern(v, true); };

  const gewaehlt = layout.elemente.find((e) => e.id === auswahl) || null;
  const texte = layout.elemente.filter((e) => e.typ === "text").length;
  const textNeu = (over) => {
    if (texte >= MAX_TEXTE) return;
    const t = neuerText(over);
    setzen({ ...layout, elemente: [...layout.elemente, t] });
    setAuswahl(t.id);
  };
  const entfernen = (e) => {
    if (!e) return;
    if (e.typ === "text") { setzen({ ...layout, elemente: layout.elemente.filter((x) => x.id !== e.id) }); setAuswahl(null); }
    else elAendern(e.id, { sichtbar: false });
  };
  const duplizieren = (e) => e?.typ === "text" && textNeu({ ...e, id: undefined, x: Math.min(B - e.b, e.x + 30), y: Math.min(H - e.h, e.y + 30) });
  const ebene = (e, richtung) => {
    const l = layout.elemente.filter((x) => x.id !== e.id);
    setzen({ ...layout, elemente: richtung > 0 ? [...l, e] : [e, ...l] });
  };
  const zuruecksetzen = async () => {
    if (!(await uiConfirm("Layout auf den Standard zurücksetzen? Eigene Texte werden gelöscht. Mit „Rückgängig“ holst du es zurück."))) return;
    setzen(standardLayout(), layout, true); setAuswahl(null);
  };

  // Ziehen und Größe ändern
  const punkt = (ev) => { const r = flaeche.current.getBoundingClientRect(); return { x: (ev.clientX - r.left) / s, y: (ev.clientY - r.top) / s }; };
  const starten = (ev, e, kanten) => {
    if (ev.button !== 0) return;
    ev.stopPropagation(); ev.preventDefault();
    setAuswahl(e.id);
    flaeche.current.focus({ preventScroll: true });
    flaeche.current.setPointerCapture(ev.pointerId);
    zug.current = { id: e.id, kanten, start: punkt(ev), kasten: { x: e.x, y: e.y, b: e.b, h: e.h }, vorher: layout, bewegt: false };
  };
  const ziehen = (ev) => {
    const z = zug.current;
    if (!z) return;
    const p = punkt(ev), dx = p.x - z.start.x, dy = p.y - z.start.y;
    if (!z.bewegt && Math.abs(dx) * s < 2 && Math.abs(dy) * s < 2) return;
    z.bewegt = true;
    const k = { ...z.kasten };
    if (!z.kanten) { k.x += dx; k.y += dy; }
    else {
      if (z.kanten.includes("l")) { const r = k.x + k.b; k.x = Math.min(r - MIN, k.x + dx); k.b = r - k.x; }
      if (z.kanten.includes("r")) k.b = Math.max(MIN, k.b + dx);
      if (z.kanten.includes("o")) { const u = k.y + k.h; k.y = Math.min(u - MIN, k.y + dy); k.h = u - k.y; }
      if (z.kanten.includes("u")) k.h = Math.max(MIN, k.h + dy);
    }
    const andere = layoutRef.current.elemente.filter((x) => x.sichtbar && x.id !== z.id);
    const r = einrasten(k, andere, { raster: ev.altKey ? 0 : raster, abstand: ev.altKey ? 0 : 8 / s, kanten: z.kanten });
    setLinien(r.linien);
    setLayout((l) => ({ ...l, elemente: l.elemente.map((x) => (x.id === z.id ? { ...x, x: r.x, y: r.y, b: r.b, h: r.h } : x)) }));
  };
  const loslassen = () => {
    const z = zug.current;
    zug.current = null;
    setLinien([]);
    if (z?.bewegt) setzen(layoutRef.current, z.vorher, true);
  };

  const taste = (ev) => {
    if (ev.target.closest("input,textarea,select")) return;
    const strg = ev.ctrlKey || ev.metaKey;
    if (strg && ev.key.toLowerCase() === "z") { ev.preventDefault(); ev.shiftKey ? wiederholen() : rueckgaengig(); return; }
    if (strg && ev.key.toLowerCase() === "y") { ev.preventDefault(); wiederholen(); return; }
    if (!gewaehlt) return;
    if (strg && ev.key.toLowerCase() === "d") { ev.preventDefault(); duplizieren(gewaehlt); return; }
    if (ev.key === "Delete" || ev.key === "Backspace") { ev.preventDefault(); entfernen(gewaehlt); return; }
    if (ev.key === "Escape") { setAuswahl(null); return; }
    const schritt = ev.shiftKey ? 10 : 1;
    const d = { ArrowLeft: [-schritt, 0], ArrowRight: [schritt, 0], ArrowUp: [0, -schritt], ArrowDown: [0, schritt] }[ev.key];
    if (!d) return;
    ev.preventDefault();
    elAendern(gewaehlt.id, { x: Math.max(0, Math.min(B - gewaehlt.b, gewaehlt.x + d[0])), y: Math.max(0, Math.min(H - gewaehlt.h, gewaehlt.y + d[1])) });
  };

  // Vorschau: echte Daten oder Beispieldaten des aktiven Spiels
  const spiel = SPIEL_BY_ID[cfg.aktivesSpiel];
  const bsp = useMemo(() => statsBeispiel(spiel), [spiel?.id]);
  const vStatus = beispiel ? { ...status, ...bsp.regie } : status;
  const vLog = beispiel ? bsp.log : log;

  const st = status.stats || {}, ndi = st.ndi || {}, aus = !cfg.stats?.an;
  const ausgabe = aus ? "Stats-Screen ist aus (Setup)" : [st.fenster ? "Pop-out-Fenster offen" : "", cfg.stats?.ndi ? (ndi.fehler ? `NDI: ${ndi.fehler}` : ndi.laeuft ? `NDI „${ndi.name}“ sendet` : "NDI startet …") : ""].filter(Boolean).join(" · ") || "Kein Fenster offen, NDI aus";

  return (
    <>
      <Section title="Screen-Editor" subtitle="Anzeigen und Texte des Game-Stats-Screens anordnen: ziehen zum Verschieben, an den Griffen die Größe ändern. Jede Änderung wird gespeichert und gilt sofort im Pop-out-Fenster und im NDI-Stream."
        right={<div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button style={S.secondaryBtn} disabled={!undo.length} onClick={rueckgaengig} title="Rückgängig (Strg+Z)"><Undo2 size={14} /> Rückgängig</button>
          <button style={S.secondaryBtn} disabled={!redo.length} onClick={wiederholen} title="Wiederholen (Strg+Y)"><Redo2 size={14} /></button>
          <button style={S.secondaryBtn} onClick={zuruecksetzen} title="Standard-Layout"><RotateCcw size={14} /> Standard</button>
          <button style={S.primaryBtn} disabled={texte >= MAX_TEXTE} onClick={() => textNeu()}><Type size={14} /> Text hinzufügen</button>
        </div>}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontSize: 12, color: SUB, marginBottom: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Dot color={aus ? MUTED : ndi.fehler ? ERR : ndi.laeuft || st.fenster ? OK : WARN} glow={ndi.laeuft} />{ausgabe}</span>
          {aus && <button style={S.smallBtn} onClick={() => goTab("setup")}>Zum Setup</button>}
          {!aus && <button style={S.smallBtn} onClick={() => api.statsFenster(!st.fenster)}><MonitorPlay size={12} /> {st.fenster ? "Fenster schließen" : "Fenster öffnen"}</button>}
          <span style={{ flex: 1 }} />
          <Toggle checked={beispiel} onChange={setBeispiel} label={`Beispieldaten${spiel ? ` (${spiel.kurz})` : ""}`} title="Nur im Editor: Anzeigen mit einem laufenden Beispiel-Match füllen" />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>Raster
            <select style={{ ...S.selectSm, width: 90 }} value={raster} onChange={(e) => setRaster(Number(e.target.value))}>{RASTER.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>Hintergrund
            <select style={{ ...S.selectSm, width: 170 }} value={layout.hintergrund} onChange={(e) => setzen({ ...layout, hintergrund: e.target.value })}>{HINTERGRUENDE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 16, alignItems: "start" }}>
          <div>
            {/* Arbeitsfläche: Bühne skaliert, Rahmen und Griffe in Bildschirm-Pixeln darüber */}
            <div ref={flaeche} tabIndex={0} data-testid="screen-flaeche" onKeyDown={taste} onPointerMove={ziehen} onPointerUp={loslassen} onPointerCancel={loslassen}
              onPointerDown={(ev) => { if (ev.target === ev.currentTarget || ev.target.dataset.leer) setAuswahl(null); }}
              style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: 8, overflow: "hidden", border: `1px solid ${LINE}`, outline: "none", background: "#000", touchAction: "none", userSelect: "none" }}>
              <div data-leer="1" style={{ position: "absolute", left: 0, top: 0, width: B, height: H, transform: `scale(${s})`, transformOrigin: "0 0", pointerEvents: "none" }}>
                <StatsBuehne status={vStatus} cfg={{ regie: cfg }} log={vLog} layout={layout} />
              </div>
              {layout.elemente.filter((e) => e.sichtbar).map((e) => {
                const an = e.id === auswahl;
                return (
                  <div key={e.id} data-testid={`el-${e.id}`} onPointerDown={(ev) => starten(ev, e, null)} title={`${elLabel(e)} · ziehen zum Verschieben`}
                    style={{ position: "absolute", left: e.x * s, top: e.y * s, width: e.b * s, height: e.h * s, boxSizing: "border-box", cursor: "move",
                      border: an ? `2px solid ${ACCENT_HI}` : "1px dashed rgba(195,155,255,.35)", boxShadow: an ? GLOW : "none", background: an ? "rgba(157,92,255,.08)" : "transparent" }}>
                    <span style={{ position: "absolute", left: -1, top: -1, transform: e.y * s < 18 ? "none" : "translateY(-100%)", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 3, whiteSpace: "nowrap", pointerEvents: "none",
                      background: an ? ACCENT : "rgba(26,24,32,.85)", color: an ? "#fff" : SUB, opacity: an ? 1 : 0.85 }}>{elLabel(e)}</span>
                    {an && GRIFFE.map((k) => {
                      const ks = k.join("");
                      const left = k.includes("l") ? 0 : k.includes("r") ? "100%" : "50%", top = k.includes("o") ? 0 : k.includes("u") ? "100%" : "50%";
                      return <span key={ks} data-testid={`griff-${ks}`} onPointerDown={(ev) => starten(ev, e, k)}
                        style={{ position: "absolute", left, top, width: 11, height: 11, marginLeft: -6, marginTop: -6, background: "#fff", border: `2px solid ${ACCENT}`, borderRadius: 2, cursor: CURSOR[ks] || CURSOR[[...ks].reverse().join("")] }} />;
                    })}
                  </div>
                );
              })}
              {linien.map((l, i) => <div key={i} style={{ position: "absolute", pointerEvents: "none", background: "#ff4fd8", boxShadow: "0 0 4px #ff4fd8", ...(l.achse === "x" ? { left: l.pos * s, top: 0, bottom: 0, width: 1 } : { top: l.pos * s, left: 0, right: 0, height: 1 }) }} />)}
            </div>
            <div style={{ ...S.hint, display: "flex", gap: 14, flexWrap: "wrap" }}>
              <span><Move size={11} style={{ verticalAlign: -1 }} /> Ziehen: verschieben · Griffe: Größe · rastet an Kanten und Mitten ein, <b>Alt</b> gedrückt halten = frei</span>
              <span>Pfeiltasten: 1 px, mit Umschalt 10 px · Entf: ausblenden/löschen · Strg+D: Text duplizieren · Strg+Z: rückgängig</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Elemente layout={layout} auswahl={auswahl} setAuswahl={setAuswahl} sichtbar={(e, v) => elAendern(e.id, { sichtbar: v })} />
            {gewaehlt ? <Eigenschaften e={gewaehlt} aendern={(patch) => elAendern(gewaehlt.id, patch)} tippen={(patch) => {
              // Tippen: ein Rückgängig-Schritt pro Feldbesuch, nicht pro Taste
              const vorher = textPunkt.current; textPunkt.current = null;
              elAendern(gewaehlt.id, patch, vorher);
            }} fokus={() => { textPunkt.current = layoutRef.current; }}
              duplizieren={() => duplizieren(gewaehlt)} entfernen={() => entfernen(gewaehlt)} ebene={(r) => ebene(gewaehlt, r)} />
              : <div style={{ ...S.hint, marginTop: 0, border: `1px dashed ${LINE}`, borderRadius: 8, padding: 12 }}>Ein Element anklicken, um Position, Größe und Text zu bearbeiten.</div>}
          </div>
        </div>
      </Section>
    </>
  );
}

function Elemente({ layout, auswahl, setAuswahl, sichtbar }) {
  // Oberste Ebene zuerst, wie in Grafikprogrammen
  const liste = [...layout.elemente].reverse();
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, background: FELD, overflow: "hidden" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: SUB, textTransform: "uppercase", letterSpacing: 0.5, padding: "8px 10px", borderBottom: `1px solid ${LINE}` }}>Anzeigen und Texte</div>
      <div style={{ maxHeight: 290, overflow: "auto" }}>
        {liste.map((e) => {
          const an = e.id === auswahl;
          return (
            <div key={e.id} onClick={() => setAuswahl(e.id)} data-testid={`liste-${e.id}`}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer", borderBottom: `1px solid ${LINE}`, background: an ? "rgba(157,92,255,.16)" : "transparent", color: e.sichtbar ? "#ece9f2" : MUTED }}>
              <button title={e.sichtbar ? "Ausblenden" : "Einblenden"} onClick={(ev) => { ev.stopPropagation(); sichtbar(e, !e.sichtbar); }}
                style={{ background: "transparent", border: "none", color: e.sichtbar ? ACCENT_HI : MUTED, cursor: "pointer", padding: 0, display: "inline-flex" }}>{e.sichtbar ? <Eye size={14} /> : <EyeOff size={14} />}</button>
              {e.typ === "text" ? <Type size={13} color={SUB} /> : <span style={{ width: 13 }} />}
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: an ? 700 : 400 }}>{elLabel(e)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Eigenschaften({ e, aendern, tippen, fokus, duplizieren, entfernen, ebene }) {
  const ta = useRef(null);
  const text = e.typ === "text";
  const platzhalter = (k) => {
    const el = ta.current, ein = `{${k}}`;
    const a = el ? el.selectionStart : e.text.length, b = el ? el.selectionEnd : e.text.length;
    fokus();
    tippen({ text: e.text.slice(0, a) + ein + e.text.slice(b) });
    requestAnimationFrame(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = a + ein.length; } });
  };
  const ausr = [["links", AlignLeft], ["mitte", AlignCenter], ["rechts", AlignRight]];
  return (
    <div style={{ border: `1px solid ${ACCENT}`, borderRadius: 8, background: FELD, padding: 12, boxShadow: GLOW, display: "flex", flexDirection: "column", gap: 10 }} data-testid="eigenschaften">
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>{text ? <Type size={14} /> : <Cast size={14} />} {text ? "Text" : ANZEIGE[e.typ]?.label}</div>
      {text && <>
        <Field label="Text" hint="Mehrzeilig möglich. Platzhalter werden live ersetzt.">
          <textarea ref={ta} data-testid="text-eingabe" style={{ ...S.inputSm, minHeight: 72, resize: "vertical", fontFamily: "inherit" }} value={e.text} maxLength={500}
            onFocus={fokus} onChange={(ev) => tippen({ text: ev.target.value })} />
        </Field>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {PLATZHALTER.map(([k, l]) => <button key={k} title={l} style={{ ...S.smallBtn, fontSize: 10, padding: "2px 6px" }} onClick={() => platzhalter(k)}>{`{${k}}`}</button>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Zahl label="Schriftgröße" wert={e.groesse} min={10} max={400} onChange={(v) => aendern({ groesse: Math.max(10, Math.min(400, v)) })} />
          <Field label="Ausrichtung">
            <div style={{ display: "flex", gap: 3 }}>{ausr.map(([k, Ic]) => (
              <button key={k} title={k} onClick={() => aendern({ ausrichtung: k })} style={{ ...S.smallBtn, flex: 1, padding: "5px 0", ...(e.ausrichtung === k ? { background: ACCENT, borderColor: ACCENT } : {}) }}><Ic size={13} /></button>
            ))}</div>
          </Field>
        </div>
        <Field label="Farbe">
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            {FARBEN.map((f) => <button key={f} title={f} onClick={() => aendern({ farbe: f })} style={{ width: 20, height: 20, borderRadius: 4, background: f, border: e.farbe === f ? "2px solid #fff" : `1px solid ${LINE}`, cursor: "pointer", padding: 0 }} />)}
            <input type="color" value={e.farbe} onChange={(ev) => aendern({ farbe: ev.target.value })} style={{ width: 28, height: 22, border: "none", background: "transparent", padding: 0, cursor: "pointer" }} />
          </div>
        </Field>
        <div style={{ display: "flex", gap: 14 }}>
          <Toggle checked={e.fett} onChange={(v) => aendern({ fett: v })} label="Fett" />
          <Toggle checked={e.panel} onChange={(v) => aendern({ panel: v })} label="Mit Hintergrund-Kachel" />
        </div>
      </>}
      {!text && "titel" in e && (
        <Field label="Überschrift" hint="Leer lassen für keine Überschrift. Platzhalter wie {spiel} gehen auch.">
          <input style={S.inputSm} value={e.titel} maxLength={80} onFocus={fokus} onChange={(ev) => tippen({ titel: ev.target.value })} />
        </Field>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Zahl label="X" wert={e.x} max={B - e.b} onChange={(v) => aendern({ x: Math.max(0, Math.min(B - e.b, v)) })} />
        <Zahl label="Y" wert={e.y} max={H - e.h} onChange={(v) => aendern({ y: Math.max(0, Math.min(H - e.h, v)) })} />
        <Zahl label="Breite" wert={e.b} min={MIN} max={B} onChange={(v) => { const b = Math.max(MIN, Math.min(B, v)); aendern({ b, x: Math.min(e.x, B - b) }); }} />
        <Zahl label="Höhe" wert={e.h} min={MIN} max={H} onChange={(v) => { const h = Math.max(MIN, Math.min(H, v)); aendern({ h, y: Math.min(e.y, H - h) }); }} />
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        <button style={S.smallBtn} onClick={() => ebene(1)} title="Vor alle anderen"><ArrowUpToLine size={12} /> Nach vorne</button>
        <button style={S.smallBtn} onClick={() => ebene(-1)} title="Hinter alle anderen"><ArrowDownToLine size={12} /> Nach hinten</button>
        {text && <button style={S.smallBtn} onClick={duplizieren}><Copy size={12} /> Duplizieren</button>}
        <span style={{ flex: 1 }} />
        {text ? <button style={S.dangerBtn} onClick={entfernen}><Trash2 size={12} /> Löschen</button>
          : <button style={S.smallBtn} onClick={entfernen}><EyeOff size={12} /> Ausblenden</button>}
      </div>
    </div>
  );
}
