import React, { useState, useEffect } from "react";
import { S, ACCENT, MUTED, SUB, LINE, ERR, WARN, teamFarbe } from "../theme.js";
import { Section, EventIcon, SpielChip, ZielBadge, Toggle } from "../ui.jsx";
import { api } from "../api.js";
import { uid } from "../../core/defaults.js";
import { SPIELE, SPIEL_BY_ID } from "../../core/spiele.js";
import { zielTyp, befehleVon, befehlVon } from "../../core/ziel-typen.js";
import { baueNachrichten, zeigeNachricht, nutztPlan } from "../../core/signal.js";
import { ALLGEMEIN, AKTIONEN, aktionVon, geerbt, modus } from "../../core/aktionen.js";
import { Send, Plus, Trash2, Layers } from "lucide-react";

// Bereich „Allgemein“: wie ein Spiel, dessen Events die allgemeinen Aktionen sind (core/aktionen.js). Kein Team-Filter, die Teams sind je Spiel anders.
const ALLGEMEIN_SPIEL = { id: ALLGEMEIN, name: "Allgemein", teams: [], events: AKTIONEN.map(({ id, label, gruppe, spieler }) => ({ id, label, gruppe, spieler })) };

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

// Vorschau mit Platzhaltern statt Werten aus dem Spiel. Nutzt der Befehl den Plan ({nr}, {plan}), zeigt sie die ersten Plätze.
function vorschau(ziel, z, plan) {
  try {
    const ev = { player: "{spieler}", team: z.team || "{team}", pcId: z.pc || "{pc}", round: "{runde}" };
    const befehl = befehlVon(ziel.typ, z.befehl);
    if (!befehl || !nutztPlan(befehl, z.werte)) return { text: baueNachrichten(ziel, z, ev).map(zeigeNachricht).join("  ·  "), fehler: "" };
    if (!plan?.pcs?.length) return { text: "", fehler: "{nr} und {plan} brauchen Plätze im Tab „Plan“" };
    const pcs = z.pc ? plan.pcs.filter((p) => p.pcId === z.pc) : plan.pcs;
    if (!pcs.length) return { text: "", fehler: `${z.pc} steht nicht im Plan` };
    const zeile = (p) => `${p.pcId} → ${baueNachrichten(ziel, z, { ...ev, pcId: p.pcId }, plan).map(zeigeNachricht).join(" · ")}`;
    return { text: pcs.slice(0, 3).map(zeile).join("   ") + (pcs.length > 3 ? `   … (${pcs.length} Plätze)` : ""), alle: pcs.map(zeile).join("\n"), fehler: "" };
  } catch (e) { return { text: "", fehler: e.message }; }
}

function Zuweisung({ spiel, ev, z, cfg, pcs, aendern, loeschen, notify }) {
  const ziel = cfg.targets.find((t) => t.id === z.ziel);
  const befehl = ziel && befehlVon(ziel.typ, z.befehl);
  const v = ziel && befehl ? vorschau(ziel, z, cfg.plan) : { text: "", fehler: ziel ? "Befehl wählen" : "Ziel fehlt" };
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
        <span title={v.alle} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.fehler || v.text}</span>
      </div>
    </div>
  );
}

// Zustand eines Spiel-Events gegenüber „Allgemein“
const MODUS = {
  erbt: { text: (n) => (n ? `erbt ${n} von Allgemein` : "Allgemein (leer)"), farbe: SUB, title: "Die allgemeinen Befehle gelten. Eigene Befehle ergänzen sie." },
  ergaenzt: { text: (n) => `Allgemein (${n}) + eigene`, farbe: "#d9c6ff", title: "Allgemeine und eigene Befehle gelten" },
  ersetzt: { text: () => "ersetzt Allgemein", farbe: WARN, title: "Nur die eigenen Befehle gelten, die allgemeinen nicht" },
};

function EventZeile({ spiel, ev, cfg, mutate, pcs, notify }) {
  const liste = cfg.signale?.[spiel.id]?.[ev.id];
  const zuw = Array.isArray(liste) ? liste : [];
  const m = spiel.id === ALLGEMEIN ? "ohne" : modus(cfg, spiel.id, ev.id);
  const aktion = m !== "ohne" && aktionVon(spiel.id, ev.id);
  const nGeerbt = aktion ? (cfg.signale?.[ALLGEMEIN]?.[aktion.id] || []).length : 0;
  const ersetzen = (an) => mutate((d) => {
    const l = (d.ersetzt = d.ersetzt || {})[spiel.id] || [];
    d.ersetzt[spiel.id] = an ? [...new Set([...l, ev.id])] : l.filter((x) => x !== ev.id);
    if (!d.ersetzt[spiel.id].length) delete d.ersetzt[spiel.id];
  });
  const aktiv = zuw.length > 0 || (m !== "ersetzt" && nGeerbt > 0);
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
        <span style={{ color: aktiv ? ACCENT : MUTED, display: "inline-flex", filter: aktiv ? "drop-shadow(0 0 4px rgba(157,92,255,.8))" : "none" }}><EventIcon type={ev.id} spiel={spiel.id} /></span>
        <span style={{ fontWeight: 600, color: aktiv ? "#fff" : SUB }}>{ev.label}</span>
        <span style={{ ...S.mono, fontSize: 11, color: MUTED }}>{spiel.id === ALLGEMEIN ? abdeckung(ev.id) : ev.id}</span>
        <span style={{ flex: 1 }} />
        {aktion && <span title={`${MODUS[m].title}. Allgemeine Aktion „${aktion.label}“.`} style={{ ...S.badge, background: "transparent", border: `1px solid ${MODUS[m].farbe}55`, color: MODUS[m].farbe, display: "inline-flex", alignItems: "center", gap: 4 }}><Layers size={10} /> {MODUS[m].text(nGeerbt)}</span>}
        {aktion && <button style={S.smallBtn} onClick={() => ersetzen(m !== "ersetzt")} title={m === "ersetzt" ? "Allgemeine Befehle wieder gelten lassen" : "Allgemeine Befehle hier nicht senden, nur die eigenen"}>{m === "ersetzt" ? "Allgemein nutzen" : "Ersetzen"}</button>}
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

// Welche Spiel-Events eine allgemeine Aktion abdeckt, kurz: „CS2 kill · RL demolition …“
const abdeckung = (aktion) => Object.entries(AKTIONEN.find((a) => a.id === aktion)?.events || {}).map(([sp, evs]) => `${SPIEL_BY_ID[sp]?.kurz || sp} ${evs.join("/")}`).join(" · ");

// Eigene Befehle oder bewusst ersetzt: das Spiel weicht von „Allgemein“ ab
const weichtAb = (cfg, spiel, ev) => (cfg.signale?.[spiel]?.[ev]?.length || 0) > 0 || modus(cfg, spiel, ev) === "ersetzt";

// Ein Abschnitt je genutztem Spiel (Tab „Setup“). nurAbweichungen: nur Events mit eigenen Befehlen oder ersetzten allgemeinen
function SpielSignale({ spiel, cfg, mutate, status, notify, nurAbweichungen }) {
  const aktiv = spiel.id === cfg.aktivesSpiel;
  const allgemein = spiel.id === ALLGEMEIN;
  const [extra, setExtra] = useState([]); // im Filter von Hand eingeblendete Events
  const sichtbar = (e) => allgemein || !nurAbweichungen || weichtAb(cfg, spiel.id, e.id) || extra.includes(e.id);
  const events = spiel.events.filter(sichtbar);
  const versteckt = spiel.events.filter((e) => !sichtbar(e));
  const gruppen = [...new Set(events.map((e) => e.gruppe || ""))];
  const anzahl = Object.values(cfg.signale?.[spiel.id] || {}).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0);
  const geerbtN = allgemein ? 0 : spiel.events.reduce((n, e) => n + geerbt(cfg, spiel.id, e.id).length, 0);
  const titel = allgemein
    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Layers size={16} color={ACCENT} /> Allgemein <span style={{ fontSize: 11, color: SUB, fontWeight: 400 }}>gilt für jedes Spiel</span></span>
    : <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{spiel.name} <SpielChip spiel={spiel.id} aktiv={aktiv} />{aktiv && <span style={{ fontSize: 11, color: ACCENT, fontWeight: 600 }}>aktiv</span>}</span>;
  return (
    <Section title={titel} style={allgemein ? { borderColor: ACCENT + "88" } : undefined}
      subtitle={allgemein ? "Kill, Tod, Sieg & Co. einmal einrichten: gilt sofort in jedem Spiel, dessen Event zur Aktion gehört. Im Spiel lässt sich jedes Event ergänzen (eigene Befehle dazu) oder ersetzen." : undefined}
      right={<span style={{ fontSize: 12, color: SUB }}>{allgemein ? `${anzahl} Befehle` : `${anzahl} eigene · ${geerbtN} aus Allgemein`}</span>}>
      {!spiel.events.length ? <div style={S.empty}>Noch keine Datenquelle, keine Events.</div> : !events.length ? <div style={{ ...S.empty, padding: "6px 0" }}>Keine Abweichungen: alles kommt aus „Allgemein“.</div> : gruppen.map((g) => (
        <div key={g} style={{ marginBottom: 6 }}>
          {g && <div style={{ fontSize: 11, color: SUB, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "10px 0 2px" }}>{g}</div>}
          {events.filter((e) => (e.gruppe || "") === g).map((e) => <EventZeile key={e.id} spiel={spiel} ev={e} cfg={cfg} mutate={mutate} pcs={status.pcs} notify={notify} />)}
        </div>
      ))}
      {versteckt.length > 0 && (
        <select style={{ ...S.selectSm, width: 340, marginTop: 8 }} value="" onChange={(e) => e.target.value && setExtra((x) => [...x, e.target.value])}>
          <option value="">+ Event einrichten ({versteckt.length} ohne Abweichung) …</option>
          {versteckt.map((e) => <option key={e.id} value={e.id}>{e.label}{aktionVon(spiel.id, e.id) ? " (aus Allgemein)" : ""}</option>)}
        </select>
      )}
    </Section>
  );
}

export default function SignaleTab(props) {
  const { cfg, status, goTab } = props;
  const genutzt = SPIELE.filter((s) => cfg.spiele?.[s.id]);
  // Standard: in den Spielen nur zeigen, was von „Allgemein“ abweicht
  const [nurAbweichungen, setNurAbweichungen] = useState(() => { try { return localStorage.getItem("advancedlan_signale_alle") !== "1"; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem("advancedlan_signale_alle", nurAbweichungen ? "0" : "1"); } catch {} }, [nurAbweichungen]);
  const pcIds = [...new Set([...cfg.plan.pcs.map((p) => p.pcId), ...status.pcs.filter((p) => !p.sim).map((p) => p.pcId)])];
  return (
    <>
      <style>{`.sig-zeile select, .sig-zeile input, .sig-zeile .sig-leer { height: 30px; box-sizing: border-box; }`}</style>
      <datalist id="advancedlan-pcs">{pcIds.map((id) => <option key={id} value={id} />)}</datalist>
      {!cfg.targets.length && (
        <Section style={{ borderColor: ACCENT }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, color: SUB }}>Noch kein Ziel angelegt. Befehle gehen nur an Ziele aus dem Tab „Ziele“.</span>
            <button style={S.primaryBtn} onClick={() => goTab("ziele")}><Send size={14} /> Zu den Zielen</button>
          </div>
        </Section>
      )}
      <SpielSignale spiel={ALLGEMEIN_SPIEL} {...props} />
      <div style={{ display: "flex", justifyContent: "flex-end", margin: "-8px 0 12px" }}>
        <Toggle checked={nurAbweichungen} onChange={setNurAbweichungen} label="In den Spielen nur Abweichungen von „Allgemein“ zeigen" />
      </div>
      {genutzt.map((s) => <SpielSignale key={s.id} spiel={s} {...props} nurAbweichungen={nurAbweichungen} />)}
    </>
  );
}
