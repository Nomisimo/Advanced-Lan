import React from "react";
import { S, ACCENT, LINE, SUB, MUTED, teamFarbe } from "./theme.js";
import { Trophy, Timer, Bomb, Crosshair, Skull, Zap, Crown, Eye } from "lucide-react";
import { EVENT_BY_ID } from "../core/events.js";

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
export function EventIcon({ type, size = 15 }) {
  const e = EVENT_BY_ID[type];
  const Ic = type === "death" ? Skull : type === "ace" || type.startsWith("multikill") ? Zap : type === "mvp" ? Crown : type === "flashed" ? Eye : ICONS[e?.gruppe] || Zap;
  return <Ic size={size} />;
}
export const eventLabel = (type) => EVENT_BY_ID[type]?.label || type;

export const zeit = (t) => new Date(t).toLocaleTimeString("de-DE");
export const th = (extra) => ({ ...S.th, ...extra });
export const td = (extra) => ({ ...S.td, ...extra });
export const Leer = ({ children }) => <div style={S.empty}>{children}</div>;
export const Kbd = ({ children }) => <code style={{ ...S.mono, background: "#1a1820", border: `1px solid ${LINE}`, borderRadius: 4, padding: "1px 5px", color: SUB }}>{children}</code>;
