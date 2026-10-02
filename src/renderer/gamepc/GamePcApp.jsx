import React, { useState, useEffect } from "react";
import { S, ACCENT, ACCENT_HI, LINE, SUB, MUTED, ERR, WARN, OK, GLOW, teamFarbe } from "../theme.js";
import { api } from "../api.js";
import Kopf from "../Kopf.jsx";
import { Section, Field, Toggle, Dot, TeamChip, EventIcon, eventLabel, zeit, Kbd } from "../ui.jsx";
import { SPIELE, SPIEL_BY_ID } from "../../core/spiele.js";
import { CFG_ORDNER, CFG_DATEI } from "../../core/cfg.js";
import { Plug, Unplug, Radar, FileDown, Download, Eye, EyeOff, Send, CircleCheck, CircleX } from "lucide-react";

const ZUSTAND = { verbunden: ["Verbunden", OK], verbinde: ["Verbinde …", WARN], getrennt: ["Nicht verbunden", MUTED], abgelehnt: ["Abgelehnt", ERR] };
const TESTS = ["round_end", "bomb_planted", "kill"];

export default function GamePcApp({ cfg: alles, mutate: mutateAlles, status: st, jetzt, notify, version, modusWechseln }) {
  const cfg = alles.gamepc;
  const g = st.gamepc;
  const mutate = (fn) => mutateAlles((d) => fn(d.gamepc));
  const [log, setLog] = useState([]);
  const [zeigen, setZeigen] = useState(false);
  const [cs2Ordner, setCs2Ordner] = useState(undefined);
  useEffect(() => {
    api.gamePcLog().then(setLog);
    api.cs2Ordner().then(setCs2Ordner);
    return api.onGamePcEvent((e) => setLog((l) => [e, ...l].slice(0, 200)));
  }, []);

  const c = g.client;
  const [zText, zFarbe] = ZUSTAND[c.zustand] || ZUSTAND.getrennt;
  const aktivVerbunden = c.zustand === "verbunden" || c.zustand === "verbinde";
  const bereit = cfg.pcId.trim() && cfg.regie.host && cfg.passwort;
  const cs2Aktiv = g.letzte && jetzt - g.letzte < 15000;
  const verbinden = async () => { const r = await api.verbinden(); if (r?.fehler) notify(r.fehler, "err"); };
  const fertig = (r, text) => { if (r?.ok) notify(text); else if (r?.fehler) notify(r.fehler, "err"); };

  return (
    <div style={S.app}>
      <Kopf modus="GAME-PC" version={version} modusWechseln={modusWechseln} meta={<>
        <b style={{ color: "#fff" }}>{cfg.pcId || "ohne PC-ID"}</b>
        <span style={{ color: zFarbe }}> · {zText}{c.zustand === "verbunden" && c.session ? ` mit „${c.session}“` : ""}</span>
      </>} />
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <main style={S.main}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 20, alignItems: "start" }}>
            <Section title="Dieser PC" subtitle="Die PC-ID sieht die Regie in ihrer Liste. Am besten wie das Schild am Platz.">
              <Field label="PC-ID">
                <input style={{ ...S.input, fontSize: 18, fontWeight: 700 }} value={cfg.pcId} disabled={aktivVerbunden} placeholder="z. B. PC 01" onChange={(e) => mutate((d) => { d.pcId = e.target.value; })} />
              </Field>
              <div style={{ ...S.fieldLabel, margin: "14px 0 6px" }}>Spiele, die dieser PC meldet</div>
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
                {SPIELE.map((s) => {
                  const live = s.id === "cs2" && cs2Aktiv;
                  return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${LINE}`, fontSize: 13 }}>
                      <Dot color={live ? OK : s.quelle ? "#4d475c" : "#2f2c3a"} glow={live} />
                      <b style={{ color: s.farbe, minWidth: 40 }}>{s.kurz}</b>
                      <span style={{ flex: 1 }}>{s.name}</span>
                      <span style={{ fontSize: 11, color: live ? OK : SUB }}>{!s.quelle ? "noch keine Datenquelle" : live ? "Daten kommen" : "wartet auf das Spiel"}</span>
                    </div>
                  );
                })}
              </div>
              <p style={S.hint}>Läuft eines dieser Spiele, gehen seine Ereignisse automatisch an die Regie. Was damit passiert, entscheidet nur die Regie.</p>
              {aktivVerbunden && <p style={S.hint}>Zum Ändern zuerst trennen.</p>}
            </Section>

            <Section title="Regie" subtitle="Sessions im Netz erscheinen automatisch (mDNS)."
              right={aktivVerbunden
                ? <button style={{ ...S.secondaryBtn, borderColor: ERR, color: ERR }} onClick={() => api.trennen()}><Unplug size={14} /> Trennen</button>
                : <button style={S.primaryBtn} disabled={!bereit} onClick={verbinden}><Plug size={15} /> Verbinden</button>}>
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
                {g.sessions.length === 0 && <div style={{ ...S.empty, padding: 12, display: "flex", alignItems: "center", gap: 8 }}><Radar size={15} /> Suche Sessions … {g.discoveryFehler && <span style={{ color: ERR }}>({g.discoveryFehler})</span>}</div>}
                {g.sessions.map((s) => {
                  const gewaehlt = s.ip === cfg.regie.host && s.port === cfg.regie.port;
                  const sp = SPIEL_BY_ID[s.aktivesSpiel];
                  return (
                    <button key={`${s.ip}:${s.port}`} disabled={aktivVerbunden} onClick={() => mutate((d) => { d.regie = { host: s.ip, port: s.port, session: s.session }; })}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: "none", borderBottom: `1px solid ${LINE}`, padding: "10px 12px", cursor: "pointer", color: "#ece9f2",
                        background: gewaehlt ? ACCENT + "22" : "transparent", boxShadow: gewaehlt ? `inset 3px 0 0 ${ACCENT}` : "none" }}>
                      <Dot color={OK} glow />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{s.session}</div>
                        <div style={{ fontSize: 11, color: SUB }}>{s.host} · {s.ip}:{s.port}</div>
                      </div>
                      {sp && <span style={{ ...S.badge, background: sp.farbe + "22", color: sp.farbe, border: `1px solid ${sp.farbe}66` }}>aktiv: {sp.kurz}</span>}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <Field label="IP der Regie" style={{ flex: 1, minWidth: 150 }}>
                  <input style={{ ...S.input, ...S.mono, fontSize: 14 }} value={cfg.regie.host} disabled={aktivVerbunden} placeholder="aus der Liste oder von Hand" onChange={(e) => mutate((d) => { d.regie = { ...d.regie, host: e.target.value.trim(), session: "" }; })} />
                </Field>
                <Field label="Port">
                  <input style={{ ...S.input, width: 90 }} type="number" value={cfg.regie.port} disabled={aktivVerbunden} onChange={(e) => mutate((d) => { d.regie.port = +e.target.value || 0; })} />
                </Field>
                <Field label="Passwort der Session" style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input style={{ ...S.input, flex: 1 }} type={zeigen ? "text" : "password"} value={cfg.passwort} disabled={aktivVerbunden} onChange={(e) => mutate((d) => { d.passwort = e.target.value; })} onKeyDown={(e) => e.key === "Enter" && bereit && verbinden()} />
                    <button style={S.ghostBtn} onClick={() => setZeigen((z) => !z)}>{zeigen ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                  </div>
                </Field>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: zFarbe }}>
                  <Dot color={zFarbe} glow={c.zustand === "verbunden"} /> {zText}{c.grund ? `: ${c.grund}` : ""}
                </span>
                <span style={{ flex: 1 }} />
                <Toggle checked={cfg.autoVerbinden} onChange={(v) => mutate((d) => { d.autoVerbinden = v; })} label="Beim Start automatisch verbinden" />
              </div>
              {c.zustand === "verbunden" && c.aktivesSpiel && (
                <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, fontSize: 13, background: ACCENT + "14", border: `1px solid ${ACCENT}55` }}>
                  Die Regie nutzt gerade <b>{SPIEL_BY_ID[c.aktivesSpiel]?.name || c.aktivesSpiel}</b>. Dieser PC schickt trotzdem alles, was er erkennt.
                </div>
              )}
            </Section>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 20, alignItems: "start" }}>
              <Section title="CS2 einrichten" subtitle="CS2 schickt seinen Spielstand an diese App (Valve Game State Integration). Dafür muss einmal eine cfg-Datei in den CS2-Ordner.">
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}>
                  <Dot color={cs2Aktiv ? OK : g.gsi.fehler ? ERR : "#4d475c"} glow={cs2Aktiv} />
                  {g.gsi.fehler ? <span style={{ color: ERR }}>Empfang gestört: {g.gsi.fehler}</span>
                    : cs2Aktiv ? <span>CS2 sendet (zuletzt vor {Math.round((jetzt - g.letzte) / 1000)} s)</span>
                    : <span style={{ color: SUB }}>Noch keine Daten von CS2. cfg installieren und CS2 (neu) starten.</span>}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={S.primaryBtn} onClick={async () => fertig(await api.cfgInstallieren(), "cfg installiert. CS2 jetzt neu starten.")}><Download size={15} /> cfg installieren</button>
                  <button style={S.secondaryBtn} onClick={async () => fertig(await api.cfgSpeichern(), "cfg gespeichert.")}><FileDown size={14} /> cfg speichern unter …</button>
                </div>
                <p style={S.hint}>
                  {cs2Ordner ? <>CS2 gefunden: <Kbd>{cs2Ordner}</Kbd></> : cs2Ordner === null ? <>CS2-Ordner nicht automatisch gefunden. Dann „speichern unter …“ und die Datei <Kbd>{CFG_DATEI}</Kbd> nach <Kbd>{CFG_ORDNER}</Kbd> legen.</> : "Suche CS2 …"}
                  {" "}Empfang lokal auf Port {g.gsi.port}.{g.fremd > 0 && <span style={{ color: WARN }}> {g.fremd} Nachrichten mit falschem Token (alte cfg?).</span>}
                </p>
                {g.status && (
                  <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 12, padding: "10px 12px", background: "#1a1820", border: `1px solid ${LINE}`, borderLeft: `3px solid ${teamFarbe(g.status.team)}`, borderRadius: 8, fontSize: 13 }}>
                    <b>{g.status.spieler || (g.status.zuschauer ? `schaut ${g.status.zuschauer} zu` : "im Menü")}</b>
                    <TeamChip team={g.status.team} />
                    {g.status.health != null && <span style={{ color: SUB }}>{g.status.health} HP · {g.status.kills}/{g.status.deaths}</span>}
                    {g.stand && <span style={{ color: SUB, marginLeft: "auto" }}>{g.stand.map} · {g.stand.ct}:{g.stand.tt}</span>}
                  </div>
                )}
              </Section>

            <Section title="An die Regie geschickt" subtitle="Ereignisse dieses PCs. Mit den Test-Knöpfen lässt sich die Verbindung prüfen, ohne zu spielen."
              right={<div style={{ display: "flex", gap: 6 }}>{TESTS.map((t) => (
                <button key={t} style={S.smallBtn} disabled={c.zustand !== "verbunden"} onClick={() => api.testEvent(t)} title={`Test: CS2 ${eventLabel(t)} an die Regie`}><Send size={11} /> {eventLabel(t)}</button>
              ))}</div>}>
              <div style={{ maxHeight: 340, minHeight: 160, overflowY: "auto", border: `1px solid ${LINE}`, borderRadius: 8, background: "#1a1820" }}>
                {log.length === 0 ? <div style={{ ...S.empty, padding: 14 }}>Noch nichts geschickt.</div> : log.map((e, i) => (
                  <div key={e.id} className={i === 0 ? "neu" : ""} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: `1px solid ${LINE}`, fontSize: 13 }}>
                    <span style={{ fontSize: 11, color: MUTED }}>{zeit(e.t)}</span>
                    <span style={{ color: e.ev.team ? teamFarbe(e.ev.team) : ACCENT_HI, display: "inline-flex" }}><EventIcon type={e.ev.type} /></span>
                    <b>{eventLabel(e.ev.type)}</b>
                    <TeamChip team={e.ev.team} />
                    {e.ev.player && <span style={{ color: "#d4d0de" }}>{e.ev.player}</span>}
                    {e.ev.test && <span style={{ ...S.badge, background: "#2f2c3a", color: SUB }}>Test</span>}
                    <span style={{ flex: 1 }} />
                    {e.gesendet ? <span title="an die Regie geschickt" style={{ color: OK, display: "inline-flex" }}><CircleCheck size={14} /></span> : <span title="nicht verbunden, verworfen" style={{ color: ERR, display: "inline-flex" }}><CircleX size={14} /></span>}
                  </div>
                ))}
              </div>
              <p style={S.hint}>{c.gesendet} geschickt{c.verworfen ? `, davon ${c.verworfen} von der Regie nicht genutzt (anderes Spiel aktiv)` : ""}.</p>
            </Section>
          </div>
        </main>
      </div>
    </div>
  );
}
