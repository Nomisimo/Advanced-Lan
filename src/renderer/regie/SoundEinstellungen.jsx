// Tab „Ziele“ → Local Sound: Ziele, die auf diesem Regie-PC Audiodateien abspielen (Ausgabegerät, Lautstärke),
// und die Sound-Bibliothek, aus der die Befehle „Sound abspielen“ im Tab „Signale“ ihre Dateien nehmen.
import React, { useEffect, useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED, WARN } from "../theme.js";
import { Section, Field, Toggle, ZielBadge } from "../ui.jsx";
import { api } from "../api.js";
import { SPIEL_BY_ID } from "../../core/spiele.js";
import { migrateSound, dateienAufnehmen, nachEvent, zielEinstellung } from "../../core/sound.js";
import { abspielen, stoppen, ausgabeGeraete } from "./sound-player.js";
import { FolderOpen, FilePlus2, Play, Square, Trash2, Volume2, RefreshCw, Send } from "lucide-react";

function useGeraete() {
  const [geraete, setGeraete] = useState([]);
  const laden = () => ausgabeGeraete().then(setGeraete);
  useEffect(() => { laden(); navigator.mediaDevices?.addEventListener?.("devicechange", laden); return () => navigator.mediaDevices?.removeEventListener?.("devicechange", laden); }, []);
  return [geraete, laden];
}

// Ein Ziel „Local Sound“: Name, Ausgabegerät, Lautstärke, abbrechen
function SoundZiel({ t, n, geraete, laden, setZiel, loeschen, notify }) {
  const e = zielEinstellung(t);
  const opt = (patch) => setZiel(t.id, (z) => { z.optionen = { ...(z.optionen || {}), ...patch }; });
  const fehlt = e.geraet && geraete.length && !geraete.some((g) => g.id === e.geraet);
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: "10px 12px", background: "#1a1820" }} data-testid="sound-ziel">
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.8fr) minmax(0,1.4fr) minmax(0,1fr) auto", gap: 12, alignItems: "end" }}>
        <Field label={<span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><ZielBadge typ="sound" /> Name</span>}>
          <input style={S.inputSm} value={t.name} placeholder="Local Sound" onChange={(ev) => setZiel(t.id, (z) => { z.name = ev.target.value; })} />
        </Field>
        <Field label="Ausgabegerät">
          <div style={{ display: "flex", gap: 6 }}>
            <select style={S.selectSm} value={e.geraet} data-testid="sound-geraet"
              onChange={(ev) => opt({ geraet: ev.target.value, geraetName: geraete.find((g) => g.id === ev.target.value)?.name || "" })}>
              <option value="">Standardgerät des Systems</option>
              {geraete.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              {fehlt && <option value={e.geraet}>{e.geraetName || "Gewähltes Gerät"} (nicht angeschlossen)</option>}
            </select>
            <button style={S.smallBtn} title="Geräteliste neu laden" onClick={laden}><RefreshCw size={12} /></button>
          </div>
        </Field>
        <Field label={`Lautstärke ${Math.round(e.lautstaerke * 100)} %`}>
          <input type="range" min={0} max={100} value={Math.round(e.lautstaerke * 100)} onChange={(ev) => opt({ lautstaerke: String(ev.target.value) })} style={{ width: "100%", accentColor: ACCENT }} />
        </Field>
        <div style={{ display: "flex", gap: 6, whiteSpace: "nowrap" }}>
          <button style={S.smallBtn} title="Testton auf diesem Gerät" onClick={async () => { const r = await api.zielTesten(t.id); r.ok ? notify(`Testton auf ${e.geraetName || "dem Standardgerät"}`) : notify(r.fehler, "err"); }}><Send size={12} /> Test</button>
          <button style={S.smallBtn} onClick={stoppen} title="Alle laufenden Sounds stoppen"><Square size={12} /></button>
          <button style={S.dangerBtn} onClick={() => loeschen(t)} title="Ziel löschen"><Trash2 size={12} /></button>
        </div>
      </div>
      {fehlt && <p style={{ ...S.hint, color: WARN }}>Das Gerät „{e.geraetName || "?"}“ ist gerade nicht da. Sounds laufen erst wieder, wenn es angeschlossen ist, oder auf einem anderen Gerät.</p>}
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 8, fontSize: 12, color: SUB }}>
        <Toggle checked={e.abbrechen} onChange={(v) => opt({ abbrechen: v ? "ja" : "nein" })} label="Neuer Sound beendet den laufenden" />
        <span style={{ flex: 1 }} />
        <span>{n ? `${n} Befehl(e) in Signale` : "Noch in keinem Signal: im Tab „Signale“ ein Event wählen, Ziel „" + (t.name || "Local Sound") + "“, Befehl „Sound abspielen“"}</span>
      </div>
    </div>
  );
}

// Sound-Bibliothek: Dateien je Spiel, nach Ordner einem Event zugeordnet (Vorschlag im Tab „Signale“)
function Bibliothek({ cfg, mutate, notify, probe }) {
  const sound = migrateSound(cfg.sound);
  const genutzt = Object.keys(SPIEL_BY_ID).filter((id) => cfg.spiele?.[id] !== false);
  const [spiel, setSpiel] = useState(genutzt.includes(cfg.aktivesSpiel) ? cfg.aktivesSpiel : genutzt[0] || "valorant");
  const events = SPIEL_BY_ID[spiel]?.events || [];
  const label = (id) => (id ? events.find((e) => e.id === id)?.label || id : "Keinem Event zugeordnet");
  const dateiAendern = (id, patch) => mutate((d) => { const s = migrateSound(d.sound); s.dateien = s.dateien.map((x) => (x.id === id ? { ...x, ...patch } : x)); d.sound = s; });
  const entfernen = (filter) => mutate((d) => { const s = migrateSound(d.sound); s.dateien = s.dateien.filter((x) => !filter(x)); d.sound = s; });
  const aufnehmen = async (r, event) => {
    if (!r || r.abbruch) return;
    if (r.fehler) return notify(r.fehler, "err");
    const gefunden = (r.dateien || []).map((f) => (event !== undefined ? { ...f, event } : f));
    if (!gefunden.length) return notify("Keine Audiodateien gefunden (WAV, MP3, OGG, M4A, FLAC).", "err");
    const { neu } = dateienAufnehmen(sound, spiel, gefunden);
    mutate((d) => { const { neu: _, ...s } = dateienAufnehmen(d.sound, spiel, gefunden); d.sound = s; });
    notify(`${gefunden.length} Datei(en) gefunden, ${neu} neu. Im Tab „Signale“ mit „Sound abspielen“ einem Event geben.`);
  };
  const gruppen = nachEvent(sound, spiel);
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <b style={{ fontSize: 13 }}>Sound-Bibliothek</b>
        <span style={{ fontSize: 12, color: SUB }}>Spiel:</span>
        {genutzt.map((id) => <button key={id} style={{ ...S.smallBtn, ...(id === spiel ? { borderColor: ACCENT, color: "#fff" } : { color: SUB }) }} onClick={() => setSpiel(id)}>{SPIEL_BY_ID[id].name}</button>)}
        <span style={{ flex: 1 }} />
        <button style={S.primaryBtn} data-testid="sound-ordner" onClick={async () => aufnehmen(await api.soundOrdner())}><FolderOpen size={14} /> Ordner wählen</button>
        <button style={S.smallBtn} onClick={async () => aufnehmen(await api.soundDateien())}><FilePlus2 size={12} /> Dateien</button>
      </div>
      <p style={S.hint}>Die Dateien bleiben auf diesem PC, die App liefert keine mit. Unterordner mit dem Namen eines Events (kill, ace, spike_planted …) werden zugeordnet: „Sound abspielen“ schlägt dann diese Dateien vor.</p>
      {!gruppen.length && <p style={S.hint}>Für {SPIEL_BY_ID[spiel]?.name} sind noch keine Sounds da. „Ordner wählen“ und z. B. den Ordner sounds/valorant nehmen.</p>}
      <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
        {gruppen.map(({ event, dateien }) => (
          <div key={event || "_"} style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: "8px 10px", background: "#1a1820" }} data-testid={`sound-event-${event || "ohne"}`}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <b style={{ fontSize: 13, color: event ? "#fff" : WARN }}>{label(event)}</b>
              <span style={{ fontSize: 11, color: MUTED }}>{event ? `${event} · ` : ""}{dateien.length} Datei(en)</span>
              <span style={{ flex: 1 }} />
              {event && <button style={S.smallBtn} title="Weitere Dateien für dieses Event" onClick={async () => aufnehmen(await api.soundDateien(), event)}><FilePlus2 size={12} /></button>}
            </div>
            {dateien.map((d) => (
              <div key={d.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 170px auto auto", gap: 8, alignItems: "center", padding: "3px 0", fontSize: 12 }}>
                <span title={d.pfad} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                <select style={{ ...S.selectSm, fontSize: 11, padding: "3px 6px" }} value={d.event} onChange={(e) => dateiAendern(d.id, { event: e.target.value })}>
                  <option value="">– kein Event –</option>
                  {events.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                </select>
                <button style={S.smallBtn} title="Probehören auf dem Gerät des ersten Local-Sound-Ziels" onClick={() => probe(d)}><Play size={12} /></button>
                <button style={S.smallBtn} title="Aus der Bibliothek entfernen (Datei bleibt)" onClick={() => entfernen((x) => x.id === d.id)}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        ))}
      </div>
      {gruppen.length > 0 && <button style={{ ...S.smallBtn, marginTop: 10 }} onClick={() => entfernen((x) => x.spiel === spiel)}><Trash2 size={12} /> Alle Sounds von {SPIEL_BY_ID[spiel]?.name} entfernen</button>}
    </div>
  );
}

export default function LocalSound({ cfg, mutate, notify, setZiel, loeschen, nutzung, anlegen }) {
  const [geraete, laden] = useGeraete();
  const ziele = cfg.targets.filter((t) => t.typ === "sound");
  const probe = (d) => abspielen(d, zielEinstellung(ziele[0])).catch((f) => notify(f.message, "err"));
  return (
    <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Volume2 size={16} /> Local Sound</span>}
      subtitle="Sounds laufen wie die anderen Befehle: im Tab „Signale“ je Event „Sound abspielen“ mit Datei, Team- und Seiten-Filter. Sie spielen bei scharfer Ausgabe, der Test-Knopf immer. Mehrere Dateien in einem Befehl: eine davon zufällig."
      right={<button style={S.smallBtn} onClick={anlegen}><Volume2 size={12} /> Weiteres Ausgabegerät</button>}>
      {!ziele.length
        ? <div style={S.empty}>Noch kein Ziel „Local Sound“. <button style={{ ...S.primaryBtn, marginLeft: 8 }} onClick={anlegen} data-testid="sound-ziel-anlegen">Local Sound anlegen</button></div>
        : <div style={{ display: "grid", gap: 10 }}>{ziele.map((t) => <SoundZiel key={t.id} t={t} n={nutzung(cfg, t.id)} geraete={geraete} laden={laden} setZiel={setZiel} loeschen={loeschen} notify={notify} />)}</div>}
      <Bibliothek cfg={cfg} mutate={mutate} notify={notify} probe={probe} />
    </Section>
  );
}
