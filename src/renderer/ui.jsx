import React from "react";
import { S, ACCENT, LINE, SUB, MUTED, OK, WARN, ERR, teamFarbe } from "./theme.js";
import { Trophy, Timer, Bomb, Crosshair, Skull, Zap, Crown, Eye, CircleCheck, CircleX, Goal, Handshake, Shield, ShieldCheck, Target, CarFront, Flag, Play, Medal, Flame, Repeat } from "lucide-react";
import { SPIEL_BY_ID, eventInfo } from "../core/spiele.js";
import { zielTyp } from "../core/ziel-typen.js";
import { api } from "./api.js";

export function Section({ title, subtitle, right, children, style }) {
  return (
    <section style={{ ...S.section, ...style }}>
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: subtitle ? 0 : 12 }}>
          <div style={{ flex: 1 }}>{title && <h2 style={S.h2}>{title}</h2>}</div>
          {right}
        </div>
      )}
      {subtitle && <p style={S.subtitle}>{subtitle}</p>}
      {children}
    </section>
  );
}

export function Field({ label, children, hint, style }) {
  return (
    <label style={{ ...S.field, ...style }}>
      <span style={S.fieldLabel}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 10, color: MUTED }}>{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, title }) {
  return (
    <label title={title} style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", cursor: "pointer", fontSize: 12, color: "#d4d0de", userSelect: "none" }}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: ACCENT }} />
      {label}
    </label>
  );
}

export const Dot = ({ color, size = 9, title, glow }) => (
  <span title={title} style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: glow ? `0 0 8px ${color}` : "none" }} />
);

export const TeamChip = ({ team }) => team ? (
  <span style={{ ...S.badge, background: teamFarbe(team) + "22", color: teamFarbe(team), border: `1px solid ${teamFarbe(team)}66` }}>{team}</span>
) : null;


const ICONS = { Match: Trophy, Runde: Timer, Bombe: Bomb, Spieler: Crosshair };
const RL_ICONS = { goal: Goal, assist: Handshake, hat_trick: Flame, save: Shield, epic_save: ShieldCheck, shot: Target, demolition: CarFront, crossbar: Flag, kickoff: Play, overtime: Timer, podium: Medal, mvp: Crown, replay_start: Repeat, replay_end: Repeat, match_start: Trophy, match_end: Trophy };
export function EventIcon({ type, spiel = "cs2", size = 15 }) {
  if (spiel === "rl" && RL_ICONS[type]) { const Ic = RL_ICONS[type]; return <Ic size={size} />; }
  const e = eventInfo(spiel, type);
  const Ic = type === "death" ? Skull : type === "ace" || type.startsWith("multikill") ? Zap : type === "mvp" ? Crown : type === "flashed" ? Eye : ICONS[e?.gruppe] || Zap;
  return <Ic size={size} />;
}
export const eventLabel = (type, spiel = "cs2") => eventInfo(spiel, type)?.label || type;

export const zeit = (t) => new Date(t).toLocaleTimeString("de-DE");
export const th = (extra) => ({ ...S.th, ...extra });
export const td = (extra) => ({ ...S.td, ...extra });
export const Leer = ({ children }) => <div style={S.empty}>{children}</div>;
export const Kbd = ({ children }) => <code style={{ ...S.mono, background: "#1a1820", border: `1px solid ${LINE}`, borderRadius: 4, padding: "1px 5px", color: SUB }}>{children}</code>;

// Ein Prüfpunkt: grüner Haken oder rotes Kreuz, dazu Detail
export function Check({ ok, label, detail, warn }) {
  const farbe = ok ? OK : warn ? WARN : ERR;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderBottom: `1px solid ${LINE}`, fontSize: 13 }}>
      <span style={{ color: farbe, display: "inline-flex", filter: ok ? `drop-shadow(0 0 4px ${OK})` : "none" }}>{ok ? <CircleCheck size={16} /> : <CircleX size={16} />}</span>
      <span style={{ fontWeight: 600, minWidth: 220 }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, color: ok ? SUB : farbe, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={detail}>{detail}</span>
    </div>
  );
}

export const SpielChip = ({ spiel, aktiv = true }) => {
  const s = SPIEL_BY_ID[spiel];
  if (!s) return <span style={{ color: MUTED }}>{spiel || "–"}</span>;
  return <span style={{ ...S.badge, background: s.farbe + (aktiv ? "33" : "11"), color: aktiv ? s.farbe : MUTED, border: `1px solid ${s.farbe}${aktiv ? "88" : "33"}` }}>{s.kurz}</span>;
};

// Farbe je Kategorie der Ziel-Datenbank
export const KAT_FARBE = { show: "#c39bff", licht: "#f2b33d", audio: "#2ecc71", video: "#4ea1ff", steuerung: "#ff8a1f", allgemein: "#a39eb3" };
export const ZielBadge = ({ typ }) => {
  const t = zielTyp(typ), f = KAT_FARBE[t.kategorie] || SUB;
  return <span style={{ ...S.badge, background: f + "22", color: f, border: `1px solid ${f}66`, whiteSpace: "nowrap" }}>{t.name}</span>;
};

// Netzwerkkarten des PCs (Name, IP, Maske, MAC). Wird beim Öffnen und alle 5 s neu gelesen: Karten kommen und gehen.
export function useKarten() {
  const [karten, setKarten] = React.useState([]);
  React.useEffect(() => {
    let weg = false;
    const laden = () => api.netzAdressen().then((k) => !weg && setKarten(k || []));
    laden();
    const t = setInterval(laden, 5000);
    return () => { weg = true; clearInterval(t); };
  }, []);
  return karten;
}

// Auswahl einer Netzwerkkarte. Leer = automatisch. Gespeichert wird der Name, eine fehlende Karte bleibt sichtbar.
export function KartenWahl({ karten, wert, onChange, leer = "Automatisch", style }) {
  const fehlt = wert && !karten.some((k) => k.name === wert);
  return (
    <select style={{ ...S.selectSm, color: fehlt ? ERR : "#fff", ...style }} value={wert || ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">{leer}</option>
      {karten.map((k) => <option key={k.name + k.ip} value={k.name}>{k.name} · {k.ip}</option>)}
      {fehlt && <option value={wert}>{wert} (nicht verbunden)</option>}
    </select>
  );
}
