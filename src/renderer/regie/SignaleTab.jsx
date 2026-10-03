import React from "react";
import { S, ACCENT, MUTED, SUB, LINE, ERR, teamFarbe } from "../theme.js";
import { Section, EventIcon, SpielChip, ZielBadge } from "../ui.jsx";
import { api } from "../api.js";
import { uid } from "../../core/defaults.js";
import { SPIELE } from "../../core/spiele.js";
import { zielTyp, befehleVon, befehlVon } from "../../core/ziel-typen.js";
import { baueNachrichten, zeigeNachricht } from "../../core/signal.js";
import { Send, Plus, Trash2 } from "lucide-react";

// Feste Spalten, damit Ziel, Befehl, Werte, PC, Team und Knöpfe in allen Zeilen untereinander stehen
const ZEILE = "170px 230px minmax(220px,1fr) 130px 130px 92px";

// Jedes Feld hat einen Titel darüber, auch leere Spalten, damit alle Zeilen gleich hoch beginnen
const Feld = ({ titel, children, style }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, ...style }}>
    <span style={{ fontSize: 10, color: MUTED, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", height: 13 }}>{titel}</span>
    {children}
  </label>
);
const Leer = ({ text = "–" }) => <span className="sig-leer" style={{ ...S.inputSm, display: "flex", alignItems: "center", color: MUTED, background: "transparent", borderColor: "transparent", fontSize: 12 }}>{text}</span>;

// Vorschau mit Platzhaltern statt Werten aus dem Spiel
function vorschau(ziel, z) {
  try {
    const ev = { player: "{spieler}", team: z.team || "{team}", pcId: z.pc || "{pc}", round: "{runde}" };
    return { text: baueNachrichten(ziel, z, ev).map(zeigeNachricht).join("  ·  "), fehler: "" };
  } catch (e) { return { text: "", fehler: e.message }; }
}

function Zuweisung({ spiel, ev, z, cfg, pcs, aendern, loeschen, notify }) {
  const ziel = cfg.targets.find((t) => t.id === z.ziel);
  const befehl = ziel && befehlVon(ziel.typ, z.befehl);
  const v = ziel && befehl ? vorschau(ziel, z) : { text: "", fehler: ziel ? "Befehl wählen" : "Ziel fehlt" };
  const testen = async () => {
    const k = await api.signalTesten(spiel.id, ev.id, z);
    k.fehler?.length ? notify(k.fehler.join(", "), "err") : notify(`${k.nachrichten.join(" · ")} → ${k.ziel}`);
  };
  return (
    <div style={{ padding: "8px 0 8px 30px", borderTop: `1px dashed ${LINE}` }}>
      <div className="sig-zeile" style={{ display: "grid", gridTemplateColumns: ZEILE, gap: 8, alignItems: "start" }}>
        <Feld titel="Ziel">
          <select style={S.selectSm} value={z.ziel} onChange={(e) => {
            const t = cfg.targets.find((x) => x.id === e.target.value);
            aendern((w) => { w.ziel = e.target.value; if (t && !befehlVon(t.typ, w.befehl)) { w.befehl = befehleVon(t.typ)[0].id; w.werte = {}; } });
          }}>
            {!ziel && <option value={z.ziel}>– Ziel wählen –</option>}
            {cfg.targets.map((t) => <option key={t.id} value={t.id}>{t.name || zielTyp(t.typ).name}</option>)}
          </select>
        </Feld>
        <Feld titel="Befehl">
          <select style={S.selectSm} value={befehl ? z.befehl : ""} disabled={!ziel} onChange={(e) => aendern((w) => { w.befehl = e.target.value; w.werte = {}; })}>
            {!befehl && <option value="">– Befehl –</option>}
            {ziel && befehleVon(ziel.typ).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </Feld>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
          {(befehl?.params || []).map((p) => (
            <Feld key={p.key} titel={p.label} style={{ flex: p.art === "zahl" ? "0 0 84px" : "1 1 150px" }}>
              <input style={{ ...S.inputSm, ...S.mono }} value={z.werte?.[p.key] ?? p.standard} inputMode={p.art === "zahl" ? "decimal" : undefined}
                onChange={(e) => aendern((w) => { w.werte = { ...(w.werte || {}), [p.key]: e.target.value }; })} />
            </Feld>
          ))}
          {befehl && !befehl.params?.length && <Feld titel="Werte"><Leer text="keine" /></Feld>}
        </div>
        <Feld titel="PC">
          {ev.spieler
            ? <input list="advancedlan-pcs" style={S.inputSm} value={z.pc} placeholder="Alle PCs" title="Nur wenn dieser PC das Ereignis meldet" onChange={(e) => aendern((w) => { w.pc = e.target.value.trim(); })} />
            : <Leer text="alle" />}
        </Feld>
        <Feld titel="Team">
          {ev.team && spiel.teams?.length > 0
            ? <select style={{ ...S.selectSm, color: z.team ? teamFarbe(z.team) : "#fff" }} value={z.team} onChange={(e) => aendern((w) => { w.team = e.target.value; })}>
              <option value="">Alle Teams</option>
              {spiel.teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            : <Leer text="alle" />}
        </Feld>
        <Feld titel=" ">
          <div style={{ display: "flex", gap: 6, whiteSpace: "nowrap" }}>
            <button style={{ ...S.smallBtn, padding: "6px 8px" }} disabled={!!v.fehler} onClick={testen} title="Jetzt senden, auch wenn die Ausgabe aus ist"><Send size={12} /> Test</button>
            <button style={{ ...S.dangerBtn, padding: "6px 9px" }} onClick={loeschen} title="Befehl entfernen"><Trash2 size={12} /></button>
          </div>
        </Feld>
      </div>
      <div style={{ ...S.mono, fontSize: 11, marginTop: 5, color: v.fehler ? ERR : "#d9c6ff", display: "flex", gap: 8, alignItems: "center", overflow: "hidden" }}>
        {ziel && <ZielBadge typ={ziel.typ} />}
        <span style={{ color: MUTED }}>{ziel ? `${ziel.host || "?"}:${ziel.port}` : ""}</span>
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.fehler || v.text}</span>
      </div>
    </div>
  );
}

function EventZeile({ spiel, ev, cfg, mutate, pcs, notify }) {
  const liste = cfg.signale?.[spiel.id]?.[ev.id];
  const zuw = Array.isArray(liste) ? liste : [];
  const aendereListe = (fn) => mutate((d) => {
    d.signale = d.signale || {};
    d.signale[spiel.id] = d.signale[spiel.id] || {};
    const l = Array.isArray(d.signale[spiel.id][ev.id]) ? d.signale[spiel.id][ev.id] : [];
    d.signale[spiel.id][ev.id] = fn(l);
  });
  const neu = () => {
    const t = cfg.targets[0];
    aendereListe((l) => [...l, { id: uid(), ziel: t.id, befehl: befehleVon(t.typ)[0].id, werte: {}, pc: "", team: "" }]);
  };
  return (
    <div style={{ padding: "8px 0", borderBottom: `1px solid ${LINE}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: zuw.length ? ACCENT : MUTED, display: "inline-flex", filter: zuw.length ? "drop-shadow(0 0 4px rgba(157,92,255,.8))" : "none" }}><EventIcon type={ev.id} spiel={spiel.id} /></span>
        <span style={{ fontWeight: 600, color: zuw.length ? "#fff" : SUB }}>{ev.label}</span>
        <span style={{ ...S.mono, fontSize: 11, color: MUTED }}>{ev.id}</span>
        <span style={{ flex: 1 }} />
        {zuw.length > 0 && <span style={{ ...S.badge, background: ACCENT + "33", color: "#d9c6ff" }}>{zuw.length} {zuw.length === 1 ? "Befehl" : "Befehle"}</span>}
        <button style={S.smallBtn} disabled={!cfg.targets.length} onClick={neu}><Plus size={12} /> Befehl</button>
      </div>
      {zuw.map((z) => (
        <Zuweisung key={z.id} spiel={spiel} ev={ev} z={z} cfg={cfg} pcs={pcs} notify={notify}
          aendern={(fn) => aendereListe((l) => l.map((w) => { if (w.id !== z.id) return w; const k = { ...w }; fn(k); return k; }))}
          loeschen={() => aendereListe((l) => l.filter((w) => w.id !== z.id))} />
      ))}
    </div>
  );
}

// Ein Abschnitt je genutztem Spiel (Tab „Setup“)
function SpielSignale({ spiel, cfg, mutate, status, notify }) {
  const aktiv = spiel.id === cfg.aktivesSpiel;
  const gruppen = [...new Set(spiel.events.map((e) => e.gruppe || ""))];
  const anzahl = Object.values(cfg.signale?.[spiel.id] || {}).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0);
  return (
    <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{spiel.name} <SpielChip spiel={spiel.id} aktiv={aktiv} />{aktiv && <span style={{ fontSize: 11, color: ACCENT, fontWeight: 600 }}>aktiv</span>}</span>}
      right={<span style={{ fontSize: 12, color: SUB }}>{anzahl} Befehle</span>}>
      {!spiel.events.length ? <div style={S.empty}>Noch keine Datenquelle, keine Events.</div> : gruppen.map((g) => (
        <div key={g} style={{ marginBottom: 6 }}>
          {g && <div style={{ fontSize: 11, color: SUB, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "10px 0 2px" }}>{g}</div>}
          {spiel.events.filter((e) => (e.gruppe || "") === g).map((e) => <EventZeile key={e.id} spiel={spiel} ev={e} cfg={cfg} mutate={mutate} pcs={status.pcs} notify={notify} />)}
        </div>
      ))}
    </Section>
  );
}

export default function SignaleTab(props) {
  const { cfg, status, goTab } = props;
  const genutzt = SPIELE.filter((s) => cfg.spiele?.[s.id]);
  return (
    <>
      <style>{`.sig-zeile select, .sig-zeile input, .sig-zeile .sig-leer { height: 30px; box-sizing: border-box; }`}</style>
      <datalist id="advancedlan-pcs">{status.pcs.map((p) => <option key={p.pcId} value={p.pcId} />)}</datalist>
      {!cfg.targets.length && (
        <Section style={{ borderColor: ACCENT }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, color: SUB }}>Noch kein Ziel angelegt. Befehle gehen nur an Ziele aus dem Tab „Ziele“.</span>
            <button style={S.primaryBtn} onClick={() => goTab("ziele")}><Send size={14} /> Zu den Zielen</button>
          </div>
        </Section>
      )}
      {genutzt.map((s) => <SpielSignale key={s.id} spiel={s} {...props} />)}
    </>
  );
}
