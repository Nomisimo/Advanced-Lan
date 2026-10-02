import React from "react";
import { S, ACCENT, LINE, SUB, MUTED } from "../theme.js";
import { Section, Toggle, th, td, Kbd, EventIcon } from "../ui.jsx";
import { api } from "../api.js";
import { EVENT_BY_ID } from "../../core/events.js";
import { SPIEL_BY_ID } from "../../core/spiele.js";
import { PLATZHALTER } from "../../core/router.js";
import { uid } from "../../core/defaults.js";
import { Plus, Trash2, Send, Copy } from "lucide-react";

const ARG_TYPEN = [["", "kein Wert"], ["s", "Text"], ["i", "Ganzzahl"], ["f", "Kommazahl"]];

export default function CuesTab({ cfg, mutate, notify, status }) {
  const spiel = SPIEL_BY_ID[cfg.aktivesSpiel];
  const EVENT_TYPES = spiel?.events || [];
  const GRUPPEN = [...new Set(EVENT_TYPES.map((e) => e.gruppe))];
  const regeln = cfg.rules.filter((r) => (r.spiel || "cs2") === cfg.aktivesSpiel);
  const andere = cfg.rules.length - regeln.length;
  const setRegel = (id, k, v) => mutate((d) => { const r = d.rules.find((x) => x.id === id); if (r) r[k] = v; });
  const neu = (vorlage) => mutate((d) => {
    const ma3 = d.targets[0];
    d.rules.push(vorlage ? { ...vorlage, id: uid() } : { id: uid(), aktiv: true, spiel: d.aktivesSpiel, event: EVENT_TYPES[0]?.id || "", team: "", pc: "", target: ma3?.id || "", address: ma3?.typ === "ma3" ? "/gma3/cmd" : "/lanparty/{event}", argTyp: "s", argWert: "", cooldown: 0 });
  });
  const testen = async (r) => {
    const s = await api.regelTesten(r.id);
    if (!s) return;
    if (s.fehler) notify(s.fehler, "err");
    else notify(`Gesendet an ${s.ziel} (${s.an}): ${s.address} ${s.args.map((a) => JSON.stringify(a)).join(" ")}`);
  };

  if (!EVENT_TYPES.length) return (
    <Section title={`Cues · ${spiel?.name}`}>
      <div style={S.empty}>Für {spiel?.name} gibt es noch keine Ereignisse. Sobald eine Datenquelle für das Spiel eingebaut ist, lassen sich hier Cues anlegen.</div>
    </Section>
  );

  return (
    <Section title={`Cues · ${spiel?.name}`} subtitle="Jede Zeile: Wenn dieses Ereignis eintritt, geht diese OSC-Nachricht an dieses Ziel. Mehrere Zeilen für dasselbe Ereignis feuern gleichzeitig (z. B. Licht und Playout)."
      right={<button style={S.primaryBtn} onClick={() => neu()}><Plus size={14} /> Cue hinzufügen</button>}>
      <table style={S.table}>
        <thead><tr>
          <th style={th({ width: 30 })}></th><th style={th()}>Ereignis</th><th style={th()}>Team</th><th style={th()}>PC</th><th style={th()}>Ziel</th>
          <th style={th()}>OSC-Adresse</th><th style={th()}>Wert</th><th style={th()} title="Mindestabstand in Millisekunden, bevor dieser Cue erneut feuert">Sperre ms</th><th style={th()}></th>
        </tr></thead>
        <tbody>
          {regeln.map((r) => {
            const e = EVENT_BY_ID[r.event];
            return (
              <tr key={r.id} style={{ opacity: r.aktiv ? 1 : 0.5 }}>
                <td style={td()}><Toggle checked={r.aktiv} onChange={(v) => setRegel(r.id, "aktiv", v)} title="Cue aktiv" /></td>
                <td style={td({ minWidth: 200 })}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: ACCENT, display: "inline-flex" }}><EventIcon type={r.event} size={14} /></span>
                    <select style={S.selectSm} value={r.event} onChange={(ev) => setRegel(r.id, "event", ev.target.value)}>
                      {GRUPPEN.map((g) => <optgroup key={g} label={g}>{EVENT_TYPES.filter((x) => x.gruppe === g).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</optgroup>)}
                    </select>
                  </div>
                </td>
                <td style={td({ width: 90 })}>
                  <select style={S.selectSm} value={r.team || ""} disabled={!e?.team} onChange={(ev) => setRegel(r.id, "team", ev.target.value)}>
                    <option value="">alle</option><option value="CT">CT</option><option value="T">T</option>
                  </select>
                </td>
                <td style={td({ width: 110 })}>
                  <select style={S.selectSm} value={r.pc || ""} disabled={!e?.spieler} onChange={(ev) => setRegel(r.id, "pc", ev.target.value)}>
                    <option value="">alle</option>
                    {[...new Set([r.pc, ...status.pcs.filter((p) => !p.sim).map((p) => p.pcId)].filter(Boolean))].map((id) => <option key={id} value={id}>{id}</option>)}
                  </select>
                </td>
                <td style={td({ width: 130 })}>
                  <select style={S.selectSm} value={r.target} onChange={(ev) => setRegel(r.id, "target", ev.target.value)}>
                    {!cfg.targets.some((t) => t.id === r.target) && <option value="">– fehlt –</option>}
                    {cfg.targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </td>
                <td style={td({ minWidth: 170 })}><input style={{ ...S.inputSm, ...S.mono }} value={r.address} onChange={(ev) => setRegel(r.id, "address", ev.target.value)} /></td>
                <td style={td({ minWidth: 220 })}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <select style={{ ...S.selectSm, width: 96 }} value={r.argTyp || ""} onChange={(ev) => setRegel(r.id, "argTyp", ev.target.value)}>
                      {ARG_TYPEN.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                    <input style={{ ...S.inputSm, ...S.mono }} value={r.argWert || ""} disabled={!r.argTyp} placeholder={r.argTyp ? "z. B. Go+ Sequence 101" : ""} onChange={(ev) => setRegel(r.id, "argWert", ev.target.value)} />
                  </div>
                </td>
                <td style={td({ width: 90 })}><input style={S.inputSm} type="number" min="0" step="100" value={r.cooldown || 0} onChange={(ev) => setRegel(r.id, "cooldown", Math.max(0, +ev.target.value || 0))} /></td>
                <td style={td({ whiteSpace: "nowrap", textAlign: "right" })}>
                  <button style={S.smallBtn} title="Jetzt senden (auch wenn die Ausgabe aus ist)" onClick={() => testen(r)}><Send size={12} /> Test</button>
                  <button style={{ ...S.smallBtn, marginLeft: 4, background: "transparent" }} title="Duplizieren" onClick={() => neu(r)}><Copy size={12} /></button>
                  <button style={{ ...S.dangerBtn, marginLeft: 4 }} title="Löschen" onClick={() => mutate((d) => { d.rules = d.rules.filter((x) => x.id !== r.id); })}><Trash2 size={12} /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {regeln.length === 0 && <div style={S.empty}>Noch keine Cues für {spiel?.name}.</div>}
      {andere > 0 && <p style={S.hint}>{andere} weitere Cues gehören zu anderen Spielen und sind sichtbar, wenn das Spiel oben aktiv ist.</p>}
      <p style={S.hint}>
        Platzhalter in Adresse und Wert: {PLATZHALTER.map((p) => <Kbd key={p}>{`{${p}}`}</Kbd>).reduce((a, b) => [a, " ", b])}.
        Für grandMA3 schickt die Adresse <Kbd>/gma3/cmd</Kbd> mit einem Text wie <Kbd>Go+ Sequence 101</Kbd> einen Befehl an die Konsole.
        Das Präfix <Kbd>gma3</Kbd> muss zur OSC-Einstellung in der MA3 passen (siehe Tab „Ziele“).
      </p>
    </Section>
  );
}
