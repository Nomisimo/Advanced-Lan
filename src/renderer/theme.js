// Designsprache wie Stromplaner und Netzwerkplaner, Akzent Lila mit leichtem Glow
import { TEAM_FARBEN } from "../core/spiele.js";
export const ACCENT = "#9d5cff", ACCENT_HI = "#c39bff", DARK = "#1b1922", PANEL = "#23212c", LINE = "#3a3647", BG = "#131118", FELD = "#1a1820";
export const OK = "#2ecc71", WARN = "#f39c12", ERR = "#ff5d5d", INFO = "#4ea1ff", MUTED = "#7f7a8e", SUB = "#a39eb3";
export const CT = "#5aa9ff", TT = "#f2b33d"; // Teamfarben wie im Spiel
export const BLAU = "#3b9dff", ORANGE = "#ff8a1f"; // Rocket League
export const GLOW = "0 0 14px rgba(157,92,255,.45)";
export const GLOW_STARK = "0 0 18px rgba(157,92,255,.75), 0 0 2px rgba(195,155,255,.9)";
export const teamFarbe = (t) => TEAM_FARBEN[t] || SUB; // Teams aller Spiele (core/spiele.js)

export const S = {
  app:          { fontFamily: "'Segoe UI',system-ui,sans-serif", background: BG, height: "100vh", color: "#ece9f2", display: "flex", flexDirection: "column", overflow: "hidden" },
  header:       { display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", background: DARK, borderBottom: `2px solid ${ACCENT}`, boxShadow: "0 2px 16px rgba(157,92,255,.28)", position: "relative", zIndex: 10, flexWrap: "wrap", flexShrink: 0 },
  logo:         { fontWeight: 800, fontSize: 18, letterSpacing: 1, color: ACCENT_HI, whiteSpace: "nowrap", textShadow: "0 0 10px rgba(157,92,255,.7)" },
  headerMeta:   { fontSize: 12, color: SUB, flex: 1, minWidth: 120 },
  ghostBtn:     { background: "transparent", color: "#ece9f2", border: `1px solid ${LINE}`, borderRadius: 6, padding: "7px 11px", fontWeight: 600, cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 },
  nav:          { display: "flex", gap: 4, padding: "0 18px", background: DARK, borderBottom: `1px solid ${LINE}`, flexWrap: "wrap", position: "relative", zIndex: 9, flexShrink: 0 },
  navBtn:       { background: "transparent", border: "none", color: SUB, padding: "11px 13px", cursor: "pointer", fontSize: 13, borderBottom: "3px solid transparent", transition: "color .14s,border-color .14s", display: "inline-flex", alignItems: "center", gap: 6 },
  navBtnActive: { color: "#fff", borderBottom: `3px solid ${ACCENT}`, fontWeight: 600, textShadow: "0 0 8px rgba(157,92,255,.6)" },
  main:         { padding: 20, maxWidth: 1400, margin: "0 auto" },
  section:      { background: PANEL, borderRadius: 10, padding: 20, marginBottom: 20, border: `1px solid ${LINE}` },
  h2:           { margin: "0 0 4px", fontSize: 17, color: "#fff" },
  subtitle:     { margin: "0 0 14px", fontSize: 12, color: SUB, lineHeight: 1.5 },
  field:        { display: "flex", flexDirection: "column", gap: 4 },
  fieldLabel:   { fontSize: 11, color: SUB, fontWeight: 600 },
  input:        { background: FELD, border: `1px solid ${LINE}`, borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 14 },
  inputSm:      { background: FELD, border: `1px solid ${LINE}`, borderRadius: 5, padding: "5px 8px", color: "#fff", fontSize: 13, width: "100%", boxSizing: "border-box" },
  select:       { background: FELD, border: `1px solid ${LINE}`, borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 14, minWidth: 160 },
  selectSm:     { background: FELD, border: `1px solid ${LINE}`, borderRadius: 5, padding: "5px 8px", color: "#fff", fontSize: 13, width: "100%", boxSizing: "border-box" },
  row:          { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 },
  primaryBtn:   { background: ACCENT, color: "#fff", border: "none", borderRadius: 6, padding: "9px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: GLOW },
  secondaryBtn: { background: "#2f2c3a", color: "#fff", border: `1px solid ${LINE}`, borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 },
  smallBtn:     { background: "#2f2c3a", color: "#fff", border: `1px solid ${LINE}`, borderRadius: 5, padding: "4px 8px", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 },
  dangerBtn:    { background: "transparent", color: ERR, border: "1px solid #5a2a32", borderRadius: 5, padding: "4px 9px", cursor: "pointer", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 },
  table:        { width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 13 },
  th:           { textAlign: "left", padding: "7px 8px", borderBottom: `2px solid ${LINE}`, color: SUB, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" },
  td:           { padding: "5px 8px", borderBottom: `1px solid ${LINE}`, verticalAlign: "middle" },
  empty:        { color: MUTED, fontStyle: "italic", padding: "16px 0" },
  hint:         { fontSize: 11, color: MUTED, marginTop: 10, lineHeight: 1.5 },
  chip:         { display: "inline-flex", alignItems: "center", gap: 4, background: FELD, border: `1px solid ${LINE}`, borderRadius: 12, padding: "2px 8px", fontSize: 11, color: "#d4d0de", whiteSpace: "nowrap" },
  badge:        { display: "inline-block", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 },
  mono:         { fontFamily: "Consolas,'SF Mono',Menlo,monospace", fontSize: 12 },
};
