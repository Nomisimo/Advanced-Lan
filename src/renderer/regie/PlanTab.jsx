import React, { useState } from "react";
import { S, SUB, MUTED, ACCENT, OK, WARN } from "../theme.js";
import { Section, Toggle, Dot, ZielBadge, Kbd, th, td } from "../ui.jsx";
import { uiConfirm } from "../dialog.jsx";
import { api } from "../api.js";
import { uid } from "../../core/defaults.js";
import { zielTyp } from "../../core/ziel-typen.js";
import { plaetzeAnlegen, platzVon, planWert, pcIdFuer, STANDARD_REGEL, MAX_PLAETZE } from "../../core/plan.js";
import { Plus, Trash2, ArrowUp, ArrowDown, Users, Send, Upload, Download, FolderDown, MonitorDown } from "lucide-react";

// Tab „Plan“: Plätze der Game-PCs (auch virtuell, ohne verbundenen Rechner), je Ziel eine Spalte mit Regel und eigenen Werten,
// Zuordnung echter Rechner und die Game-PC-Vorlage, die die Regie an alle Plätze verteilt (core/plan.js).

// Stand der Vorlage auf einem verbundenen PC
function vorlageStatus(p, v) {
  if (!p?.verbunden) return null;
  if (p.vorlage === "eigene") return { text: "eigene Einstellungen", farbe: MUTED, title: "Am Game-PC ist „Einstellungen von der Regie übernehmen“ aus" };
  if (!v) return null;
  return p.vorlage === v.stand ? { text: "Vorlage aktuell", farbe: OK } : { text: "Vorlage veraltet", farbe: WARN, title: "„An alle verteilen“ schickt die aktuelle Vorlage" };
}

function Plaetze({ cfg, mutate, status }) {
  const plan = cfg.plan;
  const [anzahl, setAnzahl] = useState(plan.pcs.length || 10);
  const set = (fn) => mutate((d) => fn(d.plan));
  const platz = (id, fn) => set((p) => { const x = p.pcs.find((y) => y.id === id); if (x) fn(x); });
  const echte = status.pcs.filter((p) => !p.sim);
  const anlegen = async () => {
    const n = Math.max(0, Math.min(MAX_PLAETZE, Number(anzahl) || 0));
    if (n < plan.pcs.length && !(await uiConfirm(`${plan.pcs.length - n} Plätze am Ende entfernen?`))) return;
    set((p) => Object.assign(p, plaetzeAnlegen(p, n)));
  };
  const verschieben = (i, r) => set((p) => { const j = i + r; if (j < 0 || j >= p.pcs.length) return; [p.pcs[i], p.pcs[j]] = [p.pcs[j], p.pcs[i]]; });
  const neu = () => set((p) => { const ids = new Set(p.pcs.map((x) => x.pcId)); let k = p.pcs.length + 1; while (ids.has(pcIdFuer(k))) k++; p.pcs.push({ id: uid(), pcId: pcIdFuer(k), rechner: "", werte: {} }); });
  const ziele = cfg.targets;
  return (
    <Section title="PC-Plätze"
      subtitle="Jeder Platz ist ein Game-PC, auch wenn er noch nicht verbunden ist. Die Reihenfolge ist die Platznummer {nr}. Je Ziel eine Spalte: oben die Regel für alle Plätze, darunter eigene Werte für einzelne PCs."
      right={<div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="number" min={0} max={MAX_PLAETZE} value={anzahl} onChange={(e) => setAnzahl(e.target.value)} style={{ ...S.inputSm, width: 64 }} title="Anzahl Plätze" />
        <button style={S.primaryBtn} onClick={anlegen}><Users size={14} /> Plätze anlegen</button>
        <button style={S.secondaryBtn} onClick={neu} disabled={plan.pcs.length >= MAX_PLAETZE}><Plus size={13} /> Platz</button>
      </div>}>
      {!plan.pcs.length ? <div style={S.empty}>Noch keine Plätze. „Plätze anlegen“ legt PC 01 bis PC {String(anzahl || 10).padStart(2, "0")} an.</div> : (
        <div style={{ overflowX: "auto" }}>
          <datalist id="advancedlan-rechner">{echte.map((p) => p.geraet?.hostname && <option key={p.pcId} value={p.geraet.hostname} />)}</datalist>
          <table style={{ ...S.table, marginTop: 0 }}>
            <thead>
              <tr>
                <th style={th({ width: 30 })}>Nr</th><th style={th({ minWidth: 110 })}>PC-ID</th>
                <th style={th({ minWidth: 150 })} title="Hostname oder MAC: meldet sich ein Game-PC von diesem Rechner, bekommt er die PC-ID des Platzes">Rechner</th>
                <th style={th({ minWidth: 150 })}>Status</th>
                {ziele.map((t) => <th key={t.id} style={th({ minWidth: 120 })}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><ZielBadge typ={t.typ} />{t.name || zielTyp(t.typ).name}</span></th>)}
                <th style={th()}></th>
              </tr>
              {ziele.length > 0 && <tr>
                <td style={td({ fontSize: 11, color: SUB })} colSpan={4}>Regel für alle Plätze <span style={{ color: MUTED }}>(Platzhalter {"{plan}"} in den Signalen)</span></td>
                {ziele.map((t) => (
                  <td key={t.id} style={td()}>
                    <input style={{ ...S.inputSm, ...S.mono, borderColor: ACCENT + "88" }} value={plan.regeln[t.id] ?? ""} placeholder={STANDARD_REGEL}
                      title="Regel für alle Plätze, z. B. {100+nr} → 101, 102 …" onChange={(e) => set((p) => { p.regeln[t.id] = e.target.value; })} />
                  </td>
                ))}
                <td style={td()} />
              </tr>}
            </thead>
            <tbody>
              {plan.pcs.map((x, i) => {
                const p = echte.find((y) => y.pcId === x.pcId);
                const vs = vorlageStatus(p, plan.vorlage);
                return (
                  <tr key={x.id}>
                    <td style={td({ fontWeight: 800, color: SUB, fontVariantNumeric: "tabular-nums" })}>{i + 1}</td>
                    <td style={td()}><input style={{ ...S.inputSm, fontWeight: 700 }} value={x.pcId} onChange={(e) => platz(x.id, (y) => { y.pcId = e.target.value.slice(0, 40); })} /></td>
                    <td style={td()}><input list="advancedlan-rechner" style={{ ...S.inputSm, ...S.mono }} value={x.rechner} placeholder="Hostname oder MAC" onChange={(e) => platz(x.id, (y) => { y.rechner = e.target.value.trim(); })} /></td>
                    <td style={td({ fontSize: 12, whiteSpace: "nowrap" })}>
                      <Dot color={p?.verbunden ? OK : "#4d475c"} glow={p?.verbunden} /> <span style={{ color: p?.verbunden ? "#ece9f2" : MUTED }}>{p?.verbunden ? (p.spieler || p.geraet?.hostname || "verbunden") : "geplant"}</span>
                      {vs && <div style={{ fontSize: 11, color: vs.farbe, marginTop: 2 }} title={vs.title}>{vs.text}</div>}
                    </td>
                    {ziele.map((t) => (
                      <td key={t.id} style={td()}>
                        <input style={{ ...S.inputSm, ...S.mono }} value={x.werte[t.id] ?? ""} placeholder={planWert({ ...plan, pcs: plan.pcs.map((y) => (y.id === x.id ? { ...y, werte: {} } : y)) }, i + 1, t.id)}
                          title="Leer = Regel der Spalte" onChange={(e) => platz(x.id, (y) => { if (e.target.value) y.werte[t.id] = e.target.value; else delete y.werte[t.id]; })} />
                      </td>
                    ))}
                    <td style={td({ whiteSpace: "nowrap", textAlign: "right" })}>
                      <button style={{ ...S.smallBtn, padding: 4 }} disabled={!i} onClick={() => verschieben(i, -1)} title="Nach oben"><ArrowUp size={12} /></button>{" "}
                      <button style={{ ...S.smallBtn, padding: 4 }} disabled={i === plan.pcs.length - 1} onClick={() => verschieben(i, 1)} title="Nach unten"><ArrowDown size={12} /></button>{" "}
                      <button style={{ ...S.dangerBtn, padding: "4px 7px" }} onClick={() => set((pl) => { pl.pcs = pl.pcs.filter((y) => y.id !== x.id); })} title="Platz entfernen"><Trash2 size={12} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!ziele.length && plan.pcs.length > 0 && <div style={S.hint}>Noch keine Ziele: Spalten erscheinen, sobald im Tab „Ziele“ ein Ziel angelegt ist.</div>}
      <div style={{ marginTop: 14 }}>
        <Toggle checked={plan.auto} onChange={(v) => set((p) => { p.auto = v; })} label="Neue Game-PCs automatisch dem nächsten freien Platz zuweisen"
          title="Ein Game-PC, dessen Rechner und PC-ID nicht im Plan stehen, bekommt den nächsten Platz ohne Rechner. Der Platz merkt sich den Rechner." />
      </div>
      <div style={{ ...S.hint, lineHeight: 1.8 }}>
        In den Signalen: <Kbd>{"{plan}"}</Kbd> Wert aus der Spalte des Ziels für den PC, der das Ereignis meldet · <Kbd>{"{nr}"}</Kbd> Platznummer · <Kbd>{"{nr2}"}</Kbd> mit führender Null (01) ·
        Rechnen: <Kbd>{"{100+nr}"}</Kbd> <Kbd>{"{nr*10}"}</Kbd> <Kbd>{"{(nr-1)*4+1}"}</Kbd>.<br />
        Beispiel: Spalte grandMA3 mit Regel <Kbd>{"{100+nr}"}</Kbd>, im Signal „Kill“ den Befehl „Sequenz: Go+“ mit Sequenz <Kbd>{"{plan}"}</Kbd>. Ein Kill von Platz 3 schickt <Kbd>Go+ Sequence 103</Kbd>.
        Steht ein PC nicht im Plan, sendet ein solcher Befehl nichts und das Event-Log zeigt den Grund. Simulierte PCs (SIM 03) spielen Platz 3.
      </div>
    </Section>
  );
}

// Verbundene Game-PCs, die keinen Platz haben
function NichtImPlan({ cfg, status, notify }) {
  const plan = cfg.plan;
  const fremd = status.pcs.filter((p) => p.verbunden && !p.sim && p.remote !== "dieser PC" && !platzVon(plan, p.pcId));
  if (!fremd.length || !plan.pcs.length) return null;
  const frei = plan.pcs.filter((x) => !status.pcs.some((p) => p.pcId === x.pcId && p.verbunden));
  const zuordnen = async (pcId, platzId) => { const r = await api.planZuordnen(pcId, platzId); if (r?.fehler) notify(r.fehler, "err"); };
  return (
    <Section title="Nicht im Plan" style={{ borderColor: WARN }}
      subtitle="Diese Game-PCs sind verbunden, haben aber keinen Platz. Einem Platz zuweisen: der Platz merkt sich den Rechner, der PC meldet sich neu an und bekommt die PC-ID des Platzes.">
      <table style={{ ...S.table, marginTop: 0 }}>
        <thead><tr>{["PC-ID", "Rechner", "MAC", "Platz zuweisen"].map((h) => <th key={h} style={th()}>{h}</th>)}</tr></thead>
        <tbody>{fremd.map((p) => (
          <tr key={p.pcId}>
            <td style={td({ fontWeight: 700 })}>{p.pcId}</td>
            <td style={td()}>{p.geraet?.hostname || "–"}</td>
            <td style={td({ ...S.mono, color: SUB })}>{p.geraet?.mac || "–"}</td>
            <td style={td({ width: 220 })}>
              <select style={S.selectSm} value="" onChange={(e) => e.target.value && zuordnen(p.pcId, e.target.value)}>
                <option value="">– Platz wählen –</option>
                {frei.map((x) => <option key={x.id} value={x.id}>{plan.pcs.indexOf(x) + 1}: {x.pcId}{x.rechner ? ` (statt ${x.rechner})` : ""}</option>)}
              </select>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </Section>
  );
}

function Vorlage({ cfg, mutate, status, notify, standalone }) {
  const plan = cfg.plan, v = plan.vorlage;
  const echte = status.pcs.filter((p) => p.verbunden && !p.sim && p.remote !== "dieser PC");
  const [quelle, setQuelle] = useState("");
  const ergebnis = (r, text) => { if (r?.fehler) notify(r.fehler, "err"); else if (r && !r.abbruch && text) notify(text); };
  const verteilen = async () => {
    const r = await api.planVerteilen();
    notify(r.n ? `Vorlage an ${r.n} ${r.n === 1 ? "PC" : "PCs"} geschickt` : "Kein Game-PC verbunden", r.n ? "ok" : "warn");
  };
  const aktuell = echte.filter((p) => v && p.vorlage === v.stand).length;
  return (
    <Section title="Game-PC-Vorlage"
      subtitle="Einstellungen für alle Game-PCs (Spiele, Bilderkennung, Overlay, Namens-Popup, Ports), verteilt über die Session. Jeder PC behält seine PC-ID, den Spielernamen, den GSI-Token, die Overlay-Position und seine Session."
      right={v && <span style={{ fontSize: 12, color: SUB }}>{aktuell} von {echte.length} verbundenen PCs aktuell</span>}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14 }}>{v ? <>Vorlage <b>„{v.name}“</b></> : <span style={{ color: MUTED }}>Keine Vorlage gewählt</span>}</span>
        <span style={{ flex: 1 }} />
        <button style={S.secondaryBtn} onClick={async () => ergebnis(await api.planVorlageDatei(), "Vorlage aus der Show übernommen")}><Upload size={13} /> Aus Game-PC-Show (.alshow)</button>
        {standalone && <button style={S.secondaryBtn} onClick={async () => ergebnis(await api.planVorlageEigene(), "Spiele-Einstellungen dieses PCs als Vorlage übernommen")}><MonitorDown size={13} /> Von diesem PC</button>}
        {echte.length > 0 && <span style={{ display: "inline-flex", gap: 4 }}>
          <select style={{ ...S.selectSm, width: 150 }} value={quelle} onChange={(e) => setQuelle(e.target.value)}>
            <option value="">Von PC übernehmen …</option>
            {echte.map((p) => <option key={p.pcId} value={p.pcId}>{p.pcId}</option>)}
          </select>
          <button style={S.secondaryBtn} disabled={!quelle} onClick={async () => { const r = await api.planVorlageHolen(quelle); if (!r.ok) notify("PC nicht erreichbar", "err"); }}><Download size={13} /> Holen</button>
        </span>}
        {v && <button style={S.dangerBtn} onClick={() => mutate((d) => { d.plan.vorlage = null; })} title="Vorlage entfernen"><Trash2 size={12} /></button>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <Toggle checked={plan.vorlageAuto} disabled={!v} onChange={(x) => mutate((d) => { d.plan.vorlageAuto = x; })} label="Beim Verbinden automatisch schicken" />
        <span style={{ flex: 1 }} />
        <button style={S.primaryBtn} disabled={!v || !echte.length} onClick={verteilen}><Send size={14} /> An alle verteilen</button>
        <button style={S.secondaryBtn} disabled={!v || !plan.pcs.length} onClick={async () => ergebnis(await api.planPaket(), "")} title="Je Platz eine Game-PC-Show mit fertiger PC-ID, z. B. für den USB-Stick">
          <FolderDown size={13} /> Einrichtungspaket exportieren
        </button>
      </div>
      <div style={S.hint}>
        Einrichtungspaket: ein Ordner mit „PC 01.alshow“, „PC 02.alshow“ …, jede mit der PC-ID ihres Platzes. Am Game-PC über „Show → Importieren“ laden.
        Ein Game-PC nimmt keine Vorlage an, wenn dort im Tab „Session“ „Einstellungen von der Regie übernehmen“ aus ist.
      </div>
    </Section>
  );
}

export default function PlanTab(props) {
  return (
    <>
      <Plaetze {...props} />
      <NichtImPlan {...props} />
      <Vorlage {...props} />
    </>
  );
}
