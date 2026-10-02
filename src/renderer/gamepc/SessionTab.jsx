import React, { useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, OK } from "../theme.js";
import { api } from "../api.js";
import { Section, Field, Toggle, Dot, SpielChip } from "../ui.jsx";
import { ZUSTAND } from "./GamePcApp.jsx";
import { Plug, Unplug, Radar, Eye, EyeOff, Lock, Server } from "lucide-react";

export default function SessionTab({ cfg, mutate, g, notify }) {
  const [zeigen, setZeigen] = useState(false);
  const c = g.client;
  const [zText, zFarbe] = ZUSTAND[c.zustand] || ZUSTAND.getrennt;
  const aktiv = c.zustand === "verbunden" || c.zustand === "verbinde";
  const gewaehlt = g.sessions.find((s) => s.id === cfg.regie.id);
  const bereit = cfg.pcId.trim() && gewaehlt && cfg.passwort;
  const verbinden = async () => { const r = await api.verbinden(); if (r?.fehler) notify(r.fehler, "err"); };
  const waehlen = (s) => mutate((d) => { d.regie = { id: s.id, session: s.session, host: s.ip, port: s.port }; });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 20, alignItems: "start" }}>
      <Section title="Dieser PC">
        <Field label="PC-ID">
          <div style={{ position: "relative" }}>
            <input style={{ ...S.input, width: "100%", fontSize: 20, fontWeight: 800, paddingRight: 34 }} value={cfg.pcId} disabled={aktiv} placeholder="PC 01"
              title={aktiv ? "Nur ohne aktive Session änderbar" : undefined} onChange={(e) => mutate((d) => { d.pcId = e.target.value; })} />
            {aktiv && <Lock size={15} color={MUTED} style={{ position: "absolute", right: 11, top: 13 }} />}
          </div>
        </Field>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 14, fontWeight: 700, color: zFarbe }}>
          <Dot color={zFarbe} glow={c.zustand === "verbunden"} size={10} /> {zText}{c.grund ? <span style={{ fontWeight: 400, fontSize: 12 }}>: {c.grund}</span> : null}
        </div>
        {c.zustand === "verbunden" && c.aktivesSpiel && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: SUB }}>Regie nutzt <SpielChip spiel={c.aktivesSpiel} /></div>
        )}
      </Section>

      <Section title="Sessions im Netz" right={<span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: SUB }}><Radar size={13} className="suche" /> {g.sessions.length} gefunden</span>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {g.sessions.length === 0 && (
            <div style={{ ...S.empty, display: "flex", alignItems: "center", gap: 10, border: `1px dashed ${LINE}`, borderRadius: 8, padding: 16, fontStyle: "normal" }}>
              <Radar size={18} className="suche" /> Suche … {g.discoveryFehler && <span style={{ color: ERR }}>({g.discoveryFehler})</span>}
            </div>
          )}
          {g.sessions.map((s) => {
            const an = s.id === cfg.regie.id;
            const verbundenHier = an && c.zustand === "verbunden";
            return (
              <button key={s.id} disabled={aktiv && !an} onClick={() => !aktiv && waehlen(s)} className="glow-hover"
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", borderRadius: 10, padding: "12px 14px", cursor: aktiv ? "default" : "pointer", color: "#ece9f2",
                  border: `1px solid ${an ? ACCENT : LINE}`, background: an ? ACCENT + "1f" : "#1e1c26", boxShadow: an ? `0 0 14px ${ACCENT}55` : "none" }}>
                <Server size={20} color={an ? ACCENT : SUB} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{s.session}</div>
                  <div style={{ fontSize: 11, color: SUB }}>{s.host}</div>
                </div>
                {s.aktivesSpiel && <SpielChip spiel={s.aktivesSpiel} />}
                {verbundenHier && <span style={{ ...S.badge, background: OK + "22", color: OK, border: `1px solid ${OK}66` }}>verbunden</span>}
              </button>
            );
          })}
        </div>
        {(gewaehlt || aktiv) && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 16, flexWrap: "wrap" }}>
            <Field label={`Passwort für „${gewaehlt?.session || cfg.regie.session}“`} style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <input style={{ ...S.input, flex: 1 }} type={zeigen ? "text" : "password"} value={cfg.passwort} disabled={aktiv} onChange={(e) => mutate((d) => { d.passwort = e.target.value; })} onKeyDown={(e) => e.key === "Enter" && bereit && verbinden()} />
                <button style={S.ghostBtn} onClick={() => setZeigen((z) => !z)}>{zeigen ? <EyeOff size={14} /> : <Eye size={14} />}</button>
              </div>
            </Field>
            {aktiv
              ? <button style={{ ...S.secondaryBtn, padding: "9px 14px", borderColor: ERR, color: ERR }} onClick={() => api.trennen()}><Unplug size={14} /> Trennen</button>
              : <button style={{ ...S.primaryBtn, padding: "10px 18px" }} disabled={!bereit} onClick={verbinden}><Plug size={15} /> Beitreten</button>}
          </div>
        )}
        <div style={{ marginTop: 14 }}><Toggle checked={cfg.autoVerbinden} onChange={(v) => mutate((d) => { d.autoVerbinden = v; })} label="Beim Start automatisch beitreten" /></div>
      </Section>
    </div>
  );
}
