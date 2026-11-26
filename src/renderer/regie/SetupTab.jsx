import React from "react";
import { S, LINE, SUB, MUTED, OK, WARN, ERR } from "../theme.js";
import { Section, Check, Field, Toggle, Dot, KartenWahl, useKarten } from "../ui.jsx";
import { GRUPPE, DATEN_PORT } from "../../core/stats-sync-cfg.js";
import { SPIELE } from "../../core/spiele.js";
import { mehrfachModus } from "../../core/events.js";

// Welche Spiele die Regie nutzt. Nur diese erscheinen in „Control“ und „Signale“.
function Spiele({ cfg, mutate, notify }) {
  const umschalten = (id, an) => mutate((d) => {
    const neu = { ...d.spiele, [id]: an };
    if (!Object.values(neu).some(Boolean)) return notify("Mindestens ein Spiel muss genutzt werden.", "warn");
    d.spiele = neu;
    if (!neu[d.aktivesSpiel]) d.aktivesSpiel = Object.keys(neu).find((k) => neu[k]);
  });
  return (
    <Section title="Spiele">
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
        {SPIELE.map((s) => {
          const an = !!cfg.spiele?.[s.id];
          return (
            <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderBottom: `1px solid ${LINE}`, cursor: "pointer", background: an ? s.farbe + "10" : "transparent" }}>
              <input type="checkbox" checked={an} onChange={(e) => umschalten(s.id, e.target.checked)} style={{ accentColor: s.farbe, width: 16, height: 16 }} />
              <span style={{ fontWeight: 800, color: an ? s.farbe : MUTED, minWidth: 44, letterSpacing: 0.5 }}>{s.kurz}</span>
              <span style={{ flex: 1, fontWeight: 600, color: an ? "#fff" : SUB }}>{s.name}</span>
              <span style={{ fontSize: 12, color: s.quelle ? SUB : WARN }}>{s.quelle || "noch keine Datenquelle"}</span>
              <span style={{ fontSize: 12, color: MUTED, minWidth: 70, textAlign: "right" }}>{s.events.length} Events</span>
            </label>
          );
        })}
      </div>
    </Section>
  );
}

function RegieCheck({ cfg, status, standalone }) {
  const ses = status.session;
  const punkte = [
    // Standalone: das Spiel läuft hier absichtlich, die Session ist nur für zusätzliche Game-PCs
    ...(standalone ? [] : [{ label: "Kein Spiel auf diesem PC", ok: !status.spielAufRegie, detail: status.spielAufRegie ? `läuft: ${status.spielAufRegie}` : "ok" }]),
    standalone ? { label: "Session für weitere PCs", ok: ses.offen, warn: true, detail: ses.offen ? `„${cfg.session.name}“ auf Port ${ses.port}` : "optional, zu" }
      : { label: "Session offen", ok: ses.offen, detail: ses.offen ? `„${cfg.session.name}“ auf Port ${ses.port}` : ses.fehler || "geschlossen" },
    { label: "Ziel eingetragen", ok: cfg.targets.some((t) => t.host && t.port), detail: `${cfg.targets.filter((t) => t.host && t.port).length} Ziel(e)` },
    { label: "Aktives Spiel hat eine Datenquelle", ok: !!SPIELE.find((s) => s.id === cfg.aktivesSpiel)?.quelle, detail: SPIELE.find((s) => s.id === cfg.aktivesSpiel)?.name },
    ...(SPIELE.find((s) => s.id === cfg.aktivesSpiel)?.bild ? [{ label: "Quelle auf den Game-PCs eingerichtet", ok: false, warn: true, detail: cfg.aktivesSpiel === "lol" ? "LoL: Live Client Data API läuft von selbst, Shots Fired und Bilderkennung optional" : "Shots Fired (Overwolf) auf jedem Game-PC, Bilderkennung nur für den Rest" }] : []),
    { label: "Ausgabe an", ok: !!cfg.armed, warn: true, detail: cfg.armed ? "an" : "aus (nach jedem Start)" },
  ];
  const offen = punkte.filter((p) => !p.ok && !p.warn).length;
  return (
    <Section title="Check" right={<span style={{ fontSize: 12, fontWeight: 700, color: offen ? WARN : OK }}>{offen ? `${offen} offen` : "Alles bereit"}</span>}>
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>{punkte.map((p) => <Check key={p.label} {...p} />)}</div>
    </Section>
  );
}

export default function SetupTab(props) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, alignItems: "start" }}>
        <Spiele {...props} />
        <RegieCheck {...props} />
      </div>
      <Mehrfach {...props} />
      <StatsPcs {...props} />
    </>
  );
}

// Stats-Screen-PCs: eigene PCs im Modus „Stats-Screen“ bekommen Layout, Stand und Events per UDP (core/stats-sync.js)
function StatsPcs({ cfg, mutate, status }) {
  const s = cfg.statsSync || {}, st = status.statsSync || {};
  const karten = useKarten();
  const setzen = (patch) => mutate((d) => { d.statsSync = { ...d.statsSync, ...patch }; });
  const liste = st.empfaenger || [];
  const farbe = !s.an ? MUTED : st.fehler && !st.laeuft ? ERR : st.laeuft ? OK : WARN;
  return (
    <Section title="Stats-Screen-PCs" subtitle="Weitere PCs zeigen die Stats-Screens (Modus „Stats-Screen“ beim Start der App wählen). Die Regie schickt jede Änderung und jedes Event sofort per UDP: über Multicast an alle, direkt (Unicast) an jeden Stats-PC, der den Multicast nicht bekommt. Der komplette Stand kommt jede Sekunde, so heilen verlorene Pakete von selbst."
      right={<Toggle checked={!!s.an} label="Senden" onChange={(v) => setzen({ an: v })} />}>
      <div data-testid="statssync" style={{ opacity: s.an ? 1 : 0.55 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
          <Field label="Netzwerkkarte" style={{ width: 260 }}>
            <KartenWahl karten={karten} wert={s.netz} onChange={(v) => setzen({ netz: v })} leer="Automatisch" />
          </Field>
          <Field label="Multicast-Gruppe" style={{ width: 150 }}>
            <input style={S.inputSm} defaultValue={s.gruppe} key={s.gruppe} placeholder={GRUPPE} onBlur={(e) => e.target.value.trim() !== s.gruppe && setzen({ gruppe: e.target.value.trim() })} />
          </Field>
          <Field label="Port" hint={`Stats-PCs ${s.port || DATEN_PORT}, Regie ${(s.port || DATEN_PORT) + 1} (UDP)`} style={{ width: 160 }}>
            <input style={S.inputSm} defaultValue={s.port} key={s.port} placeholder={String(DATEN_PORT)} onBlur={(e) => Number(e.target.value) !== s.port && setzen({ port: Number(e.target.value) })} />
          </Field>
          <div style={{ fontSize: 12, color: farbe, paddingBottom: 7, display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Dot color={farbe} glow={st.laeuft} /> {!s.an ? "aus" : st.laeuft ? `sendet an ${st.gruppe}:${st.port}${st.ip ? ` über ${st.ip}` : ""}` : st.fehler || "startet …"}
          </div>
        </div>
        {st.laeuft && st.fehler && <div style={{ fontSize: 12, color: WARN, marginBottom: 8 }}>{st.fehler}</div>}
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
          {!liste.length ? <div style={{ padding: "10px 12px", fontSize: 12, color: MUTED }}>Noch kein Stats-PC angemeldet.</div> : liste.map((x) => (
            <div key={x.ip + x.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderBottom: `1px solid ${LINE}`, fontSize: 12 }}>
              <Dot color={OK} glow />
              <b style={{ minWidth: 140 }}>{x.name}</b>
              <span style={{ color: SUB, minWidth: 110 }}>{x.ip}</span>
              <span style={{ color: x.multicast ? OK : WARN }}>{x.multicast ? "Multicast" : "Unicast (Multicast kommt nicht an)"}</span>
              <span style={{ flex: 1 }} />
              <span style={{ color: x.layout ? OK : WARN }}>{x.layout ? "Layout aktuell" : "Layout wird geholt"}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// Mehrfach gemeldete Events: dieselbe Meldung von mehreren PCs (z. B. Runde gewonnen von allen 10) zählt normal einmal,
// der Rest erscheint im Log als „verworfen: doppelt“. Je Event umstellbar (core/events.js Dedupe, core/regie.js pcEvent).
const MEHRFACH_TEXT = {
  standard: "Einmal (Standard)",
  pc: "Einmal je PC",
  team: "Nur PCs im Team",
  alle: "Alle durchlassen",
};
function Mehrfach({ cfg, mutate }) {
  const genutzt = SPIELE.filter((s) => cfg.spiele?.[s.id]);
  const [spielId, setSpiel] = React.useState(cfg.aktivesSpiel);
  const spiel = genutzt.find((s) => s.id === spielId) || genutzt[0];
  if (!spiel) return null;
  const setzen = (sp, type, modus) => mutate((d) => {
    const m = { ...(d.mehrfach || {}) }, x = { ...(m[sp] || {}) };
    if (modus === "standard") delete x[type]; else x[type] = modus;
    if (Object.keys(x).length) m[sp] = x; else delete m[sp];
    d.mehrfach = m;
  });
  const geaendert = (sp) => Object.keys(cfg.mehrfach?.[sp] || {}).length;
  const alleZurueck = () => mutate((d) => { const m = { ...(d.mehrfach || {}) }; delete m[spiel.id]; d.mehrfach = m; });
  // Match-MVP löst die Regie selbst aus, das kommt nie von mehreren PCs
  const events = spiel.events.filter((e) => !e.mvp);
  return (
    <Section title="Mehrfach gemeldete Events"
      subtitle="Melden mehrere PCs dasselbe Event kurz hintereinander (gleiche Runde, gleicher Spieler, gleiches Team), zählt die Regie es normal nur einmal und verwirft den Rest als „doppelt“: 8 Sekunden für Runden-, Match- und Team-Events, 5 Sekunden für Spieler-Events. „Einmal je PC“ lässt jeden PC einmal durch, „Nur PCs im Team“ nur die PCs, deren Team im Event steht (z. B. „Runde gewonnen“ nur von den Gewinnern, jeder einmal), „Alle durchlassen“ verwirft nie (dann kommt ein Event, das alle 10 PCs melden, auch 10-mal)."
      right={geaendert(spiel.id) ? <button style={S.smallBtn} onClick={alleZurueck}>{spiel.kurz}: alle auf Standard</button> : null}>
      <div data-testid="mehrfach">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {genutzt.map((s) => {
            const an = s.id === spiel.id, n = geaendert(s.id);
            return (
              <button key={s.id} onClick={() => setSpiel(s.id)} data-testid={`mehrfach-spiel-${s.id}`}
                style={{ background: an ? s.farbe + "22" : "transparent", border: `1px solid ${an ? s.farbe : LINE}`, color: an ? s.farbe : SUB, borderRadius: 6, padding: "5px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                {s.kurz}{n ? ` · ${n} geändert` : ""}
              </button>
            );
          })}
        </div>
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))" }}>
          {events.map((e) => {
            const modus = mehrfachModus(cfg, spiel.id, e.id);
            return (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderBottom: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}`, background: modus !== "standard" ? WARN + "12" : "transparent" }}>
                <span style={{ flex: 1, fontSize: 13, color: modus !== "standard" ? "#fff" : SUB }}>{e.label}<span style={{ color: MUTED, fontSize: 11 }}> · {e.gruppe}</span></span>
                <select style={{ ...S.selectSm, width: 180 }} value={modus} data-testid={`mehrfach-${spiel.id}-${e.id}`} onChange={(x) => setzen(spiel.id, e.id, x.target.value)}>
                  {Object.entries(MEHRFACH_TEXT).filter(([k]) => k !== "team" || e.team || e.fest || modus === "team").map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
