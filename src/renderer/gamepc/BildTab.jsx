import React, { useState, useEffect, useRef, useMemo } from "react";
import { S, ACCENT, ACCENT_HI, LINE, SUB, MUTED, OK, WARN, ERR, FELD, teamFarbe } from "../theme.js";
import { api } from "../api.js";
import { Section, Field, Toggle, SpielChip, Kbd } from "../ui.jsx";
import { BILD_SPIELE, BILD_BY_ID, FPS, migrateAktion, migrateBereich, erkennungsAuftrag, aktionBereit, bereichBereit, MAX_BEREICHE, MAX_FRAMES, uid } from "../../core/bild-spiele.js";
import { BildErkennung, kodieren, ankerVon, region as regionBegrenzen, ANKER_H, ANKER_V } from "../../core/bild-erkennung.js";
import { sigAus, bildAus, pngAus, istLeer } from "../bild.js";
import { Circle, Square, Upload, Download, Play, Pause, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Trash2, Film, FlaskConical, Type, Crop, ImagePlus, FolderOpen } from "lucide-react";

const MAX_AUFNAHME = 10 * 60 * 1000; // 10 Minuten, liegt nur im Arbeitsspeicher
const FRAME = 1 / 30;
const pct = (x) => `${(x * 100).toFixed(2)}%`;
const uhr = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}` : "–");

// Tab „Bilderkennung“ des Game-PCs: Einstellungen, Editor für die Aktionen, Export und Import
export default function BildTab({ cfg, mutate, g, notify }) {
  const b = cfg.bild;
  const [spielId, setSpiel] = useState(() => (BILD_BY_ID[g.client?.aktivesSpiel] ? g.client.aktivesSpiel : "valorant"));
  const def = BILD_BY_ID[spielId], sc = b.spiele[spielId];
  const [schirme, setSchirme] = useState([]);
  useEffect(() => { api.bildBildschirme().then(setSchirme); }, []);
  const st = g.bild || {};
  const setzeSpiel = (fn) => mutate((d) => fn(d.bild.spiele[spielId]));

  const importieren = async () => {
    const r = await api.bildImport();
    if (r?.fehler) return notify(r.fehler, "err");
    if (!r?.ok) return;
    mutate((d) => { d.bild.spiele[r.spiel] = r.cfg.gamepc.bild.spiele[r.spiel]; });
    setSpiel(r.spiel);
    notify(`${BILD_BY_ID[r.spiel].name}: ${r.anzahl} Aktionen importiert${r.korrigiert ? ", Bereiche an das Seitenverhältnis dieses Bildschirms angepasst" : ""}.`);
  };
  const exportieren = async () => {
    if (!sc.aktionen.length) return notify("Noch keine Aktionen zum Exportieren.", "warn");
    const r = await api.bildExport(spielId);
    if (r?.fehler) notify(r.fehler, "err"); else if (r?.ok) notify(`Exportiert: ${r.pfad}`);
  };

  // Je Spiel: läuft die Erkennung, woher kommt das Bild?
  const spielStatus = (d) => {
    const l = st.spiele?.[d.id], q = b.spiele[d.id].quelle;
    if (!b.an) return [MUTED, "aus"];
    if (!b.spiele[d.id].aktionen.some((a) => a.an)) return [MUTED, "noch keine Aktionen"];
    if (!l) return [MUTED, q === "bildschirm" ? "wartet: läuft, wenn das Spiel offen oder in der Regie aktiv ist" : `wartet, bis ${q.startsWith("fenster:") ? `das Fenster „${q.slice(8)}“` : "das Spiel"} offen ist`];
    if (l.fehler) return [ERR, l.fehler];
    if (l.leer) return [ERR, "Bild ist schwarz: Spiel im randlosen Fenstermodus starten"];
    return l.laeuft ? [OK, `läuft · ${l.quelle?.name || "Bildschirm"} · ${l.b}×${l.h}`] : [WARN, `startet · ${l.quelle?.name || "Bildschirm"}`];
  };
  // Bildquelle: jedes offene Fenster oder Programm, Liste beim Öffnen der Auswahl neu holen
  const [offen, setOffen] = useState([]);
  const [eigen, setEigen] = useState(false);
  const fensterHolen = () => api.bildFenster().then((l) => setOffen(Array.isArray(l) ? l : [])).catch(() => {});
  useEffect(() => { fensterHolen(); }, []);
  const gewaehlt = sc.quelle.startsWith("fenster:") ? sc.quelle.slice(8) : null;
  const fensterListe = [...new Set([...offen, ...(st.fenster || [])])].filter((f) => f && f !== gewaehlt).sort((x, y) => x.localeCompare(y));

  return (
    <>
      <Section title="Bilderkennung" subtitle="Für Spiele ohne offizielle Schnittstelle: Die App schaut auf das Spielfenster und erkennt die Aktionen, die du im Editor angelegt hast. Sie merkt selbst, wenn ein Spiel geöffnet wird, und nimmt sein Fenster als Quelle. Sind mehrere Spiele offen, läuft für jedes eine eigene Erkennung. Die Events gehen wie bei allen Spielen an die Regie."
        right={<Toggle checked={b.an} label="Erkennung an" onChange={(v) => mutate((d) => { d.bild.an = v; })} />}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Bildschirm (für Quelle „Bildschirm“)">
            <select style={S.select} value={b.display} onChange={(e) => mutate((d) => { d.bild.display = e.target.value; })}>
              <option value="">Hauptbildschirm</option>
              {schirme.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.b}×{s.h}</option>)}
            </select>
          </Field>
          <Field label="Bilder pro Sekunde">
            <select style={{ ...S.select, minWidth: 90 }} value={b.fps} onChange={(e) => mutate((d) => { d.bild.fps = Number(e.target.value); })}>
              {FPS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 4 }}>
          {BILD_SPIELE.map((d) => { const [farbe, text] = spielStatus(d); return (
            <div key={d.id} style={{ fontSize: 13, display: "flex", gap: 8 }}><b style={{ minWidth: 90, color: d.farbe }}>{d.name}</b><span style={{ color: farbe }}>● {text}</span></div>
          ); })}
          {st.fehler && <div style={{ fontSize: 12, color: ERR }}>{st.fehler}</div>}
        </div>
        <p style={S.hint}>Spiel im <b>randlosen Fenstermodus</b> starten: Im exklusiven Vollbild bleibt die Bildschirmaufnahme oft schwarz. Mehr Bilder pro Sekunde erkennen kurze Einblendungen sicherer und kosten etwas mehr Rechenzeit.</p>
      </Section>

      <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        {BILD_SPIELE.map((s) => (
          <button key={s.id} onClick={() => setSpiel(s.id)} style={{ ...S.smallBtn, padding: "6px 12px", fontSize: 13, fontWeight: 700, background: spielId === s.id ? s.farbe : "transparent", color: spielId === s.id ? "#14121a" : SUB }}>{s.name}</button>
        ))}
      </span>} right={<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Field label="Bildquelle">
          <div style={{ display: "flex", gap: 6 }}>
            <select style={{ ...S.selectSm, width: 230 }} value={eigen ? "eigen" : sc.quelle} onFocus={fensterHolen} onMouseDown={fensterHolen}
              onChange={(e) => { const v = e.target.value; setEigen(v === "eigen"); if (v !== "eigen") setzeSpiel((s) => { s.quelle = v; }); }}>
              <option value="auto">Automatisch: Fenster „{def.fenster}“</option>
              <option value="bildschirm">Bildschirm</option>
              {gewaehlt && <option value={sc.quelle}>Fenster: {gewaehlt}{offen.some((f) => f.toUpperCase().includes(gewaehlt.toUpperCase())) ? "" : " (nicht offen)"}</option>}
              {fensterListe.length > 0 && <optgroup label="Offene Fenster und Programme">
                {fensterListe.map((f) => <option key={f} value={`fenster:${f}`}>{f}</option>)}
              </optgroup>}
              <option value="eigen">Fenstertitel eingeben …</option>
            </select>
            {eigen && <input style={{ ...S.inputSm, width: 160 }} autoFocus placeholder="Titel enthält …" defaultValue={gewaehlt || ""}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              onBlur={(e) => { const t = e.target.value.trim(); setEigen(false); if (t) setzeSpiel((s) => { s.quelle = `fenster:${t}`; }); }} />}
          </div>
        </Field>
        <Field label="Team dieses PCs">
          <select style={{ ...S.selectSm, width: 130, color: teamFarbe(sc.team) }} value={sc.team} onChange={(e) => setzeSpiel((s) => { s.team = e.target.value; })}>
            {def.teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <button style={{ ...S.secondaryBtn, alignSelf: "flex-end" }} onClick={importieren}><FolderOpen size={14} /> Importieren</button>
        <button style={{ ...S.secondaryBtn, alignSelf: "flex-end" }} onClick={exportieren}><Download size={14} /> Exportieren</button>
      </div>}>
        <p style={{ ...S.subtitle, marginTop: -4 }}>
          Einmal auf einem PC einrichten, exportieren und auf den anderen Game-PCs importieren. Das Team stellt jeder PC selbst ein.
          Hat ein PC ein anderes Seitenverhältnis, verschiebt der Import die Bereiche passend zu ihrem Anker.
        </p>
        <Editor key={spielId} def={def} sc={sc} setzeSpiel={setzeSpiel} notify={notify} werteLive={st.spiele?.[spielId]?.werte || null} teilWerteLive={st.spiele?.[spielId]?.teilWerte || null} letzteLive={st.spiele?.[spielId]?.letzte} />
      </Section>
    </>
  );
}

/* ── Editor ───────────────────────────────────────────────────────────── */
function Editor({ def, sc, setzeSpiel, notify, werteLive, teilWerteLive, letzteLive }) {
  const video = useRef(null), flaeche = useRef(null);
  const [quelle, setQuelle] = useState(null); // { url, name }
  const [dauer, setDauer] = useState(0), [zeitpunkt, setZeit] = useState(0), [spielt, setSpielt] = useState(false), [masse, setMasse] = useState(null);
  const [aufnahme, setAufnahme] = useState(null); // { rec, start }
  const [jetzt, setJetzt] = useState(Date.now());
  const [wahl, setWahl] = useState(sc.aktionen[0]?.id || null);
  const [box, setBox] = useState(null); // gezogener Bereich (relativ)
  const zug = useRef(null);
  const [testen, setTesten] = useState(false), [werte, setWerte] = useState({}), [teilWerte, setTeilWerte] = useState({}), [treffer, setTreffer] = useState([]);
  const [gelesen, setGelesen] = useState(null);
  const texte = useRef({});
  const aktion = sc.aktionen.find((a) => a.id === wahl) || null;
  // Gewählter Bereich (Auslöser) der gewählten Aktion
  const [bWahl, setBWahl] = useState(null);
  const bereich = aktion ? aktion.bereiche.find((b) => b.id === bWahl) || aktion.bereiche[0] : null;
  const bName = (a, b) => (a.bereiche.length > 1 ? `Bereich ${a.bereiche.indexOf(b) + 1}` : "Bereich");

  useEffect(() => () => { if (quelle?.url) URL.revokeObjectURL(quelle.url); }, [quelle]);
  useEffect(() => () => { aufnahme?.rec?.state === "recording" && aufnahme.rec.stop(); }, []);
  useEffect(() => { if (!aufnahme) return; const t = setInterval(() => setJetzt(Date.now()), 500); return () => clearInterval(t); }, [aufnahme]);

  const aendern = (id, fn) => setzeSpiel((s) => { const a = s.aktionen.find((x) => x.id === id); if (a) fn(a, s); });
  const aendernB = (fn) => aktion && bereich && aendern(aktion.id, (a, s) => { const b = a.bereiche.find((x) => x.id === bereich.id); if (b) fn(b, a, s); });

  /* Aufnahme: läuft weiter, während du spielst. Nur im Arbeitsspeicher, beim Schließen oder „Löschen“ weg. */
  const aufnehmen = async () => {
    let stream;
    const q = await api.bildAufnahme("vorbereiten", def.id); // nimmt die Bildquelle dieses Spiels auf
    try { stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false }); }
    catch (e) { return notify(`Aufnahme nicht möglich: ${e?.message || e}`, "err"); }
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const teile = [];
    rec.ondataavailable = (e) => e.data.size && teile.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      api.bildAufnahme(false);
      setAufnahme(null);
      if (!teile.length) return;
      laden(URL.createObjectURL(new Blob(teile, { type: mime })), "Aufnahme");
    };
    stream.getVideoTracks()[0]?.addEventListener("ended", () => rec.state === "recording" && rec.stop());
    rec.start(1000);
    api.bildAufnahme(true); // App darf im Hintergrund weiter aufnehmen
    const timer = setTimeout(() => rec.state === "recording" && rec.stop(), MAX_AUFNAHME);
    rec.addEventListener("stop", () => clearTimeout(timer));
    setAufnahme({ rec, start: Date.now() });
    notify(`Aufnahme läuft (${q?.art === "fenster" ? `Fenster „${q.name}“` : "Bildschirm"}). Jetzt ins Spiel wechseln und die Momente spielen, die erkannt werden sollen.`);
  };
  const laden = (url, name) => {
    if (quelle?.url) URL.revokeObjectURL(quelle.url);
    setQuelle({ url, name }); setTreffer([]); setWerte({}); setBox(null); setZeit(0); setDauer(0);
  };
  const datei = (e) => { const f = e.target.files?.[0]; if (f) laden(URL.createObjectURL(f), f.name); e.target.value = ""; };
  const loeschen = () => { if (quelle?.url) URL.revokeObjectURL(quelle.url); setQuelle(null); setMasse(null); notify("Aufnahme gelöscht. Die Frames der Aktionen bleiben gespeichert."); };

  // Videos aus MediaRecorder haben keine Länge: einmal ans Ende springen, dann ist sie bekannt
  const metadaten = () => {
    const v = video.current;
    setMasse({ b: v.videoWidth, h: v.videoHeight });
    if (Number.isFinite(v.duration)) { setDauer(v.duration); return; }
    const fertig = () => { v.removeEventListener("timeupdate", fertig); setDauer(v.duration); v.currentTime = 0; };
    v.addEventListener("timeupdate", fertig);
    v.currentTime = 1e101;
  };
  const springe = (t) => { const v = video.current; if (!v) return; v.currentTime = Math.max(0, Math.min(dauer || 0, t)); };
  const abspielen = () => { const v = video.current; if (!v) return; if (v.paused) v.play(); else v.pause(); };

  /* Bereich ziehen */
  const relativ = (e) => { const r = flaeche.current.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
  const runter = (e) => { if (!masse) return; e.currentTarget.setPointerCapture(e.pointerId); zug.current = relativ(e); setBox(null); };
  const bewegen = (e) => {
    if (!zug.current) return;
    const p = relativ(e), a = zug.current;
    setBox({ x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), b: Math.abs(p.x - a.x), h: Math.abs(p.y - a.y) });
  };
  const hoch = () => { zug.current = null; setBox((x) => (x && x.b > 0.004 && x.h > 0.004 ? regionBegrenzen(x) : null)); };

  /* Aktionen */
  const neueAktion = (vorschlag) => {
    const [name, event, seite, r] = vorschlag || ["Neue Aktion", def.events.find((e) => e.gruppe === "Eigene").id, "eigen", { x: 0.4, y: 0.4, b: 0.2, h: 0.1 }];
    const reg = box || r;
    const a = migrateAktion({ id: uid(), name, event, seite, bereiche: [{ id: uid(), region: reg, anker: ankerVon(reg), vorlagen: [] }] }, def.id);
    setzeSpiel((s) => { s.aktionen.push(a); });
    setWahl(a.id); setBWahl(null); setBox(null);
  };
  const bereichUebernehmen = () => {
    if (!bereich || !box) return;
    if (bereich.vorlagen.length && !confirm(`Neuer Rahmen für ${bName(aktion, bereich)} von „${aktion.name}“: Die ${bereich.vorlagen.length} gespeicherten Frames passen dann nicht mehr und werden gelöscht. Weiter?`)) return;
    aendernB((b) => { b.region = box; b.anker = ankerVon(box); b.vorlagen = []; });
    setBox(null);
  };
  // Weiterer Auslöser für dieselbe Aktion (z. B. Banner oben und Killfeed rechts, oder zwei Texte)
  const bereichDazu = () => {
    if (!aktion || !box) return;
    if (aktion.bereiche.length >= MAX_BEREICHE) return notify(`Höchstens ${MAX_BEREICHE} Bereiche je Aktion.`, "warn");
    const neu = migrateBereich({ id: uid(), region: box, anker: ankerVon(box), vorlagen: [] }, 0);
    aendern(aktion.id, (a) => { a.bereiche.push(neu); });
    setBWahl(neu.id); setBox(null);
  };
  const bereichEntfernen = (id) => {
    if (!aktion || aktion.bereiche.length < 2) return;
    aendern(aktion.id, (a) => { a.bereiche = a.bereiche.filter((b) => b.id !== id); });
    setBWahl(null);
  };
  const frameDazu = () => {
    const v = video.current;
    if (!bereich || !v || !masse) return notify("Erst eine Aufnahme laden und eine Aktion wählen.", "warn");
    if (bereich.vorlagen.length >= MAX_FRAMES) return notify(`Höchstens ${MAX_FRAMES} Frames je Bereich.`, "warn");
    if (istLeer(v)) return notify("Dieser Frame ist schwarz. Spiel im randlosen Fenstermodus aufnehmen.", "err");
    const vorlage = { sig: kodieren(sigAus(v, bereich.region)), bild: bildAus(v, bereich.region) };
    aendernB((b, a, s) => { b.vorlagen.push(vorlage); if (!s.aufloesung) s.aufloesung = { ...masse }; });
    notify(`Frame bei ${uhr(v.currentTime)} zu „${aktion.name}“ (${bName(aktion, bereich)}) hinzugefügt.`);
  };
  const textLesen = async () => {
    const v = video.current;
    if (!bereich || !v || !masse) return;
    setGelesen({ laedt: true });
    const r = await api.bildLesen(await pngAus(v, bereich.region));
    setGelesen(r.fehler ? { fehler: r.fehler } : { text: r.text });
  };

  /* Testen: Erkennung auf der Aufnahme laufen lassen, Zeit = Videozeit */
  const auftrag = useMemo(() => erkennungsAuftrag(sc.aktionen), [JSON.stringify(sc.aktionen.map((a) => [a.id, a.an, a.modus, a.schwelle, a.pause, a.bereiche.map((b) => [b.id, b.region, b.text, b.vorlagen.length])]))]);
  const erkennung = useMemo(() => { const e = new BildErkennung({ aktionen: auftrag.aktionen }); e.setVorlagen(auftrag.vorlagen); return e; }, [auftrag]);
  useEffect(() => {
    if (!testen || !masse) return;
    let letzteTexte = 0, aus = false;
    const tick = async () => {
      const v = video.current;
      if (!v || aus) return;
      const t = v.currentTime * 1000;
      if (Date.now() - letzteTexte > 800) {
        letzteTexte = Date.now();
        for (const x of auftrag.teile.filter((y) => y.text)) pngAus(v, x.region).then(api.bildLesen).then((r) => { if (r?.text != null) texte.current[x.key] = r.text; }).catch(() => {});
      }
      const sigs = Object.fromEntries(auftrag.teile.map((x) => [x.key, sigAus(v, x.region)]));
      const r = erkennung.frame(sigs, t, texte.current);
      setWerte(r.werte); setTeilWerte(r.teilWerte);
      if (r.erkannt.length) setTreffer((l) => [...r.erkannt.map((x) => ({ ...x, t: v.currentTime, name: sc.aktionen.find((a) => a.id === x.id)?.name || x.id, n: Math.random() })), ...l].slice(0, 40));
    };
    const iv = setInterval(tick, 200);
    return () => { aus = true; clearInterval(iv); };
  }, [testen, masse, erkennung]);

  const wertVon = (id) => (testen ? werte[id] : werteLive?.[id]);
  const teilWertVon = (a, b) => (testen ? teilWerte : teilWerteLive)?.[`${a.id}.${b.id}`];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.7fr) minmax(320px,1fr)", gap: 16, alignItems: "start" }}>
      <div>
        {/* Aufnahme und Laden */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          {aufnahme ? (
            <button style={{ ...S.primaryBtn, background: ERR, boxShadow: `0 0 12px ${ERR}88` }} onClick={() => aufnahme.rec.stop()}><Square size={14} /> Aufnahme stoppen ({uhr((jetzt - aufnahme.start) / 1000)})</button>
          ) : (
            <button style={S.primaryBtn} onClick={aufnehmen}><Circle size={14} fill="#fff" /> Gameplay aufnehmen</button>
          )}
          <label style={{ ...S.secondaryBtn, cursor: "pointer" }}><Upload size={14} /> Video laden …<input type="file" accept="video/*" style={{ display: "none" }} onChange={datei} /></label>
          {quelle && <button style={S.dangerBtn} onClick={loeschen}><Trash2 size={13} /> Aufnahme löschen</button>}
          <span style={{ flex: 1 }} />
          {quelle && <Toggle checked={testen} label="Erkennung testen" onChange={(v) => { setTesten(v); setTreffer([]); }} />}
        </div>

        {!quelle ? (
          <div style={{ border: `1px dashed ${LINE}`, borderRadius: 8, padding: 28, color: SUB, fontSize: 13, lineHeight: 1.6, textAlign: "center" }}>
            <Film size={28} style={{ color: ACCENT, marginBottom: 8 }} /><br />
            <b style={{ color: "#fff" }}>So geht's:</b> Gameplay aufnehmen (oder ein Video laden), im Spiel die Momente spielen, die erkannt werden sollen,
            Aufnahme stoppen. Dann zum passenden Frame spulen, einen Rahmen um die Stelle ziehen, eine Aktion anlegen und den Frame hinzufügen.
            Die Aufnahme bleibt nur im Arbeitsspeicher; gespeichert werden nur die Frames der Aktionen.
          </div>
        ) : (
          <>
            <div ref={flaeche} onPointerDown={runter} onPointerMove={bewegen} onPointerUp={hoch}
              style={{ position: "relative", width: "100%", aspectRatio: masse ? `${masse.b} / ${masse.h}` : "16 / 9", background: "#000", borderRadius: 8, overflow: "hidden", cursor: masse ? "crosshair" : "default", userSelect: "none", touchAction: "none" }}>
              <video ref={video} src={quelle.url} muted playsInline onLoadedMetadata={metadaten} onTimeUpdate={(e) => setZeit(e.target.currentTime)}
                onPlay={() => setSpielt(true)} onPause={() => setSpielt(false)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
              {sc.aktionen.flatMap((a) => a.bereiche.map((b) => {
                const w = teilWertVon(a, b), an = w != null && w >= a.schwelle, gewaehlt = a.id === wahl, aktiv = gewaehlt && b.id === bereich?.id;
                return (
                  <div key={`${a.id}.${b.id}`} style={{ position: "absolute", left: pct(b.region.x), top: pct(b.region.y), width: pct(b.region.b), height: pct(b.region.h), pointerEvents: "none",
                    border: `${aktiv ? 2 : 1}px ${bereichBereit(b) ? "solid" : "dashed"} ${an ? OK : gewaehlt ? ACCENT_HI : "rgba(255,255,255,.45)"}`, boxShadow: an ? `0 0 10px ${OK}` : aktiv ? `0 0 8px ${ACCENT}` : "none" }}>
                    <span style={{ position: "absolute", left: 0, top: -17, fontSize: 10, background: "rgba(20,18,26,.85)", color: an ? OK : gewaehlt ? ACCENT_HI : "#ddd", padding: "1px 4px", borderRadius: 3, whiteSpace: "nowrap" }}>
                      {a.name}{a.bereiche.length > 1 ? ` · ${a.bereiche.indexOf(b) + 1}` : ""}{w != null ? ` ${Math.round(w * 100)}%` : ""}
                    </span>
                  </div>
                );
              }))}
              {box && <div style={{ position: "absolute", left: pct(box.x), top: pct(box.y), width: pct(box.b), height: pct(box.h), border: `2px dashed ${WARN}`, background: "rgba(243,156,18,.12)", pointerEvents: "none" }} />}
            </div>
            {/* Spulen */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
              <button style={S.smallBtn} title="1 Sekunde zurück" onClick={() => springe(zeitpunkt - 1)}><ChevronsLeft size={14} /></button>
              <button style={S.smallBtn} title="1 Frame zurück" onClick={() => springe(zeitpunkt - FRAME)}><ChevronLeft size={14} /></button>
              <button style={{ ...S.smallBtn, padding: "4px 12px" }} onClick={abspielen}>{spielt ? <Pause size={14} /> : <Play size={14} />}</button>
              <button style={S.smallBtn} title="1 Frame vor" onClick={() => springe(zeitpunkt + FRAME)}><ChevronRight size={14} /></button>
              <button style={S.smallBtn} title="1 Sekunde vor" onClick={() => springe(zeitpunkt + 1)}><ChevronsRight size={14} /></button>
              <input type="range" min={0} max={dauer || 0} step={FRAME} value={zeitpunkt} onChange={(e) => springe(Number(e.target.value))} style={{ flex: 1, accentColor: ACCENT }} />
              <span style={{ ...S.mono, fontSize: 12, color: SUB, minWidth: 92, textAlign: "right" }}>{uhr(zeitpunkt)} / {uhr(dauer)}</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
              <span style={{ fontSize: 12, color: box ? WARN : MUTED }}>{box ? "Bereich gezogen:" : "Rahmen ins Bild ziehen, um einen Bereich zu wählen."}</span>
              {box && aktion && <button style={S.secondaryBtn} onClick={bereichUebernehmen}><Crop size={13} /> Als {bName(aktion, bereich)} von „{aktion.name}“</button>}
              {box && aktion && aktion.bereiche.length < MAX_BEREICHE && <button style={S.secondaryBtn} onClick={bereichDazu}><Plus size={13} /> Als weiteren Bereich von „{aktion.name}“</button>}
              {box && <NeueAktion def={def} onWahl={neueAktion} label="Neue Aktion mit diesem Bereich" />}
              <span style={{ flex: 1 }} />
              {masse && <span style={{ fontSize: 11, color: MUTED }}>{masse.b}×{masse.h}</span>}
            </div>
            {testen && (
              <div style={{ marginTop: 12, border: `1px solid ${LINE}`, borderRadius: 8, background: FELD, maxHeight: 160, overflow: "auto" }}>
                {treffer.length === 0 ? <div style={{ ...S.empty, padding: 10 }}>Video abspielen: Hier erscheint jede Aktion, die die Erkennung auslösen würde.</div>
                  : treffer.map((x) => (
                    <div key={x.n} onClick={() => springe(x.t)} style={{ display: "flex", gap: 10, padding: "5px 10px", borderBottom: `1px solid ${LINE}`, fontSize: 12, cursor: "pointer" }}>
                      <span style={{ ...S.mono, color: MUTED }}>{uhr(x.t)}</span><b style={{ color: OK }}>{x.name}</b><span style={{ color: SUB }}>{Math.round(x.wert * 100)}%{x.vorlage >= 0 ? ` · Frame ${x.vorlage + 1}` : ""}</span>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Aktionen */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <b style={{ fontSize: 14 }}>Aktionen</b><SpielChip spiel={def.id} />
          <span style={{ flex: 1 }} />
          <NeueAktion def={def} onWahl={neueAktion} label="Aktion" />
        </div>
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
          {sc.aktionen.length === 0 && <div style={{ ...S.empty, padding: 12 }}>Noch keine Aktionen. Mit „+ Aktion“ aus den Vorschlägen anlegen oder eine Datei importieren.</div>}
          {sc.aktionen.map((a) => {
            const w = wertVon(a.id), bereit = aktionBereit({ ...a, an: true }), zuletzt = letzteLive?.[a.id];
            const frames = a.bereiche.reduce((n, b) => n + b.vorlagen.length, 0), mitText = a.bereiche.some((b) => b.text);
            return (
              <div key={a.id} onClick={() => { setWahl(a.id); setBWahl(null); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: `1px solid ${LINE}`, fontSize: 13, cursor: "pointer", background: a.id === wahl ? "#2c2838" : "transparent", opacity: a.an ? 1 : 0.5 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: !bereit ? MUTED : zuletzt && Date.now() - zuletzt < 3000 ? OK : ACCENT, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                <span style={{ fontSize: 11, color: MUTED }}>{a.bereiche.length > 1 ? `${a.bereiche.length} Ber. · ` : ""}{frames} Fr.{mitText ? " · Text" : ""}</span>
                <Balken wert={w} schwelle={a.schwelle} />
              </div>
            );
          })}
        </div>
        {aktion && <AktionBearbeiten key={aktion.id} def={def} a={aktion} aendern={(fn) => aendern(aktion.id, fn)} entfernen={() => { setzeSpiel((s) => { s.aktionen = s.aktionen.filter((x) => x.id !== aktion.id); }); setWahl(null); }}
          bereich={bereich} waehleBereich={(id) => { setBWahl(id); setGelesen(null); }} aendernB={aendernB} bereichEntfernen={bereichEntfernen} teilWertVon={teilWertVon}
          frameDazu={frameDazu} kannFrame={!!masse} textLesen={textLesen} gelesen={gelesen} />}
        {sc.aufloesung && <p style={S.hint}>Bereiche gezogen bei {sc.aufloesung.b}×{sc.aufloesung.h}. Andere Seitenverhältnisse gleicht der Import über den Anker jedes Bereichs aus.</p>}
      </div>
    </div>
  );
}

// Ähnlichkeit als Balken mit Strich an der Schwelle
const Balken = ({ wert, schwelle }) => (
  <span title={wert != null ? `${Math.round(wert * 100)} % (Schwelle ${Math.round(schwelle * 100)} %)` : "kein Wert"} style={{ position: "relative", width: 60, height: 6, borderRadius: 3, background: "#14121a", flexShrink: 0 }}>
    {wert != null && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pct(Math.max(0, Math.min(1, wert))), borderRadius: 3, background: wert >= schwelle ? OK : ACCENT }} />}
    <span style={{ position: "absolute", left: pct(schwelle), top: -2, bottom: -2, width: 2, background: "#fff" }} />
  </span>
);

function NeueAktion({ def, onWahl, label }) {
  return (
    <select style={{ ...S.selectSm, width: "auto", background: ACCENT, border: "none", fontWeight: 700, cursor: "pointer" }} value="" onChange={(e) => {
      const v = e.target.value;
      if (v === "leer") onWahl(null); else if (v) onWahl(def.vorschlaege[Number(v)]);
    }}>
      <option value="">+ {label}</option>
      {def.vorschlaege.map((v, i) => <option key={i} value={i}>{v[0]}</option>)}
      <option value="leer">Eigene Aktion …</option>
    </select>
  );
}

function AktionBearbeiten({ def, a, aendern, entfernen, bereich: b, waehleBereich, aendernB, bereichEntfernen, teilWertVon, frameDazu, kannFrame, textLesen, gelesen }) {
  const ev = def.events.find((e) => e.id === a.event);
  const gruppen = [...new Set(def.events.map((e) => e.gruppe))];
  const mitSeite = def.teams.length === 2 && ev?.team && !ev?.spieler;
  return (
    <div style={{ border: `1px solid ${ACCENT}66`, borderRadius: 8, padding: 12, background: "#1f1c28" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input style={{ ...S.inputSm, fontWeight: 700 }} value={a.name} maxLength={60} onChange={(e) => aendern((x) => { x.name = e.target.value; })} />
        <Toggle checked={a.an} title="Aktion an/aus" onChange={(v) => aendern((x) => { x.an = v; })} />
        <button style={S.dangerBtn} title="Aktion löschen" onClick={() => confirm(`Aktion „${a.name}“ löschen?`) && entfernen()}><Trash2 size={13} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mitSeite ? "1fr 120px" : "1fr", gap: 8, marginBottom: 10 }}>
        <Field label="Event an die Regie">
          <select style={S.selectSm} value={a.event} onChange={(e) => aendern((x) => { x.event = e.target.value; })}>
            {gruppen.map((gr) => <optgroup key={gr} label={gr}>{def.events.filter((e) => e.gruppe === gr && e.id !== "match_start").map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</optgroup>)}
          </select>
        </Field>
        {mitSeite && <Field label="Team">
          <select style={S.selectSm} value={a.seite} onChange={(e) => aendern((x) => { x.seite = e.target.value; })}>
            <option value="eigen">eigenes</option><option value="gegner">Gegner</option>
          </select>
        </Field>}
      </div>
      <Field label={`Threshold: ${Math.round(a.schwelle * 100)} % Ähnlichkeit`} hint="Höher = strenger. Im Test zeigt der Balken, wie ähnlich jeder Frame ist.">
        <input type="range" min={0.5} max={0.99} step={0.01} value={a.schwelle} onChange={(e) => aendern((x) => { x.schwelle = Number(e.target.value); })} style={{ accentColor: ACCENT }} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: a.bereiche.length > 1 ? "1fr 110px" : "110px", gap: 8, marginTop: 10 }}>
        {a.bereiche.length > 1 && <Field label="Auslösen, wenn" hint="bei mehreren Bereichen">
          <select style={S.selectSm} value={a.modus} onChange={(e) => aendern((x) => { x.modus = e.target.value; })}>
            <option value="eines">ein Bereich passt</option><option value="alle">alle Bereiche gleichzeitig passen</option>
          </select>
        </Field>}
        <Field label="Pause (ms)" hint="bis zum nächsten Treffer">
          <input style={S.inputSm} type="number" min={200} max={60000} step={100} value={a.pause} onChange={(e) => aendern((x) => { x.pause = Math.max(200, Number(e.target.value) || 2000); })} />
        </Field>
      </div>

      {/* Bereiche (Auslöser): jeder mit eigenen Frames und/oder Text */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", margin: "14px 0 8px" }}>
        {a.bereiche.map((x, i) => {
          const w = teilWertVon(a, x);
          return (
            <button key={x.id} onClick={() => waehleBereich(x.id)} style={{ ...S.smallBtn, background: x.id === b.id ? ACCENT : "transparent", color: x.id === b.id ? "#fff" : SUB, borderStyle: bereichBereit(x) ? "solid" : "dashed" }}>
              Bereich {i + 1}{x.text ? " · Text" : ""}{w != null ? ` · ${Math.round(w * 100)}%` : ""}
            </button>
          );
        })}
        <span style={{ fontSize: 11, color: MUTED }}>{a.bereiche.length < MAX_BEREICHE ? "Weiterer Bereich: Rahmen ziehen, dann „Als weiteren Bereich“." : ""}</span>
        <span style={{ flex: 1 }} />
        {a.bereiche.length > 1 && <button style={S.dangerBtn} title="Diesen Bereich löschen" onClick={() => confirm(`Bereich ${a.bereiche.indexOf(b) + 1} von „${a.name}“ löschen?`) && bereichEntfernen(b.id)}><Trash2 size={13} /> Bereich</button>}
      </div>
      <Field label="Text muss dastehen (optional)" hint="Mehrere Wörter mit | trennen, z. B. ROUND WIN|RUNDE GEWONNEN">
        <div style={{ display: "flex", gap: 6 }}>
          <input style={S.inputSm} value={b.text} placeholder="leer = nur Bild" onChange={(e) => aendernB((x) => { x.text = e.target.value; })} />
          <button style={S.smallBtn} disabled={!kannFrame} title="Text im Bereich des aktuellen Frames lesen" onClick={textLesen}><Type size={13} /> Lesen</button>
        </div>
      </Field>
      {gelesen && <div style={{ fontSize: 12, marginTop: 6, color: gelesen.fehler ? ERR : SUB }}>
        {gelesen.laedt ? "lese …" : gelesen.fehler ? gelesen.fehler : <>Gelesen: <Kbd>{gelesen.text || "(nichts)"}</Kbd> {gelesen.text && <button style={S.smallBtn} onClick={() => aendernB((x) => { x.text = gelesen.text.replace(/\s+/g, " ").trim().slice(0, 120); })}>übernehmen</button>}</>}
      </div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <Field label="Anker waagrecht" hint="für andere Seitenverhältnisse">
          <select style={S.selectSm} value={b.anker.h} onChange={(e) => aendernB((x) => { x.anker = { ...x.anker, h: e.target.value }; })}>{ANKER_H.map((v) => <option key={v}>{v}</option>)}</select>
        </Field>
        <Field label="Anker senkrecht">
          <select style={S.selectSm} value={b.anker.v} onChange={(e) => aendernB((x) => { x.anker = { ...x.anker, v: e.target.value }; })}>{ANKER_V.map((v) => <option key={v}>{v}</option>)}</select>
        </Field>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 6px" }}>
        <b style={{ fontSize: 12 }}>Frames ({b.vorlagen.length}/{MAX_FRAMES})</b>
        <span style={{ flex: 1 }} />
        <button style={S.primaryBtn} disabled={!kannFrame} onClick={frameDazu}><ImagePlus size={14} /> Aktuellen Frame hinzufügen</button>
      </div>
      {b.vorlagen.length === 0 ? <div style={{ fontSize: 12, color: MUTED }}>{b.text ? "Nur Texterkennung." : "Noch kein Frame: zur passenden Stelle der Aufnahme spulen und hinzufügen."} Mehrere Frames erkennen Varianten, z. B. das Kill-Banner mit 1 bis 5 Kills.</div> : (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {b.vorlagen.map((v, i) => (
            <div key={i} style={{ position: "relative", border: `1px solid ${LINE}`, borderRadius: 4, overflow: "hidden", background: "#000" }}>
              {v.bild ? <img src={v.bild} alt={`Frame ${i + 1}`} style={{ display: "block", height: 44, maxWidth: 150 }} /> : <div style={{ height: 44, width: 60, fontSize: 10, color: MUTED, display: "flex", alignItems: "center", justifyContent: "center" }}>Frame {i + 1}</div>}
              <button title="Frame entfernen" onClick={() => aendernB((x) => { x.vorlagen.splice(i, 1); })} style={{ position: "absolute", top: 1, right: 1, background: "rgba(20,18,26,.85)", color: ERR, border: "none", borderRadius: 3, cursor: "pointer", fontSize: 11, lineHeight: 1, padding: "2px 4px" }}>×</button>
            </div>
          ))}
        </div>
      )}
      {def.id === "valorant" && a.event === "spike_planted" && <p style={S.hint}>Riot-Regel: nur ein einzelner Cue beim Legen, kein Countdown bis zur Explosion.</p>}
    </div>
  );
}
