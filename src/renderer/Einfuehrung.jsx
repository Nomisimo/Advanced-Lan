import React, { useState, useEffect } from "react";
import { S, ACCENT, ACCENT_HI, LINE, SUB, MUTED, GLOW } from "./theme.js";
import { APP_ICON } from "./Kopf.jsx";
import { Kbd } from "./ui.jsx";
import { api } from "./api.js";
import { LINKS, hotkeyText } from "../core/app-info.js";
import { Gamepad2, Clapperboard, MonitorPlay, Lightbulb, Volume2, Video, Keyboard, ShieldCheck, ExternalLink } from "lucide-react";

// Einführung beim ersten Start (Overwolf: First Time User Experience). Danach nie wieder, außer über Setup → App.
const Zeile = ({ icon: Ic, titel, text }) => (
  <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "10px 0" }}>
    <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: ACCENT + "22", border: `1px solid ${ACCENT}`, display: "flex", alignItems: "center", justifyContent: "center", color: ACCENT_HI }}><Ic size={19} /></div>
    <div><div style={{ fontWeight: 700, color: "#fff" }}>{titel}</div><div style={{ fontSize: 13, color: SUB, lineHeight: 1.5 }}>{text}</div></div>
  </div>
);

const LinkKnopf = ({ url, children }) => (
  <button style={{ ...S.smallBtn, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => api.openExternal(url)}><ExternalLink size={12} /> {children}</button>
);

export default function Einfuehrung({ cfg, status, mutate, notify }) {
  const [schritt, setSchritt] = useState(0);
  const [zugestimmt, setZugestimmt] = useState(!!cfg.app?.bedingungen);
  const [cmp, setCmp] = useState(null);
  useEffect(() => { api.cmpPruefen().then(setCmp).catch(() => setCmp({ verfuegbar: false })); }, []);
  const plattform = status.app?.plattform;
  const hotkey = cfg.app?.hotkey;

  const fertig = () => mutate((d) => { d.app = { ...d.app, einfuehrung: true, bedingungen: d.app?.bedingungen || new Date().toISOString() }; });
  const privacy = async () => { const r = await api.privacyOeffnen(); if (r?.fehler) notify(r.fehler, "warn"); };

  const SCHRITTE = [
    {
      titel: "Willkommen bei Advanced LAN",
      inhalt: <>
        <p style={{ color: SUB, fontSize: 14, lineHeight: 1.6, margin: "0 0 8px" }}>Was im Spiel passiert, wird auf der Bühne sichtbar und hörbar: Kills, Runden, Tore und Siege lösen Licht, Ton und Video aus.</p>
        <Zeile icon={Lightbulb} titel="Licht" text="Befehle an grandMA3, Eos, MagicQ und jedes OSC-Lichtpult." />
        <Zeile icon={Volume2} titel="Audio" text="QLab, REAPER, Ableton, X32 und weitere Geräte mit OSC." />
        <Zeile icon={Video} titel="Video und Stream" text="Resolume, Millumin, TouchDesigner und der Game-Stats-Screen als Fenster oder NDI-Quelle." />
      </>,
    },
    {
      titel: "Drei Modi",
      inhalt: <>
        <p style={{ color: SUB, fontSize: 14, lineHeight: 1.6, margin: "0 0 8px" }}>Gleich wählst du, wofür dieser PC da ist. Wechseln geht jederzeit über den Knopf oben rechts.</p>
        <Zeile icon={Gamepad2} titel="Game-PC" text="Hier wird gespielt. Die App meldet die Spielereignisse an die Regie." />
        <Zeile icon={Clapperboard} titel="Regie" text="Öffnet eine Session im LAN, sammelt die Events aller Game-PCs und sendet die Befehle." />
        <Zeile icon={MonitorPlay} titel="Standalone" text="Spiel und Regie auf einem PC, ganz ohne zweiten Rechner." />
      </>,
    },
    {
      titel: "Tastenkürzel",
      inhalt: <>
        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "6px 0 16px" }}>
          <div style={{ width: 54, height: 54, borderRadius: 12, background: ACCENT + "22", border: `1px solid ${ACCENT}`, display: "flex", alignItems: "center", justifyContent: "center", color: ACCENT_HI, boxShadow: GLOW }}><Keyboard size={26} /></div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{hotkey ? <Kbd>{hotkeyText(hotkey, plattform)}</Kbd> : "aus"}</div>
        </div>
        <p style={{ color: SUB, fontSize: 14, lineHeight: 1.6, margin: 0 }}>Blendet Advanced LAN ein und aus, auch mitten im Spiel. Ändern kannst du es unter <b>Setup → App</b>.</p>
      </>,
    },
    {
      titel: "Datenschutz",
      inhalt: <>
        <Zeile icon={ShieldCheck} titel="Deine Daten bleiben im LAN" text="Advanced LAN zeigt keine Werbung und sammelt keine persönlichen Daten. Spielereignisse gehen nur an die Regie und die Geräte, die du einträgst. Die Overwolf-Laufzeit sendet anonyme Nutzungsdaten an Overwolf." />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 16px 52px" }}>
          <LinkKnopf url={LINKS.terms}>Nutzungsbedingungen</LinkKnopf>
          <LinkKnopf url={LINKS.privacy}>Datenschutzerklärung</LinkKnopf>
          {cmp?.verfuegbar && <button style={S.smallBtn} onClick={privacy}>Datenschutz-Einstellungen</button>}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", marginLeft: 52 }}>
          <input type="checkbox" checked={zugestimmt} onChange={(e) => setZugestimmt(e.target.checked)} style={{ accentColor: ACCENT, width: 16, height: 16 }} />
          Ich stimme den Nutzungsbedingungen und der Datenschutzerklärung zu.
        </label>
      </>,
    },
  ];
  const letzter = schritt === SCHRITTE.length - 1;
  const s = SCHRITTE[schritt];

  return (
    <div style={{ position: "fixed", inset: 0, fontFamily: S.app.fontFamily, color: "#ece9f2", background: "rgba(8,6,12,.82)", zIndex: 1800, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#23212c", border: `1px solid ${ACCENT}`, boxShadow: "0 0 30px rgba(157,92,255,.35)", borderRadius: 14, width: "min(620px, 100%)", maxHeight: "90vh", overflow: "auto", padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <img src={APP_ICON} alt="" style={{ width: 40, height: 40, filter: "drop-shadow(0 0 10px rgba(157,92,255,.7))" }} />
          <h2 style={{ ...S.h2, margin: 0, fontSize: 22, flex: 1 }}>{s.titel}</h2>
          <span style={{ fontSize: 12, color: MUTED }}>{schritt + 1} / {SCHRITTE.length}</span>
        </div>
        <div style={{ minHeight: 250 }}>{s.inhalt}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22, paddingTop: 16, borderTop: `1px solid ${LINE}` }}>
          <div style={{ display: "flex", gap: 6, flex: 1 }}>
            {SCHRITTE.map((_, i) => <span key={i} style={{ width: i === schritt ? 22 : 8, height: 8, borderRadius: 4, background: i <= schritt ? ACCENT : "#3a3646", transition: "width .2s" }} />)}
          </div>
          {!letzter && <button style={{ ...S.ghostBtn, color: SUB }} onClick={() => setSchritt(SCHRITTE.length - 1)}>Überspringen</button>}
          {schritt > 0 && <button style={S.secondaryBtn} onClick={() => setSchritt(schritt - 1)}>Zurück</button>}
          {letzter
            ? <button style={{ ...S.primaryBtn, opacity: zugestimmt ? 1 : 0.5 }} disabled={!zugestimmt} title={zugestimmt ? "" : "Bitte zuerst zustimmen"} onClick={fertig}>Los geht's</button>
            : <button style={S.primaryBtn} onClick={() => setSchritt(schritt + 1)}>Weiter</button>}
        </div>
      </div>
    </div>
  );
}
