import React, { useState, useEffect, useRef, useCallback } from "react";
import { S, ACCENT, ERR, WARN } from "./theme.js";
import { api } from "./api.js";
import ModusWahl from "./ModusWahl.jsx";
import RegieApp from "./regie/RegieApp.jsx";
import GamePcApp from "./gamepc/GamePcApp.jsx";

const clone = (x) => JSON.parse(JSON.stringify(x));

export default function App() {
  const [cfg, setCfg] = useState(null);
  const cfgRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [version, setVersion] = useState("");
  const [toast, setToast] = useState(null);
  const [jetzt, setJetzt] = useState(Date.now());

  const notify = useCallback((msg, kind = "ok") => { setToast({ msg, kind }); setTimeout(() => setToast(null), 3600); }, []);

  useEffect(() => {
    api.getConfig().then((c) => { cfgRef.current = c; setCfg(c); });
    api.status().then(setStatus);
    api.appVersion().then(setVersion);
    const ab = [api.onStatus(setStatus), api.onMeldung((m) => notify(m.text, m.art))];
    const t = setInterval(() => setJetzt(Date.now()), 1000);
    return () => { ab.forEach((f) => f && f()); clearInterval(t); };
  }, []);

  // Einstellungen ändern: Kopie bearbeiten, anzeigen, an den Hauptprozess geben (der speichert und wendet an)
  const mutate = useCallback((fn) => {
    const next = clone(cfgRef.current);
    fn(next);
    cfgRef.current = next;
    setCfg(next);
    api.setConfig(next).then(setStatus);
  }, []);

  const modusSetzen = async (m) => {
    const s = await api.setModus(m);
    const c = await api.getConfig();
    cfgRef.current = c; setCfg(c); setStatus(s);
  };

  if (!cfg || !status) return <div style={S.app} />;
  const shared = { cfg, mutate, status, jetzt, notify, version, modusWechseln: () => modusSetzen(null) };

  return (
    <>
      {!cfg.modus && <ModusWahl onWahl={modusSetzen} version={version} />}
      {cfg.modus === "regie" && status.regie && <RegieApp {...shared} />}
      {cfg.modus === "gamepc" && status.gamepc && <GamePcApp {...shared} />}
      {toast && <div style={{ position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)", background: "#1a1820", border: `1px solid ${toast.kind === "err" ? ERR : toast.kind === "warn" ? WARN : ACCENT}`, color: "#ece9f2", padding: "9px 16px", borderRadius: 8, fontSize: 13, zIndex: 2000, boxShadow: "0 8px 24px rgba(0,0,0,.5)", maxWidth: "80vw" }}>{toast.msg}</div>}
    </>
  );
}
