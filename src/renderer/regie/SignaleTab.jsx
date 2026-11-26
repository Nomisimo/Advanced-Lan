import React, { useState, useEffect } from "react";
import { S, ACCENT, MUTED, SUB, LINE, ERR, WARN, teamFarbe } from "../theme.js";
import { Section, EventIcon, SpielChip, ZielBadge, Toggle } from "../ui.jsx";
import { api } from "../api.js";
import { uid } from "../../core/defaults.js";
import { SPIELE, SPIEL_BY_ID } from "../../core/spiele.js";
import { zielTyp, befehleVon, befehlVon } from "../../core/ziel-typen.js";
import { baueNachrichten, zeigeNachricht, nutztPlan } from "../../core/signal.js";
import { ALLGEMEIN, AKTIONEN, aktionVon, mvpAusloeser, geerbt, modus } from "../../core/aktionen.js";
import { migrateSound, vorschlagFuer, dateiListe, dateiWert } from "../../core/sound.js";
import { istLokal } from "../../core/ziel-typen.js";
import { SEITEN } from "../../core/signal.js";
import { Send, Plus, Trash2, Layers, Volume2 } from "lucide-react";

// Werte eines neuen Befehls: „Sound abspielen“ schlägt die Dateien aus dem Event-Ordner der Bibliothek vor
const startWerte = (cfg, spiel, event, typ, befehl) => (typ === "sound" && befehl === "abspielen" ? { datei: dateiWert(vorschlagFuer(cfg.sound, spiel, event)) } : {});

// Parameter „datei“ (Local Sound): Dateien aus der Sound-Bibliothek ankreuzen, mehrere = zufällig eine
function SoundWahl({ cfg, spiel, wert, setzen }) {
  const bib = migrateSound(cfg.sound).dateien.filter((d) => d.spiel === spiel);
  const gewaehlt = dateiListe(wert);
  const name = (p) => bib.find((d) => d.pfad === p)?.name || `${p.split(/[\\/]/).pop()} (fehlt)`;
  const text = !gewaehlt.length ? "– Datei wählen –" : gewaehlt.length === 1 ? name(gewaehlt[0]) : `${gewaehlt.length} Dateien, zufällig eine`;
  const umschalten = (p, an) => setzen(dateiWert(an ? [...gewaehlt, p] : gewaehlt.filter((x) => x !== p)));
  const events = SPIEL_BY_ID[spiel]?.events || [];
  return (
    <details style={{ position: "relative" }} data-testid="sound-wahl">
      <summary style={{ ...S.selectSm, listStyle: "none", cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: gewaehlt.length ? "#fff" : MUTED }} title={gewaehlt.map(name).join("\n")}>{text}</summary>
      <div style={{ position: "absolute", zIndex: 20, top: "100%", left: 0, minWidth: 260, maxHeight: 300, overflow: "auto", background: "#1a1820", border: `1px solid ${LINE}`, borderRadius: 6, padding: 8, display: "grid", gap: 2, fontSize: 12 }}>
        {!bib.length && <span style={{ color: MUTED }}>Bibliothek leer: Tab „Ziele“ → Local Sound → Ordner wählen</span>}
        {[...new Set(bib.map((d) => d.event))].map((e) => (
          <React.Fragment key={e || "_"}>
            <span style={{ color: MUTED, fontSize: 10, marginTop: 4 }}>{e ? events.find((x) => x.id === e)?.label || e : "Ohne Event"}</span>
            {bib.filter((d) => d.event === e).map((d) => (
              <label key={d.id} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={gewaehlt.includes(d.pfad)} onChange={(ev) => umschalten(d.pfad, ev.target.checked)} /> {d.name}
              </label>
            ))}
          </React.Fragment>
        ))}
        {gewaehlt.filter((p) => !bib.some((d) => d.pfad === p)).map((p) => (
          <label key={p} style={{ display: "flex", gap: 6, alignItems: "center", color: WARN }}><input type="checkbox" checked onChange={() => umschalten(p, false)} /> {name(p)}</label>
        ))}
      </div>
    </details>
  );
}

// Bereich „Allgemein“: wie ein Spiel, dessen Events die allgemeinen Aktionen sind (core/aktionen.js). Kein Team-Filter, die Teams sind je Spiel anders.
const ALLGEMEIN_SPIEL = { id: ALLGEMEIN, name: "Allgemein", teams: [], events: AKTIONEN.map(({ id, label, gruppe, spieler }) => ({ id, label, gruppe, spieler })) };

// Feste Spalten, damit Ziel, Befehl, Werte, PC, Team und Knöpfe in allen Zeilen untereinander stehen
const ZEILE = "170px 230px minmax(220px,1fr) 130px 130px 84px 92px";

// Jedes Feld hat einen Titel darüber, auch leere Spalten, damit alle Zeilen gleich hoch beginnen
// div statt label, wenn das Feld selbst mehrere Eingaben hat (Dateiwahl): ein label würde jeden Klick aufs erste Kästchen lenken
const Feld = ({ titel, children, style, div }) => React.createElement(div ? "div" : "label", { style: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0, ...style } },
  <span style={{ fontSize: 10, color: MUTED, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", height: 13 }}>{titel}</span>,
  children);
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
            aendern((w) => { w.ziel = e.target.value; if (t && !befehlVon(t.typ, w.befehl)) { w.befehl = befehleVon(t.typ)[0].id; w.werte = startWerte(cfg, spiel.id, ev.id, t.typ, w.befehl); } });
          }}>
            {!ziel && <option value={z.ziel}>– Ziel wählen –</option>}
            {cfg.targets.map((t) => <option key={t.id} value={t.id}>{t.name || zielTyp(t.typ).name}</option>)}
          </select>
        </Feld>
        <Feld titel="Befehl">
          <select style={S.selectSm} value={befehl ? z.befehl : ""} disabled={!ziel} onChange={(e) => aendern((w) => { w.befehl = e.target.value; w.werte = startWerte(cfg, spiel.id, ev.id, ziel.typ, e.target.value); })}>
            {!befehl && <option value="">– Befehl –</option>}
            {ziel && befehleVon(ziel.typ).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </Feld>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
          {(befehl?.params || []).map((p) => (
            <Feld key={p.key} titel={p.label} div={p.art === "sound"} style={{ flex: p.art === "zahl" ? "0 0 84px" : "1 1 150px" }}>
              {p.art === "sound"
                ? <SoundWahl cfg={cfg} spiel={spiel.id === ALLGEMEIN ? cfg.aktivesSpiel : spiel.id} wert={z.werte?.[p.key] ?? ""} setzen={(v) => aendern((w) => { w.werte = { ...(w.werte || {}), [p.key]: v }; })} />
                : <input style={{ ...S.inputSm, ...S.mono }} value={z.werte?.[p.key] ?? p.standard} inputMode={p.art === "zahl" ? "decimal" : undefined}
                  onChange={(e) => aendern((w) => { w.werte = { ...(w.werte || {}), [p.key]: e.target.value }; })} />}
            </Feld>
          ))}
          {befehl && !befehl.params?.length && <Feld titel="Werte"><Leer text="keine" /></Feld>}
        </div>
        <Feld titel="PC">
          {ev.spieler
            ? <input list="advancedlan-pcs" style={S.inputSm} value={z.pc} placeholder="Alle PCs" title="Nur wenn dieser PC das Ereignis meldet" onChange={(e) => aendern((w) => { w.pc = e.target.value.trim(); })} />
            : <Leer text="alle" />}
        </Feld>
        <Feld titel={spiel.id === "valorant" && ev.team ? "Team / Seite" : "Team"}>
          {ev.team && spiel.teams?.length > 0
            ? <select style={{ ...S.selectSm, color: z.team ? teamFarbe(z.team) : "#fff" }} value={z.seite ? `seite:${z.seite}` : z.team} data-testid="signal-team"
              title={spiel.id === "valorant" ? "Team oder Seite des Teams im Event (bei „Runde gewonnen“: die Seite des Siegers). Angriff/Verteidigung wechselt zur Halbzeit." : undefined}
              onChange={(e) => aendern((w) => { const v = e.target.value; if (v.startsWith("seite:")) { w.team = ""; w.seite = v.slice(6); } else { w.team = v; delete w.seite; } })}>
              <option value="">Alle Teams</option>
              {spiel.teams.map((t) => <option key={t} value={t}>{t}</option>)}
              {spiel.id === "valorant" && <optgroup label="Seite">{SEITEN.map((x) => <option key={x} value={`seite:${x}`}>{x}</option>)}</optgroup>}
            </select>
            : <Leer text="alle" />}
        </Feld>
        <Feld titel="Verzögerung">
          <input style={{ ...S.inputSm, ...S.mono }} inputMode="numeric" placeholder="0 ms" data-testid="signal-verzoegerung" value={z.verzoegerung || ""}
            title="Befehl erst so viele Millisekunden nach dem Event senden (1000 = 1 Sekunde)"
            onChange={(e) => aendern((w) => { const n = Math.min(600000, Math.max(0, Math.round(Number(e.target.value.replace(/\D/g, "")) || 0))); if (n) w.verzoegerung = n; else delete w.verzoegerung; })} />
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
        <span style={{ color: MUTED }}>{ziel ? (istLokal(ziel) ? "dieser PC" : `${ziel.host || "?"}:${ziel.port}`) : ""}</span>
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
  const soundZiel = cfg.targets.find((t) => t.typ === "sound");
  const aendereListe = (fn) => mutate((d) => {
    d.signale = d.signale || {};
    d.signale[spiel.id] = d.signale[spiel.id] || {};
    const l = Array.isArray(d.signale[spiel.id][ev.id]) ? d.signale[spiel.id][ev.id] : [];
    d.signale[spiel.id][ev.id] = fn(l);
  });
  const neu = (t = cfg.targets.find((x) => !istLokal(x)) || cfg.targets[0]) => {
    const befehl = befehleVon(t.typ)[0].id;
    aendereListe((l) => [...l, { id: uid(), ziel: t.id, befehl, werte: startWerte(cfg, spiel.id === ALLGEMEIN ? cfg.aktivesSpiel : spiel.id, ev.id, t.typ, befehl), pc: "", team: "" }]);
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
        {soundZiel && <button style={{ ...S.smallBtn, color: "#9be7b4" }} data-testid={`signal-sound-${ev.id}`} onClick={() => neu(soundZiel)} title={`Befehl „Sound abspielen“ an „${soundZiel.name || "Local Sound"}“`}><Volume2 size={12} /> Sound</button>}
        <button style={S.smallBtn} disabled={!cfg.targets.length} onClick={() => neu()}><Plus size={12} /> Befehl</button>
      </div>
      {ev.mvp && spiel.id !== ALLGEMEIN && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0 0 30px", fontSize: 12, color: SUB }}>
          <span>Kommt nach</span>
          <select style={{ ...S.selectSm, width: 230 }} data-testid="mvp-nach" value={mvpAusloeser(cfg, spiel.id)}
            onChange={(e) => mutate((d) => { d.mvpNach = { ...(d.mvpNach || {}), [spiel.id]: e.target.value }; })}>
            {spiel.events.filter((x) => !x.mvp).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
          <span>mit dem besten Spieler im Ranking (MVP-Endscreen). Wartezeit am Befehl unter „Verzögerung“.</span>
        </div>
      )}
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
        <span style={{ display: "inline-flex", gap: 16 }}>
          <Toggle checked={nurAbweichungen} onChange={setNurAbweichungen} label="In den Spielen nur Abweichungen von „Allgemein“ zeigen" />
        </span>
      </div>
      {genutzt.map((s) => <SpielSignale key={s.id} spiel={s} {...props} nurAbweichungen={nurAbweichungen} />)}
    </>
  );
}
