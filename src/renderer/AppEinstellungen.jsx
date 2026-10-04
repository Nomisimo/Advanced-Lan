import React, { useState, useEffect } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR } from "./theme.js";
import { Section, Kbd } from "./ui.jsx";
import { api } from "./api.js";
import { LINKS, STANDARD_HOTKEY, hotkeyAusTaste, hotkeyText } from "../core/app-info.js";
import { Keyboard, RotateCcw, GraduationCap, ShieldCheck, FileText, MessageSquareWarning, ExternalLink } from "lucide-react";

// Setup → App: für alle Modi gleich. Tastenkürzel (mit Erinnerung, Overwolf-Pflicht), Einführung, Datenschutz, Feedback.
const Zeile = ({ icon: Ic, titel, children, hinweis }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderBottom: `1px solid ${LINE}` }}>
    <Ic size={16} color={SUB} />
    <div style={{ minWidth: 220 }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{titel}</div>
      {hinweis && <div style={{ fontSize: 11, color: MUTED }}>{hinweis}</div>}
    </div>
    <div style={{ flex: 1, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>{children}</div>
  </div>
);

function Hotkey({ cfg, status, mutate }) {
  const [aufnahme, setAufnahme] = useState(false);
  const plattform = status.app?.plattform;
  const fehler = status.app?.hotkeyFehler;
  useEffect(() => {
    if (!aufnahme) return;
    const taste = (e) => {
      e.preventDefault();
      if (e.key === "Escape") return setAufnahme(false);
      const h = hotkeyAusTaste(e, plattform);
      if (!h) return; // weiter warten, bis eine Taste mit Strg/Alt/Umschalt kommt
      mutate((d) => { d.app = { ...d.app, hotkey: h }; });
      setAufnahme(false);
    };
    window.addEventListener("keydown", taste, true);
    return () => window.removeEventListener("keydown", taste, true);
  }, [aufnahme, plattform]);
  const setzen = (h) => mutate((d) => { d.app = { ...d.app, hotkey: h }; });
  const h = cfg.app?.hotkey;
  return (
    <Zeile icon={Keyboard} titel="Ein-/Ausblenden" hinweis="Tastenkürzel, geht auch mitten im Spiel">
      {aufnahme
        ? <span style={{ fontSize: 12, color: ACCENT }}>Tastenkombination drücken … (Esc bricht ab)</span>
        : <><span style={{ fontSize: 15, fontWeight: 700 }}>{h ? <Kbd>{hotkeyText(h, plattform)}</Kbd> : <span style={{ color: MUTED }}>aus</span>}</span>
          {fehler && h && <span style={{ fontSize: 12, color: ERR }}>{fehler}</span>}</>}
      <button style={S.smallBtn} onClick={() => setAufnahme(!aufnahme)}>{aufnahme ? "Abbrechen" : "Ändern"}</button>
      {h !== STANDARD_HOTKEY && <button style={S.smallBtn} title="Zurück auf den Standard" onClick={() => setzen(STANDARD_HOTKEY)}><RotateCcw size={12} /></button>}
      {h && <button style={S.smallBtn} onClick={() => setzen("")}>Aus</button>}
    </Zeile>
  );
}

export default function AppEinstellungen({ cfg, status, mutate, notify }) {
  const privacy = async () => { const r = await api.privacyOeffnen(); if (r?.fehler) notify(r.fehler, "warn"); };
  const link = (url) => () => api.openExternal(url);
  return (
    <Section title="App">
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
        <Hotkey cfg={cfg} status={status} mutate={mutate} />
        <Zeile icon={GraduationCap} titel="Einführung">
          <button style={S.smallBtn} onClick={() => mutate((d) => { d.app = { ...d.app, einfuehrung: false }; })}>Noch einmal zeigen</button>
        </Zeile>
        <Zeile icon={ShieldCheck} titel="Datenschutz" hinweis={cfg.app?.bedingungen ? `zugestimmt am ${new Date(cfg.app.bedingungen).toLocaleDateString("de-DE")}` : ""}>
          <button style={S.smallBtn} onClick={privacy}>Datenschutz-Einstellungen</button>
          <button style={S.smallBtn} onClick={link(LINKS.privacy)}><ExternalLink size={12} /> Datenschutzerklärung</button>
        </Zeile>
        <Zeile icon={FileText} titel="Nutzungsbedingungen">
          <button style={S.smallBtn} onClick={link(LINKS.terms)}><ExternalLink size={12} /> Öffnen</button>
        </Zeile>
        <Zeile icon={MessageSquareWarning} titel="Feedback und Fehler melden">
          <button style={S.smallBtn} onClick={() => api.feedbackOeffnen()}><ExternalLink size={12} /> Melden</button>
        </Zeile>
      </div>
    </Section>
  );
}
