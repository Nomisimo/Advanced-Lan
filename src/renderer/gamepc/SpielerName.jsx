import React, { useState, useEffect } from "react";
import { S, SUB } from "../theme.js";
import { api } from "../api.js";
import { Field, Toggle } from "../ui.jsx";
import { LEERLAUF_STUFEN } from "../../core/namen.js";
import { SPIELER_MAX } from "../../core/protokoll.js";
import { MessageSquareText } from "lucide-react";

// Spielername für den Game-Stats-Screen und wann das Namens-Popup fragt. Ohne Namen zeigt der Screen die PC-ID.
export default function SpielerName({ cfg, mutate, g, notify, pcId }) {
  const [name, setName] = useState(g.spieler || "");
  useEffect(() => setName(g.spieler || ""), [g.spieler]);
  const a = cfg.namensAbfrage || {};
  const fallback = pcId || "die PC-ID";
  const uebernehmen = () => name.trim() !== (g.spieler || "") && api.spielerSetzen(name);
  const fragen = async () => { const r = await api.nameFragen(); if (r?.fehler) notify(r.fehler, "err"); };

  return (
    <div style={{ marginTop: 16 }}>
      <Field label="Spielername" hint={`Steht auf dem Game-Stats-Screen. Leer: ${fallback}`}>
        <div style={{ display: "flex", gap: 6 }}>
          <input style={{ ...S.input, flex: 1, fontWeight: 700 }} value={name} placeholder={fallback} maxLength={SPIELER_MAX}
            onChange={(e) => setName(e.target.value)} onBlur={uebernehmen} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
          <button style={S.secondaryBtn} onClick={fragen} title="Das Namens-Popup jetzt zeigen"><MessageSquareText size={14} /> Popup</button>
        </div>
      </Field>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, marginTop: 10, fontSize: 13, color: SUB }}>
        <Toggle checked={a.spielstart} label="Bei Spielstart fragen" onChange={(v) => mutate((d) => { d.namensAbfrage = { ...d.namensAbfrage, spielstart: v }; })} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>Nach Leerlauf fragen
          <select style={S.selectSm} value={a.leerlaufMin ?? 0} onChange={(e) => mutate((d) => { d.namensAbfrage = { ...d.namensAbfrage, leerlaufMin: Number(e.target.value) }; })}>
            {LEERLAUF_STUFEN.map((m) => <option key={m} value={m}>{m ? `${m} min` : "aus"}</option>)}
          </select>
        </span>
      </div>
      <p style={S.hint}>Das Popup lässt sich wegklicken und blendet sich ohne Eingabe nach 30 s aus. Nach dem Leerlauf gilt der alte Name nicht mehr, das Popup schlägt ihn nur vor. Über einem Spiel im exklusiven Vollbild ist es nicht zu sehen, nur im randlosen Fenstermodus.</p>
    </div>
  );
}
