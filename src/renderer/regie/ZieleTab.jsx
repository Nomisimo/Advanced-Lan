import React, { useState } from "react";
import { S, SUB, MUTED, LINE, FELD, ACCENT, GLOW } from "../theme.js";
import { Section, th, td, ZielBadge, KAT_FARBE } from "../ui.jsx";
import { api } from "../api.js";
import { uid } from "../../core/defaults.js";
import { ZIEL_TYPEN, KATEGORIEN, zielTyp } from "../../core/ziel-typen.js";
import { Plus, Trash2, Send, BookOpen } from "lucide-react";

// Wie oft ein Ziel im Tab „Signale“ benutzt wird
function nutzung(cfg, zielId) {
  let n = 0;
  for (const evs of Object.values(cfg.signale || {})) for (const l of Object.values(evs || {})) if (Array.isArray(l)) n += l.filter((z) => z.ziel === zielId).length;
  return n;
}

function eindeutigerName(cfg, name) {
  const namen = new Set(cfg.targets.map((t) => t.name));
  if (!namen.has(name)) return name;
  for (let i = 2; ; i++) if (!namen.has(`${name} ${i}`)) return `${name} ${i}`;
}

function Datenbank({ cfg, mutate, notify }) {
  const [kat, setKat] = useState("alle");
  const anlegen = (t) => {
    const name = eindeutigerName(cfg, t.name);
    mutate((d) => { d.targets.push({ id: uid(), typ: t.id, name, host: "", port: t.port, optionen: Object.fromEntries((t.optionen || []).map((o) => [o.key, o.standard])) }); });
    notify(`Ziel „${name}“ angelegt. IP-Adresse eintragen.`);
  };
  const liste = ZIEL_TYPEN.filter((t) => kat === "alle" || t.kategorie === kat);
  return (
    <Section title="Ziel-Datenbank" right={
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {[{ id: "alle", name: "Alle" }, ...KATEGORIEN].map((k) => (
          <button key={k.id} onClick={() => setKat(k.id)} style={{ ...S.smallBtn, ...(kat === k.id ? { borderColor: ACCENT, color: "#fff", boxShadow: GLOW } : { color: SUB }) }}>{k.name}</button>
        ))}
      </div>}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
        {liste.map((t) => {
          const f = KAT_FARBE[t.kategorie];
          return (
            <div key={t.id} style={{ background: FELD, border: `1px solid ${LINE}`, borderLeft: `3px solid ${f}`, borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <b style={{ fontSize: 14 }}>{t.name}</b>
                <span style={{ fontSize: 11, color: MUTED, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.hersteller}</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: SUB }}>
                <span style={{ ...S.badge, background: f + "22", color: f }}>{KATEGORIEN.find((k) => k.id === t.kategorie)?.name}</span>
                <span style={S.mono}>{t.protokoll} {t.port}</span>
                <span style={{ flex: 1, textAlign: "right" }}>{t.befehle.length ? `${t.befehle.length} Befehle` : "frei"}</span>
              </div>
              <button style={{ ...S.secondaryBtn, marginTop: 2 }} onClick={() => anlegen(t)}><Plus size={13} /> Anlegen</button>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export default function ZieleTab({ cfg, mutate, notify, goTab }) {
  const setZiel = (id, fn) => mutate((d) => { const t = d.targets.find((x) => x.id === id); if (t) fn(t); });
  const loeschen = (t) => {
    const n = nutzung(cfg, t.id);
    if (n && !window.confirm(`„${t.name}“ wird in ${n} Signal-Befehl(en) benutzt. Trotzdem löschen? Die Befehle werden mit entfernt.`)) return;
    mutate((d) => {
      d.targets = d.targets.filter((x) => x.id !== t.id);
      for (const evs of Object.values(d.signale || {})) for (const k of Object.keys(evs || {})) if (Array.isArray(evs[k])) evs[k] = evs[k].filter((z) => z.ziel !== t.id);
    });
  };
  return (
    <>
      <Section title="Ziele" right={goTab && <button style={S.smallBtn} onClick={() => goTab("hilfe")}><BookOpen size={12} /> Einrichtung der Ziele</button>}>
        {cfg.targets.length === 0 ? <div style={S.empty}>Noch kein Ziel. Unten aus der Ziel-Datenbank anlegen.</div> : (
          <table style={{ ...S.table, marginTop: 0 }}>
            <thead><tr><th style={th()}>Typ</th><th style={th()}>Name</th><th style={th()}>IP-Adresse</th><th style={th()}>Port (UDP)</th><th style={th()}>Optionen</th><th style={th()}>Signale</th><th style={th()}></th></tr></thead>
            <tbody>
              {cfg.targets.map((t) => {
                const typ = zielTyp(t.typ), n = nutzung(cfg, t.id);
                return (
                  <tr key={t.id}>
                    <td style={td({ width: 150 })}><ZielBadge typ={t.typ} /></td>
                    <td style={td()}><input style={S.inputSm} value={t.name} placeholder={typ.name} onChange={(e) => setZiel(t.id, (z) => { z.name = e.target.value; })} /></td>
                    <td style={td({ width: 170 })}><input style={{ ...S.inputSm, ...S.mono }} value={t.host} placeholder="192.168.1.50" onChange={(e) => setZiel(t.id, (z) => { z.host = e.target.value.trim(); })} /></td>
                    <td style={td({ width: 100 })}><input style={S.inputSm} type="number" min="1" max="65535" value={t.port} onChange={(e) => setZiel(t.id, (z) => { z.port = +e.target.value || 0; })} /></td>
                    <td style={td({ width: 160 })}>
                      {(typ.optionen || []).map((o) => (
                        <label key={o.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: SUB }}>{o.label}
                          <input style={{ ...S.inputSm, ...S.mono }} value={t.optionen?.[o.key] ?? o.standard} onChange={(e) => setZiel(t.id, (z) => { z.optionen = { ...(z.optionen || {}), [o.key]: e.target.value.trim() }; })} />
                        </label>
                      ))}
                      {!typ.optionen?.length && <span style={{ color: MUTED }}>–</span>}
                    </td>
                    <td style={td({ width: 70, color: n ? "#d9c6ff" : MUTED })}>{n}</td>
                    <td style={td({ whiteSpace: "nowrap", textAlign: "right", width: 110 })}>
                      <button style={S.smallBtn} title="Testnachricht senden" onClick={async () => { const r = await api.zielTesten(t.id); r.ok ? notify(`${r.nachricht} an ${t.host}:${t.port} geschickt.`) : notify(r.fehler, "err"); }}><Send size={12} /> Test</button>
                      <button style={{ ...S.dangerBtn, marginLeft: 6 }} onClick={() => loeschen(t)}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>
      <Datenbank cfg={cfg} mutate={mutate} notify={notify} />
    </>
  );
}
