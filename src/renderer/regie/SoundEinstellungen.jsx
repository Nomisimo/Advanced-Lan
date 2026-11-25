// Tab „Stats-Screen“ → Sound: Sounds bei Events abspielen, nach Event sortiert, jeder einzeln an/aus, Ausgabegerät wählbar.
import React, { useEffect, useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED, WARN } from "../theme.js";
import { Section, Field, Toggle } from "../ui.jsx";
import { api } from "../api.js";
import { SPIEL_BY_ID } from "../../core/spiele.js";
import { migrateSound, dateienAufnehmen, nachEvent } from "../../core/sound.js";
import { abspielen, stoppen, ausgabeGeraete } from "./sound-player.js";
import { FolderOpen, FilePlus2, Play, Square, Trash2, Volume2, RefreshCw } from "lucide-react";

export default function SoundEinstellungen({ cfg, mutate, notify }) {
  const sound = migrateSound(cfg.sound);
  const genutzt = Object.keys(SPIEL_BY_ID).filter((id) => cfg.spiele?.[id] !== false);
  const [spiel, setSpiel] = useState(genutzt.includes(cfg.aktivesSpiel) ? cfg.aktivesSpiel : genutzt[0] || "valorant");
  const [geraete, setGeraete] = useState([]);
  const events = SPIEL_BY_ID[spiel]?.events || [];
  const label = (id) => (id ? events.find((e) => e.id === id)?.label || id : "Keinem Event zugeordnet");

  const laden = () => ausgabeGeraete().then(setGeraete);
  useEffect(() => { laden(); navigator.mediaDevices?.addEventListener?.("devicechange", laden); return () => navigator.mediaDevices?.removeEventListener?.("devicechange", laden); }, []);

  const setzen = (patch) => mutate((d) => { d.sound = { ...migrateSound(d.sound), ...patch }; });
  const dateiAendern = (id, patch) => mutate((d) => { const s = migrateSound(d.sound); s.dateien = s.dateien.map((x) => (x.id === id ? { ...x, ...patch } : x)); d.sound = s; });
  const eventAlle = (event, an) => mutate((d) => { const s = migrateSound(d.sound); s.dateien = s.dateien.map((x) => (x.spiel === spiel && x.event === event ? { ...x, an } : x)); d.sound = s; });
  const entfernen = (filter) => mutate((d) => { const s = migrateSound(d.sound); s.dateien = s.dateien.filter((x) => !filter(x)); d.sound = s; });

  const aufnehmen = async (r, event) => {
    if (!r || r.abbruch) return;
    if (r.fehler) return notify(r.fehler, "err");
    const gefunden = (r.dateien || []).map((f) => (event !== undefined ? { ...f, event } : f));
    if (!gefunden.length) return notify("Keine Audiodateien gefunden (WAV, MP3, OGG, M4A, FLAC).", "err");
    const { neu } = dateienAufnehmen(sound, spiel, gefunden);
    mutate((d) => { const { neu: _, ...s } = dateienAufnehmen(d.sound, spiel, gefunden); d.sound = s; });
    notify(`${gefunden.length} Datei(en) gefunden, ${neu} neu. Neue Sounds sind aus: einzeln einschalten.`);
  };
  const testen = (d) => abspielen(d, sound).catch((f) => notify(f.message, "err"));

  const gruppen = nachEvent(sound, spiel);
  const geraetFehlt = sound.geraet && geraete.length && !geraete.some((g) => g.id === sound.geraet);

  return (
    <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Volume2 size={16} /> Sound</span>}
      subtitle="Spielt beim Event automatisch einen Sound ab, auf dem gewählten Ausgang (z. B. Dante Virtual Soundcard). Die Dateien bleiben auf diesem PC, die App liefert keine mit. Ordner wählen: Unterordner mit dem Namen eines Events (kill, ace, spike_planted …) werden automatisch zugeordnet. Mehrere eingeschaltete Sounds je Event: einer davon zufällig."
      right={<Toggle checked={sound.an} onChange={(v) => setzen({ an: v })} label="Sounds an" />}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) auto", gap: 12, alignItems: "end" }}>
        <Field label="Ausgabegerät">
          <div style={{ display: "flex", gap: 6 }}>
            <select style={S.selectSm} value={sound.geraet} data-testid="sound-geraet"
              onChange={(e) => setzen({ geraet: e.target.value, geraetName: geraete.find((g) => g.id === e.target.value)?.name || "" })}>
              <option value="">Standardgerät des Systems</option>
              {geraete.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              {geraetFehlt && <option value={sound.geraet}>{sound.geraetName || "Gewähltes Gerät"} (nicht angeschlossen)</option>}
            </select>
            <button style={S.smallBtn} title="Geräteliste neu laden" onClick={laden}><RefreshCw size={12} /></button>
          </div>
        </Field>
        <Field label={`Lautstärke ${Math.round(sound.lautstaerke * 100)} %`}>
          <input type="range" min={0} max={100} value={Math.round(sound.lautstaerke * 100)} onChange={(e) => setzen({ lautstaerke: Number(e.target.value) / 100 })} style={{ width: "100%", accentColor: ACCENT }} />
        </Field>
        <button style={S.smallBtn} onClick={stoppen} title="Alle laufenden Sounds stoppen"><Square size={12} /> Stopp</button>
      </div>
      {geraetFehlt && <p style={{ ...S.hint, color: WARN }}>Das gewählte Gerät „{sound.geraetName || "?"}“ ist gerade nicht da. Sounds laufen erst wieder, wenn es angeschlossen ist, oder auf einem anderen Gerät.</p>}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
        <Toggle checked={sound.nurScharf} onChange={(v) => setzen({ nurScharf: v })} label="Nur bei scharfer Ausgabe (wie die OSC-Befehle)" />
        <Toggle checked={sound.abbrechen} onChange={(v) => setzen({ abbrechen: v })} label="Neuer Sound beendet den laufenden" />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
        <span style={{ fontSize: 12, color: SUB }}>Spiel:</span>
        {genutzt.map((id) => <button key={id} style={{ ...S.smallBtn, ...(id === spiel ? { borderColor: ACCENT, color: "#fff" } : { color: SUB }) }} onClick={() => setSpiel(id)}>{SPIEL_BY_ID[id].name}</button>)}
        <span style={{ flex: 1 }} />
        <button style={S.primaryBtn} data-testid="sound-ordner" onClick={async () => aufnehmen(await api.soundOrdner())}><FolderOpen size={14} /> Ordner wählen</button>
        <button style={S.smallBtn} onClick={async () => aufnehmen(await api.soundDateien())}><FilePlus2 size={12} /> Dateien</button>
      </div>

      {!gruppen.length && <p style={S.hint}>Für {SPIEL_BY_ID[spiel]?.name} sind noch keine Sounds da. „Ordner wählen“ und z. B. den Ordner sounds/valorant nehmen.</p>}
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {gruppen.map(({ event, dateien }) => {
          const an = dateien.filter((d) => d.an).length;
          return (
            <div key={event || "_"} style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: "8px 10px", background: "#1a1820" }} data-testid={`sound-event-${event || "ohne"}`}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <b style={{ fontSize: 13, color: event ? "#fff" : WARN }}>{label(event)}</b>
                <span style={{ fontSize: 11, color: MUTED }}>{event ? `${event} · ` : ""}{an} von {dateien.length} an</span>
                <span style={{ flex: 1 }} />
                {event && <button style={S.smallBtn} onClick={() => eventAlle(event, an < dateien.length)}>{an < dateien.length ? "Alle an" : "Alle aus"}</button>}
                {event && <button style={S.smallBtn} title="Weitere Dateien für dieses Event" onClick={async () => aufnehmen(await api.soundDateien(), event)}><FilePlus2 size={12} /></button>}
              </div>
              {dateien.map((d) => (
                <div key={d.id} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) 170px auto auto", gap: 8, alignItems: "center", padding: "3px 0", fontSize: 12 }}>
                  <Toggle checked={d.an} disabled={!d.event} onChange={(v) => dateiAendern(d.id, { an: v })} label="" title={d.event ? "Bei diesem Event abspielen" : "Erst einem Event zuordnen"} />
                  <span title={d.pfad} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: d.an ? "#fff" : SUB }}>{d.name}</span>
                  <select style={{ ...S.selectSm, fontSize: 11, padding: "3px 6px" }} value={d.event} onChange={(e) => dateiAendern(d.id, { event: e.target.value, an: e.target.value ? d.an : false })}>
                    <option value="">– kein Event –</option>
                    {events.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                  <button style={S.smallBtn} title="Probehören auf dem gewählten Gerät" onClick={() => testen(d)}><Play size={12} /></button>
                  <button style={S.smallBtn} title="Aus der Liste entfernen (Datei bleibt)" onClick={() => entfernen((x) => x.id === d.id)}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {gruppen.length > 0 && <button style={{ ...S.smallBtn, marginTop: 10 }} onClick={() => entfernen((x) => x.spiel === spiel)}><Trash2 size={12} /> Alle Sounds von {SPIEL_BY_ID[spiel]?.name} entfernen</button>}
    </Section>
  );
}
