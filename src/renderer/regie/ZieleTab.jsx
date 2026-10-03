import React, { useState, useEffect } from "react";
import { S, SUB, MUTED, LINE, FELD, ACCENT, GLOW } from "../theme.js";
import { Section, th, td, ZielBadge, KAT_FARBE } from "../ui.jsx";
import { api } from "../api.js";
import { uid } from "../../core/defaults.js";
import { ZIEL_TYPEN, KATEGORIEN, zielTyp, befehleVon } from "../../core/ziel-typen.js";
import { Plus, Trash2, Send, BookOpen, Info, X, ExternalLink } from "lucide-react";

// OSC-Vorlage lesbar: /{prefix}/cmd s "Goto Sequence {seq} Cue {cue}"
const zeigeVorlage = (n) => [n.address, ...(n.argsFrei ? [n.argsFrei] : (n.args || []).map((a) => (a.type === "s" ? `s "${a.value}"` : `${a.type} ${a.value ?? ""}`.trim())))].join("  ");

const InfoKnopf = ({ onClick }) => (
  <button onClick={onClick} title="Infos zum Ziel" style={{ background: "transparent", border: "none", color: SUB, cursor: "pointer", padding: 2, display: "inline-flex" }}><Info size={15} /></button>
);

// Legende eines Ziels: was es ist, wie man es einrichtet, welche Befehle die App sendet
function ZielInfo({ typ, onClose }) {
  const t = zielTyp(typ), f = KAT_FARBE[t.kategorie];
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const H = ({ children }) => <div style={{ fontSize: 11, color: SUB, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "16px 0 6px" }}>{children}</div>;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(8,6,12,.72)", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#23212c", border: `1px solid ${ACCENT}`, boxShadow: "0 0 30px rgba(157,92,255,.35)", borderRadius: 12, width: "min(860px, 100%)", maxHeight: "86vh", overflow: "auto", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ ...S.h2, margin: 0, fontSize: 20 }}>{t.name}</h2>
          <span style={{ ...S.badge, background: f + "22", color: f }}>{KATEGORIEN.find((k) => k.id === t.kategorie)?.name}</span>
          <span style={{ fontSize: 12, color: MUTED, flex: 1 }}>{t.hersteller}</span>
          <button onClick={onClose} style={{ ...S.smallBtn, padding: 6 }} title="Schließen"><X size={14} /></button>
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 14, fontSize: 13 }}>
          <div><div style={{ fontSize: 11, color: SUB }}>Protokoll</div><b style={S.mono}>OSC über {t.protokoll}</b></div>
          <div><div style={{ fontSize: 11, color: SUB }}>Standard-Port</div><b style={S.mono}>{t.port}</b></div>
          {(t.optionen || []).map((o) => <div key={o.key}><div style={{ fontSize: 11, color: SUB }}>Option „{o.label}“</div><b style={S.mono}>{o.standard || "leer"}</b></div>)}
        </div>
        <H>Am Gerät einrichten</H>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "#d4d0de" }}>{t.einrichten}</div>
        <H>Befehle ({befehleVon(t.id).length})</H>
        <table style={{ ...S.table, marginTop: 0 }}>
          <thead><tr><th style={th()}>Befehl</th><th style={th()}>Werte</th><th style={th()}>OSC-Nachricht</th></tr></thead>
          <tbody>
            {befehleVon(t.id).map((b) => (
              <tr key={b.id}>
                <td style={td({ verticalAlign: "top", fontWeight: 600, whiteSpace: "nowrap" })}>{b.label}</td>
                <td style={td({ verticalAlign: "top", fontSize: 12, color: SUB })}>{b.params.map((p) => p.label).join(", ") || "–"}</td>
                <td style={td({ verticalAlign: "top", ...S.mono, fontSize: 11, color: "#d9c6ff" })}>{b.osc.map((n, i) => <div key={i}>{zeigeVorlage(n)}</div>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {t.vorab?.length > 0 && <div style={{ ...S.hint }}>Ist die Option „{t.optionen.find((o) => o.key === t.vorab[0].nurWenn)?.label}“ gesetzt, geht vor jedem Befehl <code style={S.mono}>{zeigeVorlage(t.vorab[0])}</code> raus.</div>}
        <H>Quelle</H>
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "#d4d0de" }}>{t.quelle}</div>
        <button style={{ ...S.secondaryBtn, marginTop: 12 }} onClick={() => api.openExternal(t.doku)}><ExternalLink size={13} /> Dokumentation des Herstellers</button>
      </div>
    </div>
  );
}

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

function Datenbank({ cfg, mutate, notify, setInfo }) {
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
                <InfoKnopf onClick={() => setInfo(t.id)} />
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: SUB }}>
                <span style={{ ...S.badge, background: f + "22", color: f, whiteSpace: "nowrap" }}>{KATEGORIEN.find((k) => k.id === t.kategorie)?.name}</span>
                <span style={{ ...S.mono, whiteSpace: "nowrap" }}>{t.protokoll} {t.port}</span>
                <span style={{ flex: 1, textAlign: "right", whiteSpace: "nowrap" }}>{befehleVon(t.id).length} Befehle</span>
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
  const [info, setInfo] = useState(null);
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
                    <td style={td({ width: 170, whiteSpace: "nowrap" })}><ZielBadge typ={t.typ} /> <InfoKnopf onClick={() => setInfo(t.typ)} /></td>
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
      <Datenbank cfg={cfg} mutate={mutate} notify={notify} setInfo={setInfo} />
      {info && <ZielInfo typ={info} onClose={() => setInfo(null)} />}
    </>
  );
}
