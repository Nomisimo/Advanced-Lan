import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { S, ACCENT, ACCENT_HI, LINE, SUB, MUTED, WARN, FELD, GLOW } from "../theme.js";
import { Section, Field, Toggle } from "../ui.jsx";
import { uiConfirm } from "../dialog.jsx";
import { StatsBuehne } from "../StatsScreen.jsx";
import StatsAusgabe from "./StatsAusgabe.jsx";
import ScreenLeiste from "./ScreenLeiste.jsx";
import { screenVon } from "../../core/stats-screens.js";
import { SPIEL_BY_ID } from "../../core/spiele.js";
import { WERTE } from "../../core/stats-screen.js";
import { MIN, MAX_TEXTE, MAX_BILDER, MAX_SPIELER, MAX_WERTE, SPIELER_OPTIONEN, neuerSpieler, neuerWert, ZOOM_MIN, ZOOM_MAX, OPTIONEN, OPTION_TEXT_MAX, ANZEIGE, ANZEIGEN, HINTERGRUENDE, PASSUNGEN, elementVerlauf, MAX_KOPIEN, neueAnzeige, TEAM_TYPEN, TEAM_OPTIONEN, BENENNUNGEN, PLATZHALTER, standardLayout, migrateLayout, neuerText, neuesBild, einrasten, bilderAufraeumen, neueId, inhaltsSkala } from "../../core/stats-layout.js";
import { statsBeispiel } from "../../core/stats-beispiel.js";
import HintergrundEditor, { Regler, durchscheinend, VerlaufLage, VerlaufEditor } from "./HintergrundEditor.jsx";
import { bildWaehlen, bildVorbereiten } from "./bild-laden.js";
import { Type, UserSquare, Hash, Eye, EyeOff, Undo2, Redo2, RotateCcw, Copy, Trash2, ArrowUpToLine, ArrowDownToLine, AlignLeft, AlignCenter, AlignRight, Cast, Move, ImagePlus, Image as ImageIcon, Scaling } from "lucide-react";

// Editor der Game-Stats-Screens: mehrere Screens, jeder mit eigener Größe in Pixeln (Standard 1920×1080) und eigener NDI-Quelle.
// Anzeigen und Texte per Drag and Drop auf der Fläche anordnen, Größe an den Griffen ändern, Texte schreiben.
// Gespeichert in cfg.regie.stats.screens[].layout; Pop-out-Fenster und NDI des Screens zeigen es sofort.
const RASTER = [[0, "Aus"], [10, "10 px"], [20, "20 px"], [40, "40 px"]];
const GRIFFE = [["o", "l"], ["o"], ["o", "r"], ["r"], ["u", "r"], ["u"], ["u", "l"], ["l"]];
const CURSOR = { o: "ns-resize", u: "ns-resize", l: "ew-resize", r: "ew-resize", ol: "nwse-resize", ur: "nwse-resize", or: "nesw-resize", ul: "nesw-resize" };
const FARBEN = ["#ffffff", "#c39bff", "#9d5cff", "#2ecc71", "#f2b33d", "#ff5d5d", "#4ea1ff", "#a39eb3"];
const UNDO_MAX = 60;
const MAX_HOEHE = 620; // höchste Höhe der Arbeitsfläche in Bildschirm-Pixeln (Hochkant-Screens)
const MAX_ZOOM = 4; // kleine Screens werden höchstens vierfach vergrößert gezeigt
const KARO = "repeating-conic-gradient(#3a3647 0% 25%, #23212c 0% 50%) 0 0 / 16px 16px"; // durchsichtiger Hintergrund

const quelleText = (e) => (e.quelle && e.quelle !== "rang" ? e.quelle : `Platz ${e.rang || 1}`);
const WERT_LABEL = Object.fromEntries(WERTE.map(([k, l]) => [k, l]));
const elLabel = (e) => (e.typ === "text" ? (e.text || "").split("\n")[0].slice(0, 28) || "Leerer Text" : e.typ === "bild" ? e.name || "Bild"
  : e.typ === "spieler" ? `Spieler: ${quelleText(e)}` : e.typ === "wert" ? `Wert: ${WERT_LABEL[e.wert] || e.wert}${String(e.wert).startsWith("sp.") ? ` (${quelleText(e)})` : ""}` : ANZEIGE[e.typ]?.label || e.typ);
const EIGEN = new Set(["text", "bild", "spieler", "wert"]);
// eigene Blöcke und hinzugefügte Anzeigen (ID ≠ Typ): löschen statt ausblenden
const kopie = (e) => !!(ANZEIGE[e?.typ] && e.id !== e.typ);
const eigen = (e) => EIGEN.has(e?.typ) || kopie(e);
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

export default function ScreenTab({ cfg, mutate, status, log, notify }) {
  const screen = screenVon(cfg.stats, cfg.stats?.aktiv);
  return (
    <>
      <Section title="Screen-Editor" subtitle="Mehrere Game-Stats-Screens, jeder mit eigener Größe in Pixeln und eigener NDI-Quelle. Anzeigen und Texte anordnen: ziehen zum Verschieben, an den Griffen die Größe ändern. Jede Änderung wird gespeichert und gilt sofort im Pop-out-Fenster und im NDI-Stream des Screens.">
        {screen && <ScreenLeiste cfg={cfg} mutate={mutate} status={status} screen={screen} />}
        {/* Eigener Editor je Screen: Rückgängig, Auswahl und Ziehen gelten nur für diesen Screen */}
        {screen && <Editor key={screen.id} cfg={cfg} mutate={mutate} status={status} log={log} screen={screen} />}
      </Section>
      <StatsAusgabe cfg={cfg} mutate={mutate} status={status} />
    </>
  );
}

// Auch auf dem Stats-Screen-PC für die eigenen Screens (cfg = { stats, aktivesSpiel })
export function Editor({ cfg, mutate, status, log, screen }) {
  const F = useMemo(() => ({ b: screen.b, h: screen.h }), [screen.b, screen.h]);
  const B = F.b, H = F.h;
  const gespeichert = useMemo(() => migrateLayout(screen.layout, F), [screen.layout, F]);
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
  const ausstehend = useRef(null); // Speichern, das noch auf den Timer wartet
  const flaeche = useRef(null);
  const rahmen = useRef(null);
  const breite = useBreite(rahmen);
  // Maßstab der Arbeitsfläche: volle Breite, aber nicht zu hoch (Hochkant) und kleine Screens nicht riesig
  const s = breite ? Math.min(breite / B, MAX_HOEHE / H, MAX_ZOOM) : 0.5;
  useEffect(() => { try { localStorage.setItem("advancedlan_screen_raster", String(raster)); } catch {} }, [raster]);

  // Von außen geändert (anderes Fenster, Import): übernehmen, solange hier nicht gezogen wird
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  useEffect(() => { if (!zug.current && !saveTimer.current && !gleich(gespeichert, layoutRef.current)) setLayout(gespeichert); }, [gespeichert]);

  const speichern = useCallback((neu, sofort) => {
    clearTimeout(saveTimer.current);
    const id = screen.id;
    const los = () => { saveTimer.current = null; ausstehend.current = null; mutate((d) => { d.stats = { ...d.stats, screens: d.stats.screens.map((x) => (x.id === id ? { ...x, layout: neu } : x)) }; }); };
    ausstehend.current = los;
    if (sofort) los(); else saveTimer.current = setTimeout(los, 250);
  }, [mutate, screen.id]);
  // Beim Wechsel des Screens: ausstehende Änderung noch speichern
  useEffect(() => () => { if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; ausstehend.current?.(); } }, []);

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
  const karten = layout.elemente.filter((e) => e.typ === "spieler").length;
  const wertBloecke = layout.elemente.filter((e) => e.typ === "wert").length;
  // Neuer Block (Spieler-Karte oder Wert)
  const kopien = layout.elemente.filter(kopie).length;
  const blockNeu = (el) => { setzen({ ...layoutRef.current, elemente: [...layoutRef.current.elemente, el] }); setAuswahl(el.id); };
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
    const el = neuesBild(r.id, { b0: r.b, h0: r.h, flaeche: F, name: (f?.name || "").replace(/\.[^.]+$/, "").slice(0, 60) || undefined });
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
  // Bild als Hintergrund; mitVerlauf: der eigene Verlauf liegt darüber
  const hgBild = async (mitVerlauf) => {
    const r = await bildLaden(await bildWaehlen());
    if (!r) return;
    const l = layoutRef.current;
    const hg = { ...l.hg, bild: r.id, ...(mitVerlauf === true ? { verlaufLage: "vor", verlauf: durchscheinend(l.hg.verlauf) } : {}) };
    setzen({ ...l, hintergrund: "bild", bilder: { ...l.bilder, [r.id]: r.url }, hg }, l, true);
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
    const t = neuerText(over, F);
    setzen({ ...layout, elemente: [...layout.elemente, t] });
    setAuswahl(t.id);
  };
  // Darstellung eines Elements auf alle übertragen (Schrift- und Akzentfarbe nur auf Anzeigen)
  const stilAlle = (q) => {
    const st = { deckkraft: q.deckkraft ?? 100, kachel: q.kachel ?? 92, ecken: q.ecken ?? 18, rahmen: q.rahmen !== false, verlaufLage: q.verlaufLage || "aus", ...(q.verlauf ? { verlauf: JSON.parse(JSON.stringify(q.verlauf)) } : {}) };
    const farben = ANZEIGE[q.typ] ? { schrift: q.schrift || "", akzent: q.akzent || "" } : {};
    setzen({ ...layout, elemente: layout.elemente.map((x) => ({ ...x, ...st, ...(ANZEIGE[x.typ] ? farben : {}) })) });
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
    // Spieler-Karte: gleich der nächste Platz
    if (e?.typ === "spieler" && karten < MAX_SPIELER) blockNeu({ ...e, ...pos, id: neueId("p"), ...(e.quelle === "rang" ? { rang: Math.min(20, (e.rang || 1) + 1) } : {}) });
    if (e?.typ === "wert" && wertBloecke < MAX_WERTE) blockNeu({ ...e, ...pos, id: neueId("w") });
    // Anzeigen: als weiteres Element mit denselben Einstellungen
    if (ANZEIGE[e?.typ] && kopien < MAX_KOPIEN) blockNeu({ ...JSON.parse(JSON.stringify(e)), ...pos, sichtbar: true, id: neueId("a") });
  };
  const ebene = (e, richtung) => {
    const l = layout.elemente.filter((x) => x.id !== e.id);
    setzen({ ...layout, elemente: richtung > 0 ? [...l, e] : [e, ...l] });
  };
  const zuruecksetzen = async () => {
    if (!(await uiConfirm("Layout auf den Standard zurücksetzen? Eigene Texte werden gelöscht. Mit „Rückgängig“ holst du es zurück."))) return;
    setzen(standardLayout(F), layout, true); setAuswahl(null);
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
    const r = einrasten(k, andere, { raster: frei ? 0 : raster, abstand: frei ? 0 : 8 / s, kanten: z.kanten, flaeche: F });
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
  // PCs zur Auswahl für Spieler-Karten und Spielerwerte: verbundene PCs der Session (mit Spielername), dazu die der Beispieldaten
  const pcListe = useMemo(() => {
    const m = new Map();
    for (const st of [status, beispiel ? bsp.regie : null]) for (const p of st?.pcs || []) if (!p.sim && !m.has(p.pcId)) m.set(p.pcId, st.namen?.[p.pcId] || p.spieler || "");
    return [...m].map(([pcId, name]) => ({ pcId, name }));
  }, [status?.pcs, status?.namen, beispiel, bsp]);


  return (
    <>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", marginBottom: 10 }}>
          <button style={S.secondaryBtn} disabled={!undo.length} onClick={rueckgaengig} title="Rückgängig (Strg+Z)"><Undo2 size={14} /> Rückgängig</button>
          <button style={S.secondaryBtn} disabled={!redo.length} onClick={wiederholen} title="Wiederholen (Strg+Y)"><Redo2 size={14} /></button>
          <button style={S.secondaryBtn} onClick={zuruecksetzen} title="Standard-Layout"><RotateCcw size={14} /> Standard</button>
          <button style={S.secondaryBtn} disabled={bildBloecke >= MAX_BILDER} onClick={() => bildNeu()} title={`Bild als eigenen Block (höchstens ${MAX_BILDER}), auch per Drag and Drop auf die Fläche`}><ImagePlus size={14} /> Bild hinzufügen</button>
          <button style={S.secondaryBtn} disabled={karten >= MAX_SPIELER} onClick={() => blockNeu(neuerSpieler({ rang: karten + 1 }, F))} title={`Name, Team und Zahlen eines Spielers (höchstens ${MAX_SPIELER})`} data-testid="spieler-neu"><UserSquare size={14} /> Spieler-Karte</button>
          <button style={S.secondaryBtn} disabled={wertBloecke >= MAX_WERTE} onClick={() => blockNeu(neuerWert({}, F))} title={`Eine Zahl oder ein Name groß, z. B. Punkte, Runde oder Kills eines Spielers (höchstens ${MAX_WERTE})`} data-testid="wert-neu"><Hash size={14} /> Wert</button>
          <select style={{ ...S.selectSm, width: 190 }} value="" disabled={kopien >= MAX_KOPIEN} data-testid="anzeige-neu"
            title={`Anzeige als weiteres Element hinzufügen, auch mehrmals mit eigenen Einstellungen (höchstens ${MAX_KOPIEN})`}
            onChange={(ev) => {
              const n = neueAnzeige(ev.target.value, {}, F);
              if (!n) return;
              // Liegt schon eine Anzeige dieses Typs dort, etwas versetzt hinlegen
              if (layout.elemente.some((x) => x.typ === n.typ && x.sichtbar && x.x === n.x && x.y === n.y)) { n.x = Math.min(B - n.b, n.x + 30); n.y = Math.min(H - n.h, n.y + 30); }
              blockNeu(n);
            }}>
            <option value="">+ Element hinzufügen …</option>
            {ANZEIGEN.map((a) => <option key={a.typ} value={a.typ}>{a.label}</option>)}
          </select>
          <button style={S.primaryBtn} disabled={texte >= MAX_TEXTE} onClick={() => textNeu()}><Type size={14} /> Text hinzufügen</button>
        </div>
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
          <div ref={rahmen} style={{ minWidth: 0 }}>
            {/* Arbeitsfläche in der Größe des Screens: Bühne skaliert, Rahmen und Griffe in Bildschirm-Pixeln darüber */}
            <div ref={flaeche} tabIndex={0} data-testid="screen-flaeche" onKeyDown={taste} onPointerMove={ziehen} onPointerUp={loslassen} onPointerCancel={loslassen}
              onDragOver={(ev) => { if ([...(ev.dataTransfer?.items || [])].some((i) => i.kind === "file")) ev.preventDefault(); }}
              onDrop={(ev) => { const f = [...(ev.dataTransfer?.files || [])].find((x) => /^image\//.test(x.type)); if (!f) return; ev.preventDefault(); bildNeu(f, punkt(ev)); }}
              onPointerDown={(ev) => { if (ev.target === ev.currentTarget || ev.target.dataset.leer) setAuswahl(null); }}
              style={{ position: "relative", width: Math.round(B * s), height: Math.round(H * s), boxSizing: "content-box", margin: "0 auto", borderRadius: 8, overflow: "hidden", border: `1px solid ${LINE}`, outline: "none", background: layout.hintergrund === "transparent" ? KARO : "#000", touchAction: "none", userSelect: "none" }}>
              <div data-leer="1" style={{ position: "absolute", left: 0, top: 0, width: B, height: H, transform: `scale(${s})`, transformOrigin: "0 0", pointerEvents: "none" }}>
                <StatsBuehne status={vStatus} cfg={{ regie: cfg }} log={vLog} layout={layout} screen={screen} />
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
              <span><b>{screen.name}</b>: {B}×{H} px{Math.abs(s - 1) > 0.005 ? `, hier ${Math.round(s * 100)} % groß` : ""}{layout.hintergrund === "transparent" ? " · Hintergrund transparent: NDI sendet mit Alpha-Kanal" : ""}</span>
              <span><Move size={11} style={{ verticalAlign: -1 }} /> Ziehen: verschieben · Griffe: Größe · rastet an Kanten und Mitten ein, <b>Alt</b> gedrückt halten = frei</span>
              <span>Inhalt skaliert mit der Blockgröße · Bilder halten an den Ecken ihr Format, <b>Umschalt</b> = frei · Bilder per Drag and Drop auf die Fläche</span>
              <span>Pfeiltasten: 1 px, mit Umschalt 10 px · Entf: ausblenden/löschen · Strg+D: duplizieren · Strg+Z: rückgängig</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Elemente layout={layout} auswahl={auswahl} setAuswahl={setAuswahl} sichtbar={(e, v) => elAendern(e.id, { sichtbar: v })} />
            {gewaehlt ? <Eigenschaften e={gewaehlt} F={F} pcs={pcListe} bilder={layout.bilder} aendern={(patch) => elAendern(gewaehlt.id, patch)} tippen={(patch) => {
              // Tippen: ein Rückgängig-Schritt pro Feldbesuch, nicht pro Taste
              elAendern(gewaehlt.id, patch, punktNehmen(null));
            }} fokus={fokus} stilAlle={stilAlle} bildErsetzen={() => bildErsetzen(gewaehlt)} originalFormat={() => originalFormat(gewaehlt)}
              duplizieren={() => duplizieren(gewaehlt)} entfernen={() => entfernen(gewaehlt)} ebene={(r) => ebene(gewaehlt, r)} />
              : <>
                <div style={{ ...S.hint, marginTop: 0, border: `1px dashed ${LINE}`, borderRadius: 8, padding: 10 }}>Ein Element anklicken, um Position, Größe und Inhalt zu bearbeiten. Ohne Auswahl: Hintergrund.</div>
                <HintergrundEditor layout={layout} setArt={hgArt} aendern={hgAendern} fokus={fokus} bildSetzen={() => hgBild()} bildDarunter={() => (layout.hg.bild ? setzen({ ...layout, hintergrund: "bild", hg: { ...layout.hg, verlaufLage: "vor", verlauf: durchscheinend(layout.hg.verlauf) } }) : hgBild(true))} />
              </>}
          </div>
        </div>
    </>
  );
}

function Elemente({ layout, auswahl, setAuswahl, sichtbar }) {
  // Oberste Ebene zuerst, wie in Grafikprogrammen
  const liste = [...layout.elemente].reverse();
  // Mehrere Anzeigen desselben Typs: durchnummerieren (Spielstand, Spielstand 2 …)
  const nr = {}, zaehl = {};
  for (const e of layout.elemente) if (ANZEIGE[e.typ]) { zaehl[e.typ] = (zaehl[e.typ] || 0) + 1; nr[e.id] = zaehl[e.typ]; }
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
              {e.typ === "text" ? <Type size={13} color={SUB} /> : e.typ === "bild" ? <ImageIcon size={13} color={SUB} /> : e.typ === "spieler" ? <UserSquare size={13} color={SUB} /> : e.typ === "wert" ? <Hash size={13} color={SUB} /> : <span style={{ width: 13 }} />}
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: an ? 700 : 400 }}>{elLabel(e)}{zaehl[e.typ] > 1 ? ` ${nr[e.id]}` : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Eigene Einstellungen je Anzeige: Teile ein/aus, Texte je Zustand (mit Platzhaltern), Zahlen. Aus OPTIONEN in core/stats-layout.js
const OPTION_INFO = {
  icon: "Icon zeigen", kurz: "Kürzel zeigen", name: "Name zeigen",
  textOhne: ["Text ohne Wert", "Steht da, wenn nichts da ist (kein Spiel / keine Session). Leer = nichts"],
  punkt: "Punkt zeigen", textAn: "Text zeigen", textLive: ["Text bei LIVE", "Wenn Spieldaten kommen"], textWartet: ["Text beim Warten", "Wenn gerade keine Spieldaten kommen"],
  teamnamen: "Teamnamen zeigen", mitteKlein: "Zeile unter Runde/Zeit (z. B. „Runde läuft“)", chips: "Hinweise unter der Mitte (Map, Bombe …)",
  textSieger: ["Text beim Sieger", "Leer = kein Text"], textWarten: ["Text ohne Spieldaten", "Groß in der Mitte, solange kein Match läuft. Leer = nichts"], wartenKlein: "Zweite Zeile ohne Spieldaten",
  labels: "Beschriftung unter den Zahlen",
  zeilen: ["Zeilen", "0 = automatisch nach Höhe"], kopf: "Spaltenköpfe zeigen", textLeer: ["Text ohne Daten", "Leer = nichts"],
  anzahl: ["Anzahl Events", "0 = automatisch nach Höhe"], spieler: "Spieler/Team zeigen", zeit: "Uhrzeit zeigen",
  zahlen: "Kills/Tode neben den Namen",
  nurEnde: "Erst am Matchende zeigen", punkte: "Spalte Punkte", kd: "Spalte K/D", headshots: "Spalten Headshots und HS %", team: "Team zeigen",
  textMvp: ["Text unter dem MVP", "Leer = nur das Team"],
};
function Optionen({ e, aendern, tippen, fokus }) {
  const o = OPTIONEN[e.typ];
  const schalter = Object.keys(o).filter((k) => typeof o[k] === "boolean");
  const texte = Object.keys(o).filter((k) => typeof o[k] === "string");
  const zahlen = Object.keys(o).filter((k) => typeof o[k] === "number");
  const info = (k) => (Array.isArray(OPTION_INFO[k]) ? OPTION_INFO[k] : [OPTION_INFO[k] || k, ""]);
  // Text aus, wenn der Schalter „Text zeigen“ der Anzeige aus ist
  const textAus = e.typ === "live" && e.textAn === false;
  return (
    <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }} data-testid="optionen">
      <div style={{ fontSize: 11, fontWeight: 700, color: SUB, textTransform: "uppercase", letterSpacing: 0.5 }}>Inhalt und Texte</div>
      {schalter.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {schalter.map((k) => <Toggle key={k} checked={e[k] !== false} onChange={(v) => aendern({ [k]: v })} label={info(k)[0]} />)}
      </div>}
      {texte.map((k) => (
        <Field key={k} label={info(k)[0]} hint={info(k)[1]}>
          <div style={{ display: "flex", gap: 4 }}>
            <input data-testid={`opt-${k}`} style={{ ...S.inputSm, opacity: textAus ? 0.45 : 1 }} disabled={textAus} value={e[k] ?? o[k]} maxLength={OPTION_TEXT_MAX} placeholder="(nichts)" onFocus={fokus} onChange={(ev) => tippen({ [k]: ev.target.value })} />
            {(e[k] ?? o[k]) !== o[k] && <button style={{ ...S.smallBtn, fontSize: 10 }} title={`Standard: ${o[k] || "leer"}`} onClick={() => aendern({ [k]: o[k] })}>Standard</button>}
          </div>
        </Field>
      ))}
      {zahlen.map((k) => <Regler key={k} label={info(k)[0] + (e[k] ? "" : " (automatisch)")} wert={e[k] || 0} max={20} fokus={fokus} onChange={(v) => tippen({ [k]: v })} />)}
    </div>
  );
}

// Teams in Spielstand und Teams-Liste: Benennung nach Spiel, Namen von Hand, Texte für die Seiten, Farbe je Team
function TeamEinstellungen({ e, aendern, tippen, fokus }) {
  const feld = (k, label, platz) => (
    <Field label={label}>
      <input data-testid={`team-${k}`} style={S.inputSm} value={e[k] ?? TEAM_OPTIONEN[k]} maxLength={40} placeholder={platz} onFocus={fokus} onChange={(ev) => tippen({ [k]: ev.target.value })} />
    </Field>
  );
  const farbe = (k, label) => (
    <Field label={label}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="color" data-testid={`team-${k}`} value={e[k] || "#ffffff"} onFocus={fokus} onPointerDown={fokus} onChange={(ev) => tippen({ [k]: ev.target.value })} style={{ width: 30, height: 22, border: "none", background: "transparent", padding: 0, cursor: "pointer" }} />
        {e[k] ? <button style={{ ...S.smallBtn, fontSize: 10, padding: "2px 6px" }} onClick={() => aendern({ [k]: "" })}>Standard</button> : <span style={{ fontSize: 10, color: MUTED }}>nach Spiel</span>}
      </div>
    </Field>
  );
  return (
    <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }} data-testid="team-einstellungen">
      <div style={{ fontSize: 11, fontWeight: 700, color: SUB, textTransform: "uppercase", letterSpacing: 0.5 }}>Teams</div>
      <Field label="Namen der Teams">
        <select style={S.selectSm} value={e.benennung || "auto"} data-testid="team-benennung" onChange={(ev) => aendern({ benennung: ev.target.value })}>
          {BENENNUNGEN.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {feld("name1", "Name Team 1", "nach Spiel")}
        {feld("name2", "Name Team 2", "nach Spiel")}
        {farbe("farbe1", "Farbe Team 1")}
        {farbe("farbe2", "Farbe Team 2")}
      </div>
      {(e.benennung || "auto") === "auto" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {feld("textAngriff", "Text Angriff", "ANGRIFF")}
        {feld("textVerteidigung", "Text Verteidigung", "VERTEIDIGUNG")}
      </div>}
      <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.4 }}>Ein eigener Name überschreibt den Namen nach Spiel, leer = nach Spiel. Team 1 ist das erste Team des Spiels (Valorant: TEAM A, CS2: CT). Bei Valorant zeigt „Nach Spiel“ die Seite, sobald sie bekannt ist (Shots Fired oder Runde), z. B. ATTACK / DEFENSE als eigener Text. Platzhalter wie {"{score1}"} gehen auch.</div>
    </div>
  );
}

// Darstellung, die jedes Element hat: Deckkraft, Kachel-Transparenz, Ecken, Rahmen, Farben
const MIT_KACHEL = new Set(["spielstand", "zahlen", "bestenliste", "events", "teams", "spieler", "mvp"]);
function Darstellung({ e, tippen, aendern, fokus, stilAlle }) {
  const kachel = MIT_KACHEL.has(e.typ) || ((e.typ === "text" || e.typ === "bild" || e.typ === "wert") && e.panel);
  const farbFeld = (k, label, std) => (
    <Field label={label}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="color" data-testid={`stil-${k}`} value={e[k] || std} onFocus={fokus} onPointerDown={fokus} onChange={(ev) => tippen({ [k]: ev.target.value })} style={{ width: 30, height: 22, border: "none", background: "transparent", padding: 0, cursor: "pointer" }} />
        {e[k] ? <button style={{ ...S.smallBtn, fontSize: 10, padding: "2px 6px" }} onClick={() => aendern({ [k]: "" })}>Standard</button> : <span style={{ fontSize: 10, color: MUTED }}>Standard</span>}
      </div>
    </Field>
  );
  return (
    <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }} data-testid="darstellung">
      <div style={{ fontSize: 11, fontWeight: 700, color: SUB, textTransform: "uppercase", letterSpacing: 0.5 }}>Darstellung</div>
      <Regler label="Deckkraft (ganzes Element)" wert={e.deckkraft ?? 100} einheit="%" fokus={fokus} onChange={(v) => tippen({ deckkraft: v })} testid="stil-deckkraft" />
      {kachel && <>
        <Regler label="Kachel-Hintergrund (0 = durchsichtig)" wert={e.kachel ?? 92} einheit="%" fokus={fokus} onChange={(v) => tippen({ kachel: v })} testid="stil-kachel" />
        <Regler label="Ecken der Kachel" wert={e.ecken ?? 18} max={80} einheit=" px" fokus={fokus} onChange={(v) => tippen({ ecken: v })} />
        <Toggle checked={e.rahmen !== false} onChange={(v) => aendern({ rahmen: v })} label="Rahmen und Leuchten" />
      </>}
      {(ANZEIGE[e.typ] || e.typ === "spieler") && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {farbFeld("schrift", "Schriftfarbe", "#ffffff")}
        {farbFeld("akzent", "Akzentfarbe", "#c39bff")}
      </div>}
      <VerlaufLage label="Eigener Verlauf" wert={e.verlaufLage || "aus"} testid="el-verlauf-lage" titel={{ hinter: "Verlauf hinter dem Inhalt (wie ein eigener Hintergrund des Elements)", vor: "Verlauf vor dem Inhalt, als Überlagerung" }}
        onChange={(k) => aendern({ verlaufLage: k, ...(k !== "aus" && !e.verlauf ? { verlauf: elementVerlauf() } : {}) })} />
      {e.verlaufLage && e.verlaufLage !== "aus" && e.verlauf && <>
        <div style={{ fontSize: 10, color: MUTED }}>{e.verlaufLage === "vor" ? "Liegt über dem Inhalt: Farbstopps mit wenig Deckkraft lassen ihn durchscheinen." : "Liegt hinter dem Inhalt. Bei Kacheln den Kachel-Hintergrund senken, damit er durchscheint."}</div>
        <VerlaufEditor v={e.verlauf} aendern={(v, vorher) => (vorher === null ? tippen({ verlauf: v }) : aendern({ verlauf: v }))} fokus={fokus} />
      </>}
      <button style={{ ...S.smallBtn, alignSelf: "flex-start" }} onClick={() => stilAlle(e)} title="Deckkraft, Kachel, Ecken, Rahmen, Farben und Verlauf dieses Elements für alle Elemente übernehmen">Darstellung auf alle Elemente übertragen</button>
    </div>
  );
}

// Spieler wählen: nach Platz (bester, zweitbester …) oder ein fester PC
function SpielerWahl({ e, pcs, aendern }) {
  const fest = e.quelle && e.quelle !== "rang";
  const liste = fest && !pcs.some((p) => p.pcId === e.quelle) ? [...pcs, { pcId: e.quelle, name: "" }] : pcs;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 8 }}>
      <Field label="Spieler">
        <select style={S.selectSm} value={fest ? e.quelle : "rang"} data-testid="spieler-quelle" onChange={(ev) => aendern({ quelle: ev.target.value })}>
          <option value="rang">Nach Platz (die meisten Kills)</option>
          {liste.map((p) => <option key={p.pcId} value={p.pcId}>{p.pcId}{p.name && p.name !== p.pcId ? ` · ${p.name}` : ""}</option>)}
        </select>
      </Field>
      {!fest ? <Zahl label="Platz" wert={e.rang || 1} min={1} max={20} onChange={(v) => aendern({ rang: Math.max(1, Math.min(20, v)) })} />
        : <Field label="PC-ID"><input style={S.inputSm} defaultValue={e.quelle} key={e.quelle} onBlur={(ev) => ev.target.value.trim() && aendern({ quelle: ev.target.value.trim() })} /></Field>}
    </div>
  );
}

const SPIELER_INFO = { agent: "Agent zeigen (Valorant)", waffe: "Waffe des letzten Kills (Valorant)", team: "Team zeigen", seite: "Seite zeigen (Valorant: Angriff/Verteidigung)", kills: "Kills", tode: "Tode", headshots: "Headshots", kd: "K/D" };

function Eigenschaften({ e, F, pcs = [], bilder, aendern, tippen, fokus, duplizieren, entfernen, ebene, bildErsetzen, originalFormat, stilAlle }) {
  const { b: B, h: H } = F;
  const ta = useRef(null);
  const text = e.typ === "text", bild = e.typ === "bild", anzeige = !!ANZEIGE[e.typ], karte = e.typ === "spieler", wert = e.typ === "wert";
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
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>{text ? <Type size={14} /> : bild ? <ImageIcon size={14} /> : karte ? <UserSquare size={14} /> : wert ? <Hash size={14} /> : <Cast size={14} />} {text ? "Text" : bild ? "Bild" : karte ? "Spieler-Karte" : wert ? "Wert" : ANZEIGE[e.typ]?.label}</div>
      {karte && <>
        <SpielerWahl e={e} pcs={pcs} aendern={aendern} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          {Object.keys(SPIELER_OPTIONEN).map((k) => <Toggle key={k} checked={e[k] !== false} onChange={(v) => aendern({ [k]: v })} label={SPIELER_INFO[k]} />)}
        </div>
        <Toggle checked={e.skalieren !== false} onChange={(v) => aendern({ skalieren: v })} label="Inhalt skaliert mit der Blockgröße" />
      </>}
      {wert && <>
        <Field label="Wert">
          <select style={S.selectSm} value={e.wert} data-testid="wert-wahl" onChange={(ev) => aendern({ wert: ev.target.value })}>
            <optgroup label="Match">{WERTE.filter((w) => !w[2]).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</optgroup>
            <optgroup label="Ein Spieler">{WERTE.filter((w) => w[2]).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</optgroup>
          </select>
        </Field>
        {String(e.wert).startsWith("sp.") && <SpielerWahl e={e} pcs={pcs} aendern={aendern} />}
        <Toggle checked={e.beschriftung !== false} onChange={(v) => aendern({ beschriftung: v })} label="Beschriftung darunter" />
        {e.beschriftung !== false && <Field label="Eigene Beschriftung" hint="Leer = Standard (z. B. „Kills“)">
          <input style={S.inputSm} value={e.text} maxLength={80} onFocus={fokus} onChange={(ev) => tippen({ text: ev.target.value })} />
        </Field>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Field label="Farbe"><input type="color" value={e.farbe} onChange={(ev) => aendern({ farbe: ev.target.value })} style={{ width: 40, height: 24, border: "none", background: "transparent", padding: 0, cursor: "pointer" }} /></Field>
          <Field label="Ausrichtung">
            <div style={{ display: "flex", gap: 3 }}>{ausr.map(([k, Ic]) => (
              <button key={k} title={k} onClick={() => aendern({ ausrichtung: k })} style={{ ...S.smallBtn, flex: 1, padding: "5px 0", ...(e.ausrichtung === k ? { background: ACCENT, borderColor: ACCENT } : {}) }}><Ic size={13} /></button>
            ))}</div>
          </Field>
        </div>
        <Toggle checked={e.panel} onChange={(v) => aendern({ panel: v })} label="Mit Hintergrund-Kachel" />
        <div style={{ fontSize: 11, color: MUTED }}>Die Schrift passt sich der Blockgröße an.</div>
      </>}
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
        <Regler label="Ecken abrunden" wert={e.radius} max={200} einheit=" px" fokus={fokus} onChange={(v) => tippen({ radius: v })} />
        <Toggle checked={e.panel} onChange={(v) => aendern({ panel: v })} label="Mit Hintergrund-Kachel" />
      </>}
      {anzeige && <>
        <Toggle checked={e.skalieren !== false} onChange={(v) => aendern({ skalieren: v })} label="Inhalt skaliert mit der Blockgröße" title="Schrift, Logos und Tabellen wachsen oder schrumpfen mit dem Block" />
        <Regler label={`Zoom (Inhalt ${Math.round(skala.f * 100)} %)`} wert={e.zoom ?? 100} min={ZOOM_MIN} max={ZOOM_MAX} einheit="%" fokus={fokus} onChange={(v) => tippen({ zoom: v })} testid="zoom" />
        {(e.zoom ?? 100) !== 100 && <button style={{ ...S.smallBtn, alignSelf: "flex-start" }} onClick={() => aendern({ zoom: 100 })}>Zoom auf 100 %</button>}
      </>}
      {OPTIONEN[e.typ] && Object.keys(OPTIONEN[e.typ]).length > 0 && <Optionen e={e} aendern={aendern} tippen={tippen} fokus={fokus} />}
      {TEAM_TYPEN.has(e.typ) && <TeamEinstellungen e={e} aendern={aendern} tippen={tippen} fokus={fokus} />}
      <Darstellung e={e} tippen={tippen} aendern={aendern} fokus={fokus} stilAlle={stilAlle} />
      {!text && !wert && (
        <Field label="Überschrift" hint="Leer lassen für keine Überschrift. Platzhalter wie {spiel} gehen auch.">
          <input style={S.inputSm} value={e.titel ?? ""} maxLength={80} onFocus={fokus} data-testid="el-ueberschrift" onChange={(ev) => tippen({ titel: ev.target.value })} />
        </Field>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Zahl label="X" wert={e.x} max={B - e.b} onChange={(v) => aendern({ x: Math.max(0, Math.min(B - e.b, v)) })} />
        <Zahl label="Y" wert={e.y} max={H - e.h} onChange={(v) => aendern({ y: Math.max(0, Math.min(H - e.h, v)) })} />
        <Zahl label="Breite" wert={e.b} min={MIN} max={B} onChange={(v) => { const b = Math.max(MIN, Math.min(B, v)); aendern({ b, x: Math.min(e.x, B - b) }); }} />
        <Zahl label="Höhe" wert={e.h} min={MIN} max={H} onChange={(v) => { const h = Math.max(MIN, Math.min(H, v)); aendern({ h, y: Math.min(e.y, H - h) }); }} />
      </div>
      {(e.x !== 0 || e.y !== 0 || e.b !== B || e.h !== H) && <button style={{ ...S.smallBtn, alignSelf: "flex-start" }} data-testid="fuellen" onClick={() => aendern({ x: 0, y: 0, b: B, h: H })}
        title="Element auf die ganze Fläche des Screens setzen, z. B. um nur dieses Element zu streamen"><Scaling size={12} /> Ganzen Screen füllen</button>}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        <button style={S.smallBtn} onClick={() => ebene(1)} title="Vor alle anderen"><ArrowUpToLine size={12} /> Nach vorne</button>
        <button style={S.smallBtn} onClick={() => ebene(-1)} title="Hinter alle anderen"><ArrowDownToLine size={12} /> Nach hinten</button>
        <button style={S.smallBtn} onClick={duplizieren} title={ANZEIGE[e.typ] ? "Als weiteres Element mit denselben Einstellungen hinzufügen" : "Kopie anlegen"}><Copy size={12} /> Duplizieren</button>
        <span style={{ flex: 1 }} />
        {eigen(e) ? <button style={S.dangerBtn} onClick={entfernen}><Trash2 size={12} /> Löschen</button>
          : <button style={S.smallBtn} onClick={entfernen}><EyeOff size={12} /> Ausblenden</button>}
      </div>
    </div>
  );
}
