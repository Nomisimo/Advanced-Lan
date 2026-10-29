import React, { useEffect, useRef, useState } from "react";
import { S, LINE, PANEL } from "./theme.js";

// Eigene Dialoge statt alert()/confirm(): Native Dialoge geben unter Windows den Tastatur-Fokus nicht sauber
// an die Seite zurück, danach lassen sich Textfelder bis zum Neustart nicht mehr bedienen (electron/electron#35872, #41602).
// Warteschlange auf Modulebene, angezeigt von <DialogHost/> (einmal im Root).
const schlange = [];
let melden = null;

function oeffnen(art, text) {
  return new Promise((fertig) => {
    schlange.push({ art, text, fertig });
    melden?.();
  });
}

// Frage mit OK/Abbrechen. Promise liefert true oder false.
export const uiConfirm = (text) => oeffnen("confirm", String(text ?? ""));

export function DialogHost() {
  const [, neu] = useState(0);
  const okRef = useRef(null);
  const vorher = useRef(null);
  const d = schlange[0];

  useEffect(() => {
    melden = () => neu((n) => n + 1);
    if (schlange.length) melden();
    return () => { melden = null; };
  }, []);

  // Beim Öffnen: aktives Element merken, OK fokussieren
  useEffect(() => {
    if (!d) return;
    if (!vorher.current) vorher.current = document.activeElement;
    okRef.current?.focus();
  }, [d]);

  if (!d) return null;

  const schliessen = (wert) => {
    schlange.shift();
    d.fertig(d.art === "confirm" ? wert : undefined);
    if (!schlange.length) {
      // Fokus zurück auf das Element von vorher (z. B. das Textfeld, aus dem heraus gefragt wurde)
      const el = vorher.current;
      vorher.current = null;
      if (el && el !== document.body && el.isConnected && typeof el.focus === "function") setTimeout(() => el.focus(), 0);
    }
    neu((n) => n + 1);
  };

  const taste = (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); schliessen(false); }
    // Tab bleibt im Dialog
    if (e.key === "Tab") {
      const knoepfe = [...e.currentTarget.querySelectorAll("button")];
      const i = knoepfe.indexOf(document.activeElement);
      const naechster = knoepfe[(i + (e.shiftKey ? -1 : 1) + knoepfe.length) % knoepfe.length];
      e.preventDefault();
      naechster?.focus();
    }
  };

  return (
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); okRef.current?.focus(); } }}
      style={{ position: "fixed", inset: 0, fontFamily: S.app.fontFamily, background: "rgba(8,6,12,.72)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div role={d.art === "confirm" ? "alertdialog" : "dialog"} aria-modal="true" aria-describedby="ui-dialog-text" onKeyDown={taste} data-testid="ui-dialog"
        style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: 20, width: 440, maxWidth: "100%", boxShadow: "0 12px 40px rgba(0,0,0,.6)", color: "#ece9f2", fontSize: 13, lineHeight: 1.5 }}>
        <div id="ui-dialog-text" style={{ whiteSpace: "pre-wrap", marginBottom: 18 }}>{d.text}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {d.art === "confirm" && <button style={S.ghostBtn} onClick={() => schliessen(false)}>Abbrechen</button>}
          <button ref={okRef} style={S.primaryBtn} onClick={() => schliessen(true)}>OK</button>
        </div>
      </div>
    </div>
  );
}
