import React, { useEffect, useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED, OK, WARN, FELD } from "./theme.js";
import { api } from "./api.js";
import { uiConfirm } from "./dialog.jsx";
import { ART_NAME, arten as showArten, showInfo, ungesichert, sauberName, dateiName } from "../core/show.js";
import { Clapperboard, X, Save, Upload, Download, FilePlus, Trash2, FolderOpen } from "lucide-react";

// Was eine Show enthält und was auf dem PC bleibt (siehe core/show.js)
const INHALT = {
  regie: "Ziele, Signale, genutzte Spiele, aktives Spiel, Session (Name, Passwort, Port), Netzwerkkarten und Game-Stats-Screen mit Layout. Die Ausgabe ist nach dem Laden immer aus.",
  gamepc: "Session-Wahl mit Passwort und Auto-Verbinden, Netzwerkkarte, Ports, Overlay und die Bilderkennung mit allen Aktionen. PC-ID und GSI-Token bleiben von diesem PC, so passt eine Show auf alle Game-PCs.",
};
const datum = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }); };

// Knopf im Kopf: Name der geladenen Show, Punkt bei ungespeicherten Änderungen
export function ShowKnopf({ cfg, ersetzen, notify }) {
  const [offen, setOffen] = useState(false);
  const arten = showArten(cfg.modus);
  const infos = arten.map((a) => showInfo(cfg, a));
  const namen = infos.map((i) => i.name).filter(Boolean);
  const geaendert = infos.some((i) => i.geaendert);
  return (
    <>
      <button onClick={() => setOffen(true)} title="Shows: leer laden, speichern, exportieren, importieren" data-testid="show-knopf"
        style={{ ...S.ghostBtn, display: "inline-flex", alignItems: "center", gap: 6, maxWidth: 260 }}>
        <Clapperboard size={14} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: namen.length ? "#fff" : SUB }}>{namen.length ? namen.join(" · ") : "Show"}</span>
        {geaendert && <span title="Ungespeicherte Änderungen" style={{ width: 7, height: 7, borderRadius: "50%", background: WARN, flexShrink: 0 }} />}
      </button>
      {offen && <ShowDialog cfg={cfg} arten={arten} ersetzen={ersetzen} notify={notify} zu={() => setOffen(false)} />}
    </>
  );
}

function ShowDialog({ cfg, arten, ersetzen, notify, zu }) {
  const [art, setArt] = useState(arten[0]);
  const [liste, setListe] = useState({});
  const [name, setName] = useState(() => showInfo(cfg, arten[0]).name);
  const info = showInfo(cfg, art);
  useEffect(() => { api.showsListe().then((l) => setListe(l || {})); }, []);
  useEffect(() => { setName(showInfo(cfg, art).name); }, [art, cfg.shows?.[art]?.name]);
  useEffect(() => { const k = (e) => e.key === "Escape" && zu(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);

  const shows = liste[art] || [];
  const fertig = (r, ok) => {
    if (r?.fehler) return notify(r.fehler, "err");
    if (r?.abgebrochen) return;
    if (r?.liste) setListe(r.liste);
    if (r?.cfg) ersetzen(r.cfg, r.status);
    if (r?.art && r.art !== art) setArt(r.art);
    if (ok) notify(ok);
  };
  // Vor dem Ersetzen fragen, wenn sonst Einstellungen verloren gehen
  const verwerfenOk = (a) => !ungesichert(cfg, a) || uiConfirm(`Die aktuellen ${ART_NAME[a]}-Einstellungen sind nicht als Show gespeichert und gehen verloren. Trotzdem fortfahren?`);
  const speichern = async () => {
    const n = sauberName(name) || ART_NAME[art];
    if (n !== info.name && shows.some((s) => s.datei === dateiName(n, art)) && !(await uiConfirm(`Es gibt schon eine Show „${n}“. Überschreiben?`))) return;
    const r = await api.showSpeichern(art, n);
    fertig(r, r?.ok && `Show „${r.name}“ gespeichert.`);
  };
  const laden = async (s) => { if (await verwerfenOk(art)) fertig(await api.showLaden(art, s.datei)); };
  const leer = async () => { if (await verwerfenOk(art)) fertig(await api.showLeer(art)); };
  const loeschen = async (s) => { if (await uiConfirm(`Show „${s.name}“ aus der Liste löschen?`)) fertig(await api.showLoeschen(art, s.datei), `Show „${s.name}“ gelöscht.`); };
  const exportieren = async () => { const r = await api.showExport(art, sauberName(name) || info.name); fertig(r, r?.ok && `Show exportiert: ${r.pfad}`); };
  const importieren = async () => {
    // Die Art steht erst in der Datei: bei ungespeicherten Einstellungen vorher fragen (Standalone: eine der beiden)
    const offen = arten.filter((a) => ungesichert(cfg, a));
    if (offen.length && !(await uiConfirm(`Eine importierte Show ersetzt die ${offen.length > 1 ? "Regie- oder Game-PC" : ART_NAME[offen[0]]}-Einstellungen. Nicht gespeicherte Änderungen gehen verloren. Weiter?`))) return;
    fertig(await api.showImport());
  };

  return (
    <div onClick={zu} style={{ position: "fixed", inset: 0, background: "rgba(8,6,12,.72)", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Shows" data-testid="show-dialog"
        style={{ background: "#23212c", border: `1px solid ${ACCENT}`, boxShadow: "0 0 30px rgba(157,92,255,.35)", borderRadius: 12, width: "min(680px, 100%)", maxHeight: "86vh", overflow: "auto", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Clapperboard size={18} color={ACCENT} />
          <h2 style={{ ...S.h2, margin: 0, fontSize: 20, flex: 1 }}>Shows</h2>
          <button onClick={zu} style={{ ...S.smallBtn, padding: 6 }} title="Schließen"><X size={14} /></button>
        </div>
        {arten.length > 1 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {arten.map((a) => {
              const i = showInfo(cfg, a);
              return <button key={a} onClick={() => setArt(a)} style={{ ...S.secondaryBtn, ...(a === art ? { borderColor: ACCENT, color: "#fff", background: ACCENT + "33" } : {}) }}>
                {ART_NAME[a]}-Show{i.name ? `: ${i.name}` : ""}{i.geaendert && <span style={{ width: 7, height: 7, borderRadius: "50%", background: WARN, display: "inline-block", marginLeft: 6 }} />}
              </button>;
            })}
          </div>
        )}
        <p style={S.subtitle}>{INHALT[art]}</p>

        <div className="sp-section-label">Aktuelle {ART_NAME[art]}-Show</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
          <input style={{ ...S.input, flex: 1, minWidth: 200 }} value={name} placeholder={`Name, z. B. „LAN Herbst ${new Date().getFullYear()}“`} maxLength={60}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && speichern()} aria-label="Name der Show" />
          <button style={S.primaryBtn} onClick={speichern} title="In der Show-Liste dieses PCs speichern"><Save size={14} /> Speichern</button>
          <button style={S.secondaryBtn} onClick={exportieren} title="Als Datei speichern, z. B. für einen anderen PC oder als Backup"><Upload size={14} /> Exportieren …</button>
        </div>
        <div style={{ fontSize: 12, marginBottom: 16, color: info.geaendert ? WARN : info.name ? OK : MUTED }}>
          {info.name ? (info.geaendert ? `„${info.name}“ geladen, ungespeicherte Änderungen` : `„${info.name}“ geladen, alles gespeichert`) : "Keine Show geladen"}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          <button style={S.secondaryBtn} onClick={leer} title="Alle Einstellungen dieses Modus auf Standard zurücksetzen"><FilePlus size={14} /> Leere Show laden</button>
          <button style={S.secondaryBtn} onClick={importieren} title={arten.length > 1 ? "Regie- oder Game-PC-Show aus einer Datei laden" : "Show aus einer Datei laden"}><Download size={14} /> Importieren …</button>
        </div>

        <div className="sp-section-label">Gespeicherte {ART_NAME[art]}-Shows</div>
        {!shows.length ? <div style={S.empty}>Noch keine. „Speichern“ legt die aktuelle Einrichtung hier ab.</div> : (
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
            {shows.map((s) => {
              const aktuell = s.name === info.name;
              return (
                <div key={s.datei} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${LINE}`, background: aktuell ? ACCENT + "14" : FELD }}>
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}{aktuell && <span style={{ color: ACCENT, fontWeight: 400, fontSize: 12 }}> · geladen</span>}</span>
                  <span style={{ fontSize: 11, color: SUB }}>{datum(s.gespeichert)}</span>
                  <button style={S.smallBtn} onClick={() => laden(s)}><FolderOpen size={12} /> Laden</button>
                  <button style={S.dangerBtn} onClick={() => loeschen(s)} title="Aus der Liste löschen"><Trash2 size={12} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
