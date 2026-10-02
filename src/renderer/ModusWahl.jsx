import React from "react";
import { S, ACCENT, ACCENT_HI, LINE, SUB, MUTED, GLOW } from "./theme.js";
import { APP_ICON } from "./Kopf.jsx";
import { Clapperboard, Gamepad2 } from "lucide-react";

const Karte = ({ icon: Ic, titel, text, onClick }) => (
  <button className="glow-hover" onClick={onClick}
    style={{ flex: 1, minWidth: 300, maxWidth: 420, textAlign: "left", background: "#1e1c26", border: `1px solid ${LINE}`, borderRadius: 12, padding: 26, cursor: "pointer", color: "#ece9f2" }}>
    <div style={{ width: 54, height: 54, borderRadius: 12, background: ACCENT + "22", border: `1px solid ${ACCENT}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: GLOW, color: ACCENT_HI }}><Ic size={28} /></div>
    <div style={{ fontSize: 20, fontWeight: 800, margin: "16px 0 6px" }}>{titel}</div>
    <div style={{ fontSize: 13, color: SUB, lineHeight: 1.6 }}>{text}</div>
  </button>
);

export default function ModusWahl({ onWahl, version }) {
  return (
    <div style={{ ...S.app, alignItems: "center", justifyContent: "center", overflow: "auto", padding: 24 }}>
      <img src={APP_ICON} alt="" style={{ width: 84, height: 84, filter: "drop-shadow(0 0 16px rgba(157,92,255,.75))" }} />
      <div style={{ ...S.logo, fontSize: 30, marginTop: 12 }}>ADVANCED LAN</div>
      <div style={{ color: SUB, fontSize: 14, margin: "6px 0 30px" }}>Wofür ist dieser PC da?</div>
      <div style={{ display: "flex", gap: 22, flexWrap: "wrap", justifyContent: "center", width: "100%" }}>
        <Karte icon={Gamepad2} titel="Game-PC" onClick={() => onWahl("gamepc")}
          text="Auf diesem PC wird gespielt." />
        <Karte icon={Clapperboard} titel="Regie" onClick={() => onWahl("regie")}
          text="Öffnet die Session und sendet die Signale. Hier läuft kein Spiel." />
      </div>
      {version && <div style={{ color: MUTED, fontSize: 11, marginTop: 28 }}>v{version}</div>}
    </div>
  );
}
