import React, { useState, useEffect } from "react";
import { S, LINE, SUB, MUTED, OK, WARN, teamFarbe } from "../theme.js";
import { api } from "../api.js";
import { Section, Check, Field, TeamChip, SpielChip, Kbd, Toggle, KartenWahl, useKarten } from "../ui.jsx";
import { karteFuer } from "../../core/netzwerk.js";
import { overlayStatus } from "../../core/overlay-status.js";
import { SPIELE } from "../../core/spiele.js";
import { CFG_ORDNER, CFG_DATEI } from "../../core/cfg.js";
import { RL_INI_DATEI, RL_INI_ORDNER } from "../../core/rl-ini.js";
import { DOTA_CFG_DATEI, DOTA_CFG_ORDNER, DOTA_STARTOPTION } from "../../core/dota.js";
import { OVERDRIVE_PORT } from "../../core/overdrive.js";
import SpielerName from "./SpielerName.jsx";
import { FileDown, Download, RefreshCw, LocateFixed, BookOpen, ScanEye, ExternalLink } from "lucide-react";

// Offizielle Dokumentation der Datenquellen, öffnet im Browser
const DOKU = {
  cs2: [
    ["Valve: Game State Integration", "https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive_Game_State_Integration"],
  ],
  rl: [
    ["Psyonix: Rocket League Stats API", "https://www.rocketleague.com/developer/stats-api"],
  ],
  dota2: [
    ["Valve: Dota 2 Game State Integration", "https://developer.valvesoftware.com/wiki/Dota_2_Workshop_Tools/Scripting/Game_State_Integration"],
  ],
};
// Valorant ohne Bilderkennung: zwei Apps von Overwolf, die die Live-Events von Overwolf an diese App weitergeben
const OVERDRIVE_LINKS = [
  ["Overwolf herunterladen", "https://www.overwolf.com/"],
  ["Automation Overdrive im Overwolf-Store", "https://www.overwolf.com/app/raimen_ttv-automation_overdrive"],
  ["Anleitung von Automation Overdrive", "https://github.com/raimen-ttv/Automation-Overdrive"],
];

function OverdriveAnleitung({ punkte, mac }) {
  const schritt = { display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5, padding: "6px 0" };
  const nr = { flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: "#ff465533", color: "#ff4655", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 1 };
  const schritte = [
    <><b>Overwolf installieren</b> (kostenlos, von overwolf.com) und mit einem Overwolf-Konto anmelden.</>,
    <><b>Automation Overdrive</b> aus dem Overwolf-Store installieren (kostenlos, von Raimen TTV).</>,
    <><b>Touch Portal ist nicht nötig.</b> Diese App übernimmt die Rolle des Touch-Portal-Plugins und lauscht auf Port <Kbd>{OVERDRIVE_PORT}</Kbd>. Läuft Touch Portal mit dem Overdrive-Plugin, Touch Portal beenden: Beide brauchen denselben Port.</>,
    <><b>Erst diese App, dann Overwolf starten.</b> Im Fenster von Automation Overdrive muss „Connected to TP“ stehen. Sonst dort „Retry Connection“ drücken.</>,
    <><b>Valorant spielen.</b> Kill, Tod, Assist, Headshot, Match-Start und Match-Ende kommen automatisch als Valorant-Events dieses PCs an, mit dem Team aus dem Tab „Bilderkennung“.</>,
  ];
  return (
    <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Valorant über Automation Overdrive <SpielChip spiel="valorant" /></span>}
      subtitle="Optional, zusätzlich zur Bilderkennung: Overwolf liest die Events und Automation Overdrive schickt sie an diese App. Runden und Spike kommen weiter nur aus der Bilderkennung.">
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", gap: 20, alignItems: "start" }}>
        <div>
          {schritte.map((t, i) => <div key={i} style={schritt}><span style={nr}>{i + 1}</span><span>{t}</span></div>)}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {OVERDRIVE_LINKS.map(([titel, url]) => (
              <button key={url} style={{ ...S.smallBtn, padding: "5px 9px" }} title={url} onClick={() => api.openExternal(url)}><ExternalLink size={12} /> {titel}</button>
            ))}
          </div>
        </div>
        <div>
          {punkte && <Liste punkte={punkte} />}
          <p style={S.hint}>{mac ? "Overwolf und Valorant gibt es nur für Windows. " : ""}Automation Overdrive ist nicht von uns und wird seit 2022 nicht mehr aktualisiert. Liefert es keine Events mehr, bleibt die Bilderkennung.</p>
        </div>
      </div>
    </Section>
  );
}

const DokuLinks = ({ spiel }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
    {DOKU[spiel].map(([titel, url]) => (
      <button key={url} style={{ ...S.smallBtn, padding: "5px 9px" }} title={url} onClick={() => api.openExternal(url)}><BookOpen size={12} /> {titel}</button>
    ))}
  </div>
);

const Liste = ({ punkte }) => <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>{punkte.map((p) => <Check key={p.id} {...p} />)}</div>;

const PUNKT = { ok: OK, warn: WARN, err: "#ff5d5d" };

// Vorschau des Mini-Overlays mit derselben Ampel wie das echte
function OverlayVorschau({ farbe }) {
  return (
    <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
      <div style={{ position: "absolute", inset: 8, borderRadius: 13, background: "radial-gradient(circle at 50% 38%, #2a2238, #16131d)", border: "2px solid #9d5cff", boxShadow: "0 0 5px rgba(157,92,255,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg viewBox="36 160 440 262" style={{ width: "70%", filter: "drop-shadow(0 0 4px rgba(157,92,255,.8))" }}>
          <path fill="#a874ff" d="M150 168h212c44 0 74 26 86 70l26 98c11 42-14 78-52 78-24 0-40-14-54-34l-22-32c-8-11-18-16-32-16h-116c-14 0-24 5-32 16l-22 32c-14 20-30 34-54 34-38 0-63-36-52-78l26-98c12-44 42-70 86-70z" />
          <g fill="#16131d"><rect x="148" y="236" width="68" height="22" rx="6" /><rect x="171" y="213" width="22" height="68" rx="6" /><circle cx="350" cy="226" r="15" /><circle cx="384" cy="258" r="15" /><circle cx="316" cy="258" r="15" /><circle cx="350" cy="290" r="15" /></g>
        </svg>
      </div>
      <div style={{ position: "absolute", right: 3, top: 3, width: 12, height: 12, borderRadius: "50%", border: "2px solid #16131d", background: PUNKT[farbe] }} />
    </div>
  );
}

// Über welche Karte der PC Sessions sucht und mit der Regie spricht
function Netzwerkkarte({ cfg, mutate }) {
  const karten = useKarten();
  const k = karteFuer(karten, cfg.netz) || (!cfg.netz && karten.length === 1 ? karten[0] : null);
  return (
    <Section title="Netzwerkkarte" subtitle="Über diese Karte sucht der PC Sessions und spricht mit der Regie. Nach einem Wechsel verbindet er sich neu.">
      <KartenWahl karten={karten} wert={cfg.netz} onChange={(v) => mutate((d) => { d.netz = v; })} style={{ fontSize: 14, padding: "8px 10px" }} />
      <div style={{ ...S.mono, fontSize: 11, color: SUB, marginTop: 8 }}>
        {k ? `${k.ip} / ${k.maske} · MAC ${k.mac}` : cfg.netz ? <span style={{ color: "#ff5d5d" }}>Karte nicht verbunden</span> : `${karten.length} Karten, das Betriebssystem wählt`}
      </div>
    </Section>
  );
}

// Standalone: Name, unter dem dieser PC in der eigenen Regie erscheint (sonst die PC-ID)
function LokalName({ cfg, mutate }) {
  const [name, setName] = useState(cfg.pcId || "");
  useEffect(() => setName(cfg.pcId || ""), [cfg.pcId]);
  return (
    <Field label="Name dieses PCs in der Regie" hint="Erscheint in Control, im Event-Log und auf dem Game-Stats-Screen, wenn das Spiel keinen Spielernamen liefert" style={{ maxWidth: 360 }}>
      <input style={S.input} value={name} placeholder="Dieser PC" maxLength={40} onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() !== cfg.pcId && mutate((d) => { d.pcId = name.trim(); })} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
    </Field>
  );
}

export default function SetupTab({ cfg, mutate, g, jetzt, notify, goTab, standalone = false }) {
  const [check, setCheck] = useState(null);
  const laden = () => api.setupCheck().then(setCheck);
  useEffect(() => { laden(); const t = setInterval(laden, 3000); return () => clearInterval(t); }, []);
  const fertig = async (r, text) => { if (r?.ok) notify(text); else if (r?.fehler) notify(r.fehler, "err"); laden(); };
  const alle = check ? [...check.allgemein, ...check.cs2, ...check.rl, ...(check.dota2 || [])].filter((p) => !p.nichtVerfuegbar) : [];
  const mac = check?.plattform === "darwin";
  const weitere = Object.fromEntries(Object.entries(g.daten || {}).map(([id, d]) => [SPIELE.find((s) => s.id === id)?.name || id, d.letzte]));
  const ampel = overlayStatus({ client: g.client, gsi: g.gsi, letzteCs2: g.letzte, letzteRl: g.rl?.letzte, weitere, jetzt });
  const dota = g.daten?.dota2;
  const offen = alle.filter((p) => !p.ok).length;

  return (
    <>
      <Section title="Ist korrekt aufgesetzt?" right={<span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        {check && <span style={{ fontSize: 13, fontWeight: 800, color: offen ? WARN : OK, textShadow: offen ? "none" : `0 0 8px ${OK}` }}>{offen ? `${offen} von ${alle.length} offen` : "Alles bereit"}</span>}
        <button style={S.smallBtn} onClick={laden}><RefreshCw size={12} /> Prüfen</button>
      </span>}>
        {standalone ? <><LokalName cfg={cfg} mutate={mutate} /><SpielerName cfg={cfg} mutate={mutate} g={g} notify={notify} pcId={cfg.pcId.trim() || "Dieser PC"} /></> : check ? <Liste punkte={check.allgemein} /> : <div style={S.empty}>Prüfe …</div>}
        {standalone && <p style={S.hint}>Standalone: Die Spiele auf diesem PC melden ihre Events direkt an die Regie. Eine Session braucht es dafür nicht.</p>}
      </Section>

      {!standalone && <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", gap: 20, alignItems: "stretch" }}>
      <Section title="Mini-Overlay" right={<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Toggle checked={cfg.overlay?.an} label="Anzeigen, wenn die App minimiert ist" onChange={(v) => mutate((d) => { d.overlay = { ...(d.overlay || {}), an: v }; })} />
        <button style={S.smallBtn} onClick={async () => { await api.overlayZuruecksetzen(); notify("Overlay steht wieder oben rechts."); }}><LocateFixed size={12} /> Position zurücksetzen</button>
      </div>}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", opacity: cfg.overlay?.an ? 1 : 0.45 }}>
          <OverlayVorschau farbe={ampel.farbe} />
          <span style={{ fontSize: 13, color: PUNKT[ampel.farbe] }}>{ampel.text}</span>
        </div>
      </Section>
      <Netzwerkkarte cfg={cfg} mutate={mutate} />
      </div>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 20, alignItems: "start" }}>
        <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Counter-Strike 2 <SpielChip spiel="cs2" /></span>}
          right={!mac && <div style={{ display: "flex", gap: 8 }}>
            <button style={S.primaryBtn} onClick={async () => fertig(await api.cfgInstallieren(), "cfg installiert. CS2 neu starten.")}><Download size={15} /> cfg installieren</button>
            <button style={S.secondaryBtn} onClick={async () => fertig(await api.cfgSpeichern(), "cfg gespeichert.")}><FileDown size={14} /> Speichern unter …</button>
          </div>}>
          {check && <Liste punkte={check.cs2} />}
          {check && !mac && !check.cs2[0]?.ok && <p style={S.hint}><Kbd>{CFG_DATEI}</Kbd> → <Kbd>{CFG_ORDNER}</Kbd></p>}
          <DokuLinks spiel="cs2" />
          {g.status && (
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 14, padding: "10px 12px", background: "#1a1820", border: `1px solid ${LINE}`, borderLeft: `3px solid ${teamFarbe(g.status.team)}`, borderRadius: 8, fontSize: 13 }}>
              <b>{g.status.spieler || (g.status.zuschauer ? `schaut ${g.status.zuschauer} zu` : "im Menü")}</b>
              <TeamChip team={g.status.team} />
              {g.status.health != null && <span style={{ color: SUB }}>{g.status.health} HP · {g.status.kills}/{g.status.deaths}</span>}
              {g.stand && <span style={{ color: SUB, marginLeft: "auto" }}>{g.stand.map} · {g.stand.ct}:{g.stand.tt}</span>}
            </div>
          )}
        </Section>

        <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Rocket League <SpielChip spiel="rl" /></span>}
          right={!mac && <div style={{ display: "flex", gap: 8 }}>
            <button style={S.primaryBtn} onClick={async () => fertig(await api.rlIniInstallieren(), "Stats API eingeschaltet. Rocket League neu starten.")}><Download size={15} /> Stats API einschalten</button>
            <button style={S.secondaryBtn} onClick={async () => fertig(await api.rlIniSpeichern(), "ini gespeichert.")}><FileDown size={14} /> Speichern unter …</button>
          </div>}>
          {check && <Liste punkte={check.rl} />}
          {check && !mac && !check.rl[0]?.ok && <p style={S.hint}><Kbd>{RL_INI_DATEI}</Kbd> → <Kbd>{RL_INI_ORDNER}</Kbd></p>}
          <DokuLinks spiel="rl" />
          {g.rl?.stand && (
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 14, padding: "10px 12px", background: "#1a1820", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13 }}>
              <b>{g.rl.stand.arena || "Match"}</b>
              <span style={{ color: SUB }}>{g.rl.stand.spieler} Spieler</span>
              <span style={{ color: SUB, marginLeft: "auto" }}>{g.rl.stand.blau}:{g.rl.stand.orange}</span>
            </div>
          )}
        </Section>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 20, alignItems: "start" }}>
        <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Dota 2 <SpielChip spiel="dota2" /></span>}
          right={<div style={{ display: "flex", gap: 8 }}>
            <button style={S.primaryBtn} onClick={async () => fertig(await api.dotaCfgInstallieren(), "cfg installiert. Dota 2 neu starten.")}><Download size={15} /> cfg installieren</button>
            <button style={S.secondaryBtn} onClick={async () => fertig(await api.dotaCfgSpeichern(), "cfg gespeichert.")}><FileDown size={14} /> Speichern unter …</button>
          </div>}>
          {check?.dota2 && <Liste punkte={check.dota2} />}
          <p style={S.hint}>Wie CS2 über Valves Game State Integration, gleicher Empfang. Zusätzlich in Steam bei Dota 2 die Startoption <Kbd>{DOTA_STARTOPTION}</Kbd> eintragen (Eigenschaften → Allgemein → Startoptionen).
            {check?.dota2 && !check.dota2[0]?.ok && <> Datei: <Kbd>{DOTA_CFG_DATEI}</Kbd> → <Kbd>{DOTA_CFG_ORDNER}</Kbd></>}</p>
          <DokuLinks spiel="dota2" />
          {dota?.status?.spieler && (
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 14, padding: "10px 12px", background: "#1a1820", border: `1px solid ${LINE}`, borderLeft: `3px solid ${teamFarbe(dota.status.team)}`, borderRadius: 8, fontSize: 13 }}>
              <b>{dota.status.spieler}</b>
              <TeamChip team={dota.status.team} />
              <span style={{ color: SUB }}>{dota.status.held} · {dota.status.kills}/{dota.status.deaths}/{dota.status.assists}</span>
              {dota.stand?.score && <span style={{ color: SUB, marginLeft: "auto" }}>{dota.stand.score.RADIANT}:{dota.stand.score.DIRE}</span>}
            </div>
          )}
        </Section>

        <Section title="Valorant und The Finals" subtitle="Ohne offizielle Schnittstelle: Die App erkennt die Aktionen am Bild dieses PCs. Einrichten im Tab „Bilderkennung“: Gameplay aufnehmen, Bereiche als Aktionen anlegen oder die Datei eines anderen PCs importieren."
          right={goTab && <button style={S.primaryBtn} onClick={() => goTab("bild")}><ScanEye size={14} /> Bilderkennung</button>}>
          {check?.bild && <Liste punkte={check.bild} />}
          <p style={S.hint}>Spiel im randlosen Fenstermodus starten, sonst kann die Aufnahme schwarz bleiben.</p>
        </Section>
      </div>
      <OverdriveAnleitung punkte={check?.overdrive} mac={mac} />
    </>
  );
}
