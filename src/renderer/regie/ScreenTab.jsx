import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { S, ACCENT, ACCENT_HI, LINE, SUB, MUTED, WARN, FELD, GLOW } from "../theme.js";
import { Section, Field, Toggle } from "../ui.jsx";
import { uiConfirm } from "../dialog.jsx";
import { StatsBuehne } from "../StatsScreen.jsx";
import StatsAusgabe from "./StatsAusgabe.jsx";
import { SPIEL_BY_ID } from "../../core/spiele.js";
import { B, H, MIN, MAX_TEXTE, MAX_BILDER, ZOOM_MIN, ZOOM_MAX, ANZEIGE, HINTERGRUENDE, PASSUNGEN, PLATZHALTER, standardLayout, migrateLayout, neuerText, neuesBild, einrasten, bilderAufraeumen, neueId, inhaltsSkala } from "../../core/stats-layout.js";
import { statsBeispiel } from "../../core/stats-beispiel.js";
import HintergrundEditor, { Regler } from "./HintergrundEditor.jsx";
import { bildWaehlen, bildVorbereiten } from "./bild-laden.js";
import { Type, Eye, EyeOff, Undo2, Redo2, RotateCcw, Copy, Trash2, ArrowUpToLine, ArrowDownToLine, AlignLeft, AlignCenter, AlignRight, Cast, Move, ImagePlus, Image as ImageIcon, Scaling } from "lucide-react";

// Editor des Game-Stats-Screens: Anzeigen und Texte per Drag and Drop auf der 1920×1080-Fläche anordnen,
// Größe an den Griffen ändern, Texte schreiben. Gespeichert in cfg.regie.stats.layout; Pop-out-Fenster und NDI zeigen es sofort.
const RASTER = [[0, "Aus"], [10, "10 px"], [20, "20 px"], [40, "40 px"]];
const GRIFFE = [["o", "l"], ["o"], ["o", "r"], ["r"], ["u", "r"], ["u"], ["u", "l"], ["l"]];
const CURSOR = { o: "ns-resize", u: "ns-resize", l: "ew-resize", r: "ew-resize", ol: "nwse-resize", ur: "nwse-resize", or: "nesw-resize", ul: "nesw-resize" };
const FARBEN = ["#ffffff", "#c39bff", "#9d5cff", "#2ecc71", "#f2b33d", "#ff5d5d", "#4ea1ff", "#a39eb3"];
const UNDO_MAX = 60;

const elLabel = (e) => (e.typ === "text" ? (e.text || "").split("\n")[0].slice(0, 28) || "Leerer Text" : e.typ === "bild" ? e.name || "Bild" : ANZEIGE[e.typ]?.label || e.typ);
const eigen = (e) => e?.typ === "text" || e?.typ === "bild"; // eigene Blöcke: löschen statt ausblenden
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

export default function ScreenTab({ cfg, mutate, status, log }) {
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
    neu = bilderAufraeumen(neu);
    if (vorher && !gleich(vorher, neu)) { setUndo((u) => [...u.slice(-UNDO_MAX + 1), vorher]); setRedo([]); }
    setLayout(neu);
    speichern(neu, sofort);
  }, [speichern]);
  // Fortlaufende Änderung (Regler, Farbwähler, Tippen): ein Rückgängig-Schritt ab dem letzten fokus()
  const fokus = () => { textPunkt.current = layoutRef.current; };
  const punktNehmen = (vorher) => { if (vorher !== null) return vorher; const v = textPunkt.current; textPunkt.current = null; return v; };
  const hgAendern = (patch, vorher) => setzen({ ...layoutRef.current, hg: { ...layoutRef.current.hg, ...patch } }, punktNehmen(vorher));
  const elAendern = (id, patch, vorher) => setzen({ ...layoutRef.current, elemente: layoutRef.current.elemente.map((e) => (e.id === id ? { ...e, ...patch } : e)) }, vorher);
  const rueckgaengig = () => { if (!undo.length) return; const v = undo[undo.length - 1]; setUndo(undo.slice(0, -1)); setRedo((r) => [...r, layout]); setLayout(v); speichern(v, true); };
  const wiederholen = () => { if (!redo.length) return; const v = redo[redo.length - 1]; setRedo(redo.slice(0, -1)); setUndo((u) => [...u, layout]); setLayout(v); speichern(v, true); };

  const gewaehlt = layout.elemente.find((e) => e.id === auswahl) || null;
  const texte = layout.elemente.filter((e) => e.typ === "text").length;
  const bildBloecke = layout.elemente.filter((e) => e.typ === "bild").length;
  const [bildFehler, setBildFehler] = useState("");
  // Bild laden (verkleinert) → { id, url, b, h } oder null
  const bildLaden = async (file) => {
    setBildFehler("");
    if (!file) return null;
    try { const r = await bildVorbereiten(file); return { id: neueId("b"), ...r }; }
    catch (err) { setBildFehler(`${file.name || "Bild"}: ${err.message}`); return null; }
  };
  const bildNeu = async (file, mitte) => {
    if (bildBloecke >= MAX_BILDER) return;
    const f = file || (await bildWaehlen());
    const r = await bildLaden(f);
    if (!r) return;
    const l = layoutRef.current;
    const el = neuesBild(r.id, { b0: r.b, h0: r.h, name: (f?.name || "").replace(/\.[^.]+$/, "").slice(0, 60) || undefined });
    if (mitte) { el.x = Math.round(Math.max(0, Math.min(B - el.b, mitte.x - el.b / 2))); el.y = Math.round(Math.max(0, Math.min(H - el.h, mitte.y - el.h / 2))); }
    if (!el.name) delete el.name;
    setzen({ ...l, bilder: { ...l.bilder, [r.id]: r.url }, elemente: [...l.elemente, el] }, l, true);
    setAuswahl(el.id);
  };
  const bildErsetzen = async (e) => {
    const r = await bildLaden(await bildWaehlen());
    if (!r) return;
    const l = layoutRef.current;
    setzen({ ...l, bilder: { ...l.bilder, [r.id]: r.url }, elemente: l.elemente.map((x) => (x.id === e.id ? { ...x, bild: r.id } : x)) }, l, true);
  };
  const hgBild = async () => {
    const r = await bildLaden(await bildWaehlen());
    if (!r) return;
    const l = layoutRef.current;
    setzen({ ...l, hintergrund: "bild", bilder: { ...l.bilder, [r.id]: r.url }, hg: { ...l.hg, bild: r.id } }, l, true);
  };
  const hgArt = (k) => {
    if (k === "bild" && !layout.hg.bild) { hgBild(); return; }
    setzen({ ...layout, hintergrund: k });
  };
  // Seitenverhältnis des Bildes wiederherstellen (Breite bleibt)
  const originalFormat = (e) => {
    const img = new Image();
    img.onload = () => { const h = Math.max(MIN, Math.min(H, Math.round(e.b * img.naturalHeight / img.naturalWidth))); elAendern(e.id, { h, y: Math.min(e.y, H - h) }); };
    img.src = layout.bilder[e.bild];
  };
  const textNeu = (over) => {
    if (texte >= MAX_TEXTE) return;
    const t = neuerText(over);
    setzen({ ...layout, elemente: [...layout.elemente, t] });
    setAuswahl(t.id);
  };
  const entfernen = (e) => {
    if (!e) return;
    if (eigen(e)) { setzen({ ...layout, elemente: layout.elemente.filter((x) => x.id !== e.id) }); setAuswahl(null); }
    else elAendern(e.id, { sichtbar: false });
  };
  const duplizieren = (e) => {
    const pos = { x: Math.min(B - e.b, e.x + 30), y: Math.min(H - e.h, e.y + 30) };
    if (e?.typ === "text") textNeu({ ...e, id: undefined, ...pos });
    if (e?.typ === "bild" && bildBloecke < MAX_BILDER) { const n = { ...e, ...pos, id: neueId("i") }; setzen({ ...layout, elemente: [...layout.elemente, n] }); setAuswahl(n.id); }
  };
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
    zug.current = { id: e.id, kanten, start: punkt(ev), kasten: { x: e.x, y: e.y, b: e.b, h: e.h }, vorher: layout, bewegt: false, groesse: e.groesse, typ: e.typ, skalieren: e.skalieren };
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
    const ecke = z.kanten?.length === 2;
    // Bilder behalten an den Ecken ihr Seitenverhältnis (Umschalt: frei)
    const seitenFest = ecke && z.typ === "bild" && !ev.shiftKey;
    if (seitenFest) {
      const v = z.kasten.b / z.kasten.h;
      const f = Math.max(MIN / Math.min(z.kasten.b, z.kasten.h), Math.min(B / z.kasten.b, H / z.kasten.h, Math.max(k.b / z.kasten.b, k.h / z.kasten.h)));
      const nb = z.kasten.b * f, nh = nb / v;
      if (z.kanten.includes("l")) k.x = z.kasten.x + z.kasten.b - nb;
      if (z.kanten.includes("o")) k.y = z.kasten.y + z.kasten.h - nh;
      k.b = nb; k.h = nh;
    }
    const andere = layoutRef.current.elemente.filter((x) => x.sichtbar && x.id !== z.id);
    const frei = ev.altKey || seitenFest;
    const r = einrasten(k, andere, { raster: frei ? 0 : raster, abstand: frei ? 0 : 8 / s, kanten: z.kanten });
    setLinien(r.linien);
    // Texte: an den Ecken wächst die Schrift mit dem Block
    const extra = ecke && z.typ === "text" && z.skalieren !== false ? { groesse: Math.max(10, Math.min(400, Math.round(z.groesse * Math.min(r.b / z.kasten.b, r.h / z.kasten.h)))) } : {};
    setLayout((l) => ({ ...l, elemente: l.elemente.map((x) => (x.id === z.id ? { ...x, x: r.x, y: r.y, b: r.b, h: r.h, ...extra } : x)) }));
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


  return (
    <>
      <Section title="Screen-Editor" subtitle="Anzeigen und Texte des Game-Stats-Screens anordnen: ziehen zum Verschieben, an den Griffen die Größe ändern. Jede Änderung wird gespeichert und gilt sofort im Pop-out-Fenster und im NDI-Stream."
        right={<div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button style={S.secondaryBtn} disabled={!undo.length} onClick={rueckgaengig} title="Rückgängig (Strg+Z)"><Undo2 size={14} /> Rückgängig</button>
          <button style={S.secondaryBtn} disabled={!redo.length} onClick={wiederholen} title="Wiederholen (Strg+Y)"><Redo2 size={14} /></button>
          <button style={S.secondaryBtn} onClick={zuruecksetzen} title="Standard-Layout"><RotateCcw size={14} /> Standard</button>
          <button style={S.secondaryBtn} disabled={bildBloecke >= MAX_BILDER} onClick={() => bildNeu()} title={`Bild als eigenen Block (höchstens ${MAX_BILDER}), auch per Drag and Drop auf die Fläche`}><ImagePlus size={14} /> Bild hinzufügen</button>
          <button style={S.primaryBtn} disabled={texte >= MAX_TEXTE} onClick={() => textNeu()}><Type size={14} /> Text hinzufügen</button>
        </div>}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontSize: 12, color: SUB, marginBottom: 10 }}>
          {!cfg.stats?.an && <span style={{ color: WARN }}>Stats-Screen ist aus: unten unter „Ausgabe“ einschalten</span>}
          {bildFehler && <span style={{ color: WARN }} data-testid="bild-fehler">{bildFehler}</span>}
          <span style={{ flex: 1 }} />
          <Toggle checked={beispiel} onChange={setBeispiel} label={`Beispieldaten${spiel ? ` (${spiel.kurz})` : ""}`} title="Nur im Editor: Anzeigen mit einem laufenden Beispiel-Match füllen" />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>Raster
            <select style={{ ...S.selectSm, width: 90 }} value={raster} onChange={(e) => setRaster(Number(e.target.value))}>{RASTER.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>Hintergrund
            <select style={{ ...S.selectSm, width: 170 }} value={layout.hintergrund} onChange={(e) => { hgArt(e.target.value); setAuswahl(null); }}>{HINTERGRUENDE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 16, alignItems: "start" }}>
          <div>
            {/* Arbeitsfläche: Bühne skaliert, Rahmen und Griffe in Bildschirm-Pixeln darüber */}
            <div ref={flaeche} tabIndex={0} data-testid="screen-flaeche" onKeyDown={taste} onPointerMove={ziehen} onPointerUp={loslassen} onPointerCancel={loslassen}
              onDragOver={(ev) => { if ([...(ev.dataTransfer?.items || [])].some((i) => i.kind === "file")) ev.preventDefault(); }}
              onDrop={(ev) => { const f = [...(ev.dataTransfer?.files || [])].find((x) => /^image\//.test(x.type)); if (!f) return; ev.preventDefault(); bildNeu(f, punkt(ev)); }}
              onPointerDown={(ev) => { if (ev.target === ev.currentTarget || ev.target.dataset.leer) setAuswahl(null); }}
              style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: 8, overflow: "hidden", border: `1px solid ${LINE}`, outline: "none", background: "#000", touchAction: "none", userSelect: "none" }}>
              <div data-leer="1" style={{ position: "absolute", left: 0, top: 0, width: B, height: H, transform: `scale(${s})`, transformOrigin: "0 0", pointerEvents: "none" }}>
                <StatsBuehne status={vStatus} cfg={{ regie: cfg }} log={vLog} layout={layout} />
              </div>
              {layout.elemente.filter((e) => e.sichtbar).map((e) => {
                const an = e.id === auswahl;
                return (
                  <div key={e.id} data-testid={`el-${e.id}`} onPointerDown={(ev) => starten(ev, e, null)} title={`${elLabel(e)} · ziehen zum Verschieben`}
                    style={{ position: "absolute", left: e.x * s, top: e.y * s, width: e.b * s, height: e.h * s, boxSizing: "border-box", cursor: "move", zIndex: an ? 2 : 1,
                      border: an ? `2px solid ${ACCENT_HI}` : "1px dashed rgba(195,155,255,.35)", boxShadow: an ? GLOW : "none", background: an ? "rgba(157,92,255,.08)" : "transparent" }}>
                    <span style={{ position: "absolute", left: -1, top: -1, transform: e.y * s < 18 ? "none" : "translateY(-100%)", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 3, whiteSpace: "nowrap", pointerEvents: "none",
                      background: an ? ACCENT : "rgba(26,24,32,.85)", color: an ? "#fff" : SUB, opacity: an ? 1 : 0.85 }}>{elLabel(e)}{an && ANZEIGE[e.typ] && Math.abs(inhaltsSkala(e).f - 1) > 0.005 ? ` · ${Math.round(inhaltsSkala(e).f * 100)} %` : ""}</span>
                    {an && GRIFFE.map((k) => {
                      const ks = k.join("");
                      const left = k.includes("l") ? 0 : k.includes("r") ? "100%" : "50%", top = k.includes("o") ? 0 : k.includes("u") ? "100%" : "50%";
                      return <span key={ks} data-testid={`griff-${ks}`} onPointerDown={(ev) => starten(ev, e, k)}
                        style={{ position: "absolute", left, top, width: 11, height: 11, marginLeft: -6, marginTop: -6, background: "#fff", border: `2px solid ${ACCENT}`, borderRadius: 2, cursor: CURSOR[ks] || CURSOR[[...ks].reverse().join("")] }} />;
                    })}
                  </div>
                );
              })}
              {linien.map((l, i) => <div key={i} style={{ position: "absolute", pointerEvents: "none", zIndex: 3, background: "#ff4fd8", boxShadow: "0 0 4px #ff4fd8", ...(l.achse === "x" ? { left: l.pos * s, top: 0, bottom: 0, width: 1 } : { top: l.pos * s, left: 0, right: 0, height: 1 }) }} />)}
            </div>
            <div style={{ ...S.hint, display: "flex", gap: 14, flexWrap: "wrap" }}>
              <span><Move size={11} style={{ verticalAlign: -1 }} /> Ziehen: verschieben · Griffe: Größe · rastet an Kanten und Mitten ein, <b>Alt</b> gedrückt halten = frei</span>
              <span>Inhalt skaliert mit der Blockgröße · Bilder halten an den Ecken ihr Format, <b>Umschalt</b> = frei · Bilder per Drag and Drop auf die Fläche</span>
              <span>Pfeiltasten: 1 px, mit Umschalt 10 px · Entf: ausblenden/löschen · Strg+D: duplizieren · Strg+Z: rückgängig</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Elemente layout={layout} auswahl={auswahl} setAuswahl={setAuswahl} sichtbar={(e, v) => elAendern(e.id, { sichtbar: v })} />
            {gewaehlt ? <Eigenschaften e={gewaehlt} bilder={layout.bilder} aendern={(patch) => elAendern(gewaehlt.id, patch)} tippen={(patch) => {
              // Tippen: ein Rückgängig-Schritt pro Feldbesuch, nicht pro Taste
              elAendern(gewaehlt.id, patch, punktNehmen(null));
            }} fokus={fokus} bildErsetzen={() => bildErsetzen(gewaehlt)} originalFormat={() => originalFormat(gewaehlt)}
              duplizieren={() => duplizieren(gewaehlt)} entfernen={() => entfernen(gewaehlt)} ebene={(r) => ebene(gewaehlt, r)} />
              : <>
                <div style={{ ...S.hint, marginTop: 0, border: `1px dashed ${LINE}`, borderRadius: 8, padding: 10 }}>Ein Element anklicken, um Position, Größe und Inhalt zu bearbeiten. Ohne Auswahl: Hintergrund.</div>
                <HintergrundEditor layout={layout} setArt={hgArt} aendern={hgAendern} fokus={fokus} bildSetzen={hgBild} />
              </>}
          </div>
        </div>
      </Section>
      <StatsAusgabe cfg={cfg} mutate={mutate} status={status} />
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
              {e.typ === "text" ? <Type size={13} color={SUB} /> : e.typ === "bild" ? <ImageIcon size={13} color={SUB} /> : <span style={{ width: 13 }} />}
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: an ? 700 : 400 }}>{elLabel(e)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Eigenschaften({ e, bilder, aendern, tippen, fokus, duplizieren, entfernen, ebene, bildErsetzen, originalFormat }) {
  const ta = useRef(null);
  const text = e.typ === "text", bild = e.typ === "bild", anzeige = !!ANZEIGE[e.typ];
  const skala = inhaltsSkala(e);
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
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>{text ? <Type size={14} /> : bild ? <ImageIcon size={14} /> : <Cast size={14} />} {text ? "Text" : bild ? "Bild" : ANZEIGE[e.typ]?.label}</div>
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
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Toggle checked={e.fett} onChange={(v) => aendern({ fett: v })} label="Fett" />
          <Toggle checked={e.panel} onChange={(v) => aendern({ panel: v })} label="Mit Hintergrund-Kachel" />
          <Toggle checked={e.skalieren !== false} onChange={(v) => aendern({ skalieren: v })} label="Schrift wächst mit dem Block" title="An den Ecken ziehen ändert die Schriftgröße mit" />
        </div>
      </>}
      {bild && <>
        {bilder?.[e.bild] && <img src={bilder[e.bild]} alt="" style={{ width: "100%", maxHeight: 120, objectFit: "contain", borderRadius: 6, border: `1px solid ${LINE}`, background: "repeating-conic-gradient(#3a3647 0% 25%, #23212c 0% 50%) 0 0 / 12px 12px" }} />}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <button style={S.smallBtn} onClick={bildErsetzen}><ImagePlus size={12} /> Bild ersetzen</button>
          <button style={S.smallBtn} onClick={originalFormat} title="Höhe an das Seitenverhältnis des Bildes anpassen"><Scaling size={12} /> Originalformat</button>
        </div>
        <Field label="Darstellung im Block">
          <select style={S.selectSm} value={e.passung} onChange={(ev) => aendern({ passung: ev.target.value })}>{PASSUNGEN.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <Regler label="Deckkraft" wert={e.deckkraft} einheit="%" fokus={fokus} onChange={(v) => tippen({ deckkraft: v })} />
        <Regler label="Ecken abrunden" wert={e.radius} max={200} einheit=" px" fokus={fokus} onChange={(v) => tippen({ radius: v })} />
        <Toggle checked={e.panel} onChange={(v) => aendern({ panel: v })} label="Mit Hintergrund-Kachel" />
      </>}
      {anzeige && <>
        <Toggle checked={e.skalieren !== false} onChange={(v) => aendern({ skalieren: v })} label="Inhalt skaliert mit der Blockgröße" title="Schrift, Logos und Tabellen wachsen oder schrumpfen mit dem Block" />
        <Regler label={`Zoom (Inhalt ${Math.round(skala.f * 100)} %)`} wert={e.zoom ?? 100} min={ZOOM_MIN} max={ZOOM_MAX} einheit="%" fokus={fokus} onChange={(v) => tippen({ zoom: v })} testid="zoom" />
        {(e.zoom ?? 100) !== 100 && <button style={{ ...S.smallBtn, alignSelf: "flex-start" }} onClick={() => aendern({ zoom: 100 })}>Zoom auf 100 %</button>}
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
        {eigen(e) && <button style={S.smallBtn} onClick={duplizieren}><Copy size={12} /> Duplizieren</button>}
        <span style={{ flex: 1 }} />
        {eigen(e) ? <button style={S.dangerBtn} onClick={entfernen}><Trash2 size={12} /> Löschen</button>
          : <button style={S.smallBtn} onClick={entfernen}><EyeOff size={12} /> Ausblenden</button>}
      </div>
    </div>
  );
}
