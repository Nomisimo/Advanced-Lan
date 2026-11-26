import React, { useState, useEffect, useCallback } from "react";
import { S, ACCENT, LINE, SUB, MUTED, OK, WARN, ERR } from "./theme.js";
import { api } from "./api.js";
import Kopf from "./Kopf.jsx";
import { Section, Field, Toggle, Dot, KartenWahl, useKarten, TabLeiste, useTab, EventIcon, eventLabel, zeit } from "./ui.jsx";
import AppEinstellungen from "./AppEinstellungen.jsx";
import ScreenLeiste from "./regie/ScreenLeiste.jsx";
import { Editor } from "./regie/ScreenTab.jsx";
import { GRUPPE, DATEN_PORT } from "../core/stats-sync-cfg.js";
import { neuerScreen, screenVon, MAX_SCREENS, NAME_MAX } from "../core/stats-screens.js";
import { SPIEL_BY_ID } from "../core/spiele.js";
import { MonitorPlay, X, Radio, Copy, Plus, Pencil, Activity, LayoutGrid } from "lucide-react";

// Modus „Stats-Screen-PC“: zeigt die Stats-Screens der Regie als Fenster (Beamer, zweiter Bildschirm) und eigene Screens,
// die nur dieser PC hat. Layout, Stand und Events kommen per UDP von der Regie (Multicast, sonst Unicast), siehe core/stats-sync.js.
// Tabs: Screens (Verbindung, Fenster), Eigene Screens (Editor wie in der Regie), Daten (alles, was von der Regie ankommt)
const TABS = [["screens", "Screens", LayoutGrid], ["eigene", "Eigene Screens", Pencil], ["daten", "Daten", Activity]];
const LOG_MAX = 200;
const kopie = (o) => JSON.parse(JSON.stringify(o));

export default function StatsPcApp({ cfg: alles, mutate: mutateAlles, status, version, notify, modusWechseln }) {
  const cfg = alles.statspc;
  const st = status.statspc || {};
  const mutate = (fn) => mutateAlles((d) => fn(d.statspc));
  // Der Editor arbeitet auf { stats }: hier die eigenen Screens des Stats-PCs
  const eigeneMutate = useCallback((fn) => mutateAlles((d) => { const x = { stats: d.statspc.eigene }; fn(x); d.statspc.eigene = x.stats; }), [mutateAlles]);
  const [tab, setTab] = useTab("advancedlan_statspc_tab", TABS, "screens");
  const [log, setLog] = useState([]);
  useEffect(() => {
    api.regieLog().then((l) => setLog(l || []));
    return api.onRegieEvent((e) => setLog((l) => [e, ...l.filter((x) => x.id !== e.id)].slice(0, LOG_MAX)));
  }, []);
  const [zText, zFarbe] = st.fehler && !st.laeuft ? ["Fehler", ERR] : st.verbunden ? [st.layout ? "Verbunden" : st.laden != null ? `Verbunden, Layout lädt (${st.laden} %)` : "Verbunden, Layout lädt …", st.layout ? OK : WARN] : ["Sucht die Regie …", WARN];
  const eigene = cfg.eigene?.screens || [];
  // Screen der Regie als eigenen kopieren und gleich im Editor öffnen
  const kopieren = (id) => {
    const quelle = (alles.regie?.stats?.screens || []).find((x) => x.id === id && !x.eigen);
    if (!quelle || eigene.length >= MAX_SCREENS) return;
    const n = { ...neuerScreen(), name: `${quelle.name} (eigen)`.slice(0, NAME_MAX), b: quelle.b, h: quelle.h, layout: kopie(quelle.layout) };
    eigeneMutate((d) => { d.stats = { ...d.stats, aktiv: n.id, screens: [...(d.stats.screens || []), n] }; });
    setTab("eigene");
  };
  return (
    <div style={S.app}>
      <Kopf modus="STATS-SCREEN" version={version} modusWechseln={modusWechseln} meta={<>
        <span style={{ color: zFarbe }}>{zText}</span>
        {st.verbunden && st.regie && <span> mit {st.session ? `„${st.session}“` : "der Regie"} ({st.regie.ip})</span>}
      </>} />
      <TabLeiste tabs={TABS} tab={tab} setTab={setTab} marke={(k) => <>
        {k === "screens" && <Dot size={7} color={zFarbe} glow={st.verbunden} />}
        {k === "eigene" && eigene.length > 0 && <span style={{ ...S.badge, background: "#2f2c3a", color: SUB }}>{eigene.length}</span>}
      </>} />
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }} key={tab}>
        <main style={S.main}>
          {tab === "screens" && <>
            <Verbindung cfg={cfg} st={st} mutate={mutate} zText={zText} zFarbe={zFarbe} />
            <ScreenListe cfg={cfg} st={st} mutate={mutate} kopieren={kopieren} eigeneVoll={eigene.length >= MAX_SCREENS} bearbeiten={(id) => { eigeneMutate((d) => { d.stats = { ...d.stats, aktiv: id }; }); setTab("eigene"); }} />
            <AppEinstellungen cfg={alles} status={status} mutate={mutateAlles} notify={notify} />
          </>}
          {tab === "eigene" && <EigeneScreens alles={alles} eigene={cfg.eigene} st={st} status={status} log={log} mutate={eigeneMutate} />}
          {tab === "daten" && <Daten alles={alles} st={st} status={status} log={log} />}
        </main>
      </div>
    </div>
  );
}

function Verbindung({ cfg, st, mutate, zText, zFarbe }) {
  const karten = useKarten();
  return (
    <Section title="Verbindung zur Regie" subtitle="Die Regie schickt Layout, Spielstand und Events per UDP: an alle über Multicast, an diesen PC zusätzlich direkt (Unicast), wenn der Multicast hier nicht ankommt. Verlorene Pakete heilen sich von selbst, fehlende Teile eines Layouts fragt dieser PC nach."
      right={<span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: zFarbe }}><Dot color={zFarbe} glow={st.verbunden} /> {zText}</span>}>
      <div data-testid="statspc-status" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Wert label="Regie" wert={st.regie ? `${st.regie.name || "Regie"} · ${st.regie.ip}` : "noch keine"} />
        <Wert label="Weg" wert={st.weg === "multicast" ? "Multicast" : st.weg === "unicast" ? "Unicast (direkt)" : "–"} farbe={st.weg ? OK : MUTED} />
        <Wert label="Letztes Paket" wert={alter(st.letztes)} farbe={st.letztes != null && st.letztes < 2000 ? OK : WARN} />
        <Wert label="Layout" wert={st.layout ? "aktuell" : st.laden != null ? `lädt ${st.laden} %` : st.verbunden ? "wird geholt" : "–"} farbe={st.layout ? OK : MUTED} />
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
  );
}

function ScreenListe({ cfg, st, mutate, kopieren, eigeneVoll, bearbeiten }) {
  const fenster = (id) => !!st.ausgabe?.screens?.[id]?.fenster;
  const liste = st.screens || [];
  return (
    <Section title="Screens" subtitle="Die Screens der Regie und die eigenen dieses PCs. Fenster gehen als normale Fenster auf: auf einen Bildschirm oder Beamer ziehen, Doppelklick schaltet Vollbild. Stelle und Größe merkt sich jedes Fenster, offene Fenster gehen beim nächsten Start wieder auf."
      right={<Toggle checked={!!cfg.vollbildStart} label="Gleich als Vollbild öffnen" onChange={(v) => mutate((d) => { d.vollbildStart = v; })} />}>
      {!liste.length ? <div style={S.empty}>{st.verbunden ? "Layout wird geholt …" : "Noch keine Verbindung zur Regie. In der Regie unter Setup „Stats-Screen-PCs“ einschalten. Eigene Screens gehen auch ohne Regie (Tab „Eigene Screens“)."}</div> : (
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
          {liste.map((x) => (
            <div key={x.id} data-testid={`statspc-screen-${x.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderBottom: `1px solid ${LINE}`, background: "#1a1820", flexWrap: "wrap" }}>
              <Radio size={14} color={fenster(x.id) ? OK : SUB} />
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 700 }}>{x.name} <span style={{ ...S.badge, marginLeft: 6, background: x.eigen ? ACCENT + "33" : "#2f2c3a", color: x.eigen ? "#d8c4ff" : SUB }}>{x.eigen ? "eigen" : "Regie"}</span></div>
                <div style={{ fontSize: 11, color: SUB }}>{x.b}×{x.h} px</div>
              </div>
              {x.eigen
                ? <button style={S.smallBtn} onClick={() => bearbeiten(x.id)} title="Im Tab „Eigene Screens“ bearbeiten"><Pencil size={12} /> Bearbeiten</button>
                : <button style={S.smallBtn} disabled={eigeneVoll} onClick={() => kopieren(x.id)} data-testid={`statspc-kopie-${x.id}`} title="Als eigenen Screen kopieren und hier anpassen (der Screen der Regie bleibt, wie er ist)"><Copy size={12} /> Als eigenen anpassen</button>}
              <button style={fenster(x.id) ? { ...S.secondaryBtn, borderColor: ACCENT } : S.secondaryBtn} onClick={() => api.statsFenster(!fenster(x.id), x.id)} data-testid={`statspc-fenster-${x.id}`}>
                {fenster(x.id) ? <><X size={14} /> Fenster schließen</> : <><MonitorPlay size={14} /> Fenster öffnen</>}
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// Eigene Screens: Editor wie in der Regie, mit den Daten der Regie in der Vorschau
function EigeneScreens({ alles, eigene, st, status, log, mutate }) {
  const screens = eigene?.screens || [];
  const screen = screenVon(eigene, eigene?.aktiv);
  const ecfg = { stats: { ...eigene, an: true }, aktivesSpiel: alles.regie?.aktivesSpiel || "" };
  const rStatus = { ...(status.regie || {}), stats: st.ausgabe };
  const anlegen = () => { const n = neuerScreen({ name: `Eigener Screen ${screens.length + 1}` }); mutate((d) => { d.stats = { ...d.stats, aktiv: n.id, screens: [...(d.stats.screens || []), n] }; }); };
  return (
    <Section title="Eigene Screens" subtitle="Screens, die nur dieser PC zeigt: selbst bauen oder einen Screen der Regie kopieren (Tab „Screens“, „Als eigenen anpassen“) und hier ändern. Die Daten kommen weiter live von der Regie. Jede Änderung gilt sofort im Fenster des Screens.">
      {!screen ? (
        <div style={{ ...S.empty, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          Noch keine eigenen Screens.
          <button style={S.primaryBtn} onClick={anlegen} data-testid="eigen-neu"><Plus size={14} /> Eigenen Screen anlegen</button>
        </div>
      ) : <>
        <ScreenLeiste cfg={ecfg} mutate={mutate} status={rStatus} screen={screen} leerErlaubt />
        <Editor key={screen.id} cfg={ecfg} mutate={mutate} status={status.regie || {}} log={log} screen={screen} />
      </>}
    </Section>
  );
}

// Alles, was von der Regie ankommt: Empfang, Spiel und Stand, PCs, Events und die Rohdaten
function Daten({ alles, st, status, log }) {
  const r = status.regie || null;
  const spiel = SPIEL_BY_ID[r?.aktivesSpiel || st.aktivesSpiel];
  const pcs = r?.pcs || [];
  const namen = r?.namen || {};
  const screens = alles.regie?.stats?.screens?.filter((x) => !x.eigen) || [];
  return (
    <>
      <Section title="Empfang" subtitle="Was dieser PC von der Regie bekommt, live.">
        <div data-testid="daten-empfang" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <Wert label="Regie" wert={st.regie ? `${st.regie.name || "Regie"} · ${st.regie.ip}` : "–"} />
          <Wert label="Weg" wert={st.weg || "–"} farbe={st.weg ? OK : MUTED} />
          <Wert label="Letztes Paket" wert={alter(st.letztes)} />
          <Wert label="Pakete" wert={String(st.pakete ?? 0)} />
          <Wert label="Fremde verworfen" wert={String(st.verworfen ?? 0)} />
          <Wert label="Layout" wert={st.layout ? "aktuell" : st.laden != null ? `lädt ${st.laden} %` : "–"} farbe={st.layout ? OK : MUTED} />
        </div>
      </Section>
      <Section title="Spiel und Stand">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
          <Wert label="Session" wert={st.session || "–"} />
          <Wert label="Aktives Spiel" wert={spiel?.name || "–"} />
          <Wert label="Match" wert={r?.match || "–"} />
          <Wert label="Screens der Regie" wert={screens.length ? screens.map((x) => x.name).join(", ") : "–"} />
          {Object.entries(r?.zaehler || {}).slice(0, 8).map(([k, v]) => <Wert key={k} label={k} wert={String(v)} />)}
        </div>
        <Roh titel="Stand (stand)" daten={r?.stand} />
        <Roh titel="Statistik (statistik)" daten={r?.statistik} offen={false} />
      </Section>
      <Section title={`PCs (${pcs.length})`}>
        {!pcs.length ? <div style={S.empty}>Keine PCs gemeldet.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table data-testid="daten-pcs" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr>{["PC", "Spieler", "Team", "Spiel", "Verbunden"].map((h) => <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: SUB, borderBottom: `1px solid ${LINE}` }}>{h}</th>)}</tr></thead>
              <tbody>{pcs.map((p) => (
                <tr key={p.pcId}>
                  <td style={zelle}>{p.pcId}{p.sim ? " (Sim)" : ""}</td>
                  <td style={zelle}>{namen[p.pcId] || p.spieler || "–"}</td>
                  <td style={zelle}>{p.team || "–"}</td>
                  <td style={zelle}>{SPIEL_BY_ID[p.spiel]?.kurz || p.spiel || "–"}</td>
                  <td style={{ ...zelle, color: p.verbunden ? OK : MUTED }}>{p.verbunden ? "ja" : "nein"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Section>
      <Section title={`Events (${log.length})`} subtitle="Die letzten Events der Regie, neueste oben.">
        {!log.length ? <div style={S.empty}>Noch keine Events.</div> : (
          <div data-testid="daten-events" style={{ border: `1px solid ${LINE}`, borderRadius: 8, maxHeight: 360, overflow: "auto" }}>
            {log.slice(0, 100).map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderBottom: `1px solid ${LINE}`, fontSize: 12, opacity: e.verworfen ? 0.5 : 1 }}>
                <span style={{ color: MUTED, width: 64, flexShrink: 0 }}>{e.t ? zeit(e.t) : ""}</span>
                <EventIcon type={e.ev?.type} spiel={e.ev?.spiel} size={14} />
                <b style={{ whiteSpace: "nowrap" }}>{eventLabel(e.ev?.type, e.ev?.spiel)}</b>
                <span style={{ color: SUB, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[e.ev?.player, e.ev?.team, e.pcId].filter(Boolean).join(" · ")}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Rohdaten" subtitle="Alles genau so, wie es von der Regie kommt.">
        <Roh titel="Stand der Regie (status)" daten={r} offen={false} />
        <Roh titel="Einstellungen der Regie (Screens, Session, Spiele)" daten={alles.regie ? { session: alles.regie.session?.name, aktivesSpiel: alles.regie.aktivesSpiel, spiele: alles.regie.spiele, screens: screens.map(({ id, name, b, h, layout }) => ({ id, name, b, h, elemente: layout?.elemente?.length || 0 })) } : null} offen={false} />
        <Roh titel="Empfang (statspc)" daten={st} offen={false} />
      </Section>
    </>
  );
}

const zelle = { padding: "6px 8px", borderBottom: `1px solid ${LINE}` };
const alter = (ms) => (ms == null ? "–" : ms < 1000 ? `vor ${ms} ms` : `vor ${Math.round(ms / 1000)} s`);

function Roh({ titel, daten, offen = true }) {
  return (
    <details open={offen && daten != null} style={{ border: `1px solid ${LINE}`, borderRadius: 8, background: "#1a1820", marginBottom: 8 }}>
      <summary style={{ cursor: "pointer", padding: "8px 10px", fontSize: 12, fontWeight: 700, color: SUB }}>{titel}</summary>
      <pre style={{ margin: 0, padding: "8px 10px", fontSize: 11, lineHeight: 1.4, maxHeight: 320, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#d4d0de" }}>
        {daten == null ? "–" : JSON.stringify(daten, null, 2)}
      </pre>
    </details>
  );
}

const Wert = ({ label, wert, farbe }) => (
  <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: "8px 10px", background: "#1a1820", minWidth: 0 }}>
    <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 700, color: farbe || "#ece9f2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={wert}>{wert}</div>
  </div>
);

// Speichert erst beim Verlassen oder Enter
function TextFeld({ wert, setzen, placeholder, testid }) {
  const [v, setV] = useState(wert || "");
  useEffect(() => setV(wert || ""), [wert]);
  return <input data-testid={testid} style={S.inputSm} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)}
    onBlur={() => (v.trim() !== (wert || "") ? setzen(v.trim()) : null)} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />;
}
