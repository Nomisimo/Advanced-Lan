import React, { useState, useEffect } from "react";
import { S, LINE, SUB, OK, WARN, teamFarbe } from "../theme.js";
import { api } from "../api.js";
import { Section, Check, Field, TeamChip, SpielChip, Kbd, Toggle } from "../ui.jsx";
import { overlayStatus } from "../../core/overlay-status.js";
import { SPIELE } from "../../core/spiele.js";
import { CFG_ORDNER, CFG_DATEI } from "../../core/cfg.js";
import { RL_INI_DATEI, RL_INI_ORDNER } from "../../core/rl-ini.js";
import { DOTA_CFG_DATEI, DOTA_CFG_ORDNER, DOTA_STARTOPTION } from "../../core/dota.js";
import { OVERDRIVE_PORT, OVERDRIVE_STORE_URL, OVERWOLF_URL } from "../../core/overdrive.js";
import { SHOTSFIRED_STORE_URL, SF_SPIELE, SF_EINRICHTEN, sfUrl } from "../../core/shotsfired.js";
import { LOL_PORT, LOL_DOKU_URL } from "../../core/lol.js";
import SpielerName from "./SpielerName.jsx";
import { FileDown, Download, RefreshCw, LocateFixed, BookOpen, ScanEye, ExternalLink, Play, Copy } from "lucide-react";

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
  ["Overwolf herunterladen", OVERWOLF_URL],
  ["Automation Overdrive im Overwolf-Store", OVERDRIVE_STORE_URL],
  ["Anleitung von Automation Overdrive", "https://github.com/raimen-ttv/Automation-Overdrive"],
];

// Shots Fired (Overwolf) schickt alle Overwolf-Events von Valorant, Fortnite, LoL und The Finals an einen Webhook: diese App
const SF_SPIEL_NAMEN = { valorant: "Valorant", fortnite: "Fortnite", lol: "League of Legends", finals: "The Finals" };
const NR = { flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: "#ff465533", color: "#ff4655", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 1 };
const SCHRITT = { display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5, padding: "6px 0" };
const Schritte = ({ liste }) => liste.map((t, i) => <div key={i} style={SCHRITT}><span style={NR}>{i + 1}</span><span>{t}</span></div>);

function ShotsFiredAnleitung({ punkte, sf, mac, notify }) {
  const [offen, setOffen] = useState(false);
  const [spiel, setSpiel] = useState("valorant");
  const kopieren = async (url) => {
    try { await navigator.clipboard.writeText(url); notify?.(`Adresse kopiert: ${url}`); } catch { notify?.(url); }
  };
  const url = sfUrl(spiel);
  const schritte = [
    <><b>Overwolf</b> und darin <b>Shots Fired</b> (von Mike Holloway, kostenlos) installieren und Overwolf starten.</>,
    <>In Shots Fired das Spiel wählen und je Event eine <b>Sequence</b> mit der Aktion <b>„Webhook“</b> anlegen. Adresse je Spiel (rechts kopieren): <Kbd>{url}</Kbd>. Shots Fired schickt dann <Kbd>{"{ gameId, event, data }"}</Kbd> per POST.</>,
    <>Für {SF_SPIEL_NAMEN[spiel]} diese Events anlegen (alles, was sonst noch angeboten wird, schadet nicht, die App nimmt, was sie kennt):</>,
    <><b>Testen:</b> In Shots Fired auf „Test“ drücken oder eine Runde spielen. Unten unter <b>Letzte Anfragen</b> steht jede Anfrage im Rohformat und was daraus wurde. Grün = erkannt.</>,
  ];
  return (
    <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Overwolf-Spiele über Shots Fired <SpielChip spiel="valorant" /> <SpielChip spiel="fortnite" /> <SpielChip spiel="lol" /> <SpielChip spiel="finals" /></span>}
      subtitle="Empfohlen für Valorant, Fortnite und The Finals: Overwolf liest die Events, Shots Fired schickt sie per Webhook an diese App. Hat Vorrang vor Automation Overdrive und der Bilderkennung. Bei LoL hat die Live Client Data API Vorrang."
      right={<button style={S.primaryBtn} onClick={() => kopieren(url)}><Copy size={14} /> Adresse kopieren</button>}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {SF_SPIELE.map((id) => <button key={id} style={{ ...S.smallBtn, ...(id === spiel ? { borderColor: "#ff4655", color: "#fff" } : {}) }} onClick={() => setSpiel(id)}>{SF_SPIEL_NAMEN[id]}</button>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", gap: 20, alignItems: "start" }}>
        <div>
          <Schritte liste={schritte.slice(0, 3)} />
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, margin: "4px 0 6px 30px", maxWidth: "calc(100% - 30px)" }}>
            <tbody>{SF_EINRICHTEN[spiel].map(([ev, was]) => <tr key={ev}><td style={{ padding: "3px 8px 3px 0", whiteSpace: "nowrap" }}><Kbd>{ev}</Kbd></td><td style={{ padding: "3px 0", color: SUB }}>{was}</td></tr>)}</tbody>
          </table>
          <div style={SCHRITT}><span style={NR}>4</span><span>{schritte[3]}</span></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {[["Overwolf herunterladen", OVERWOLF_URL], ["Shots Fired im Overwolf-Store", SHOTSFIRED_STORE_URL], ["Anleitung von Shots Fired", "https://github.com/ministerofpanic/shots-fired-support"]].map(([titel, u]) => (
              <button key={u} style={{ ...S.smallBtn, padding: "5px 9px" }} title={u} onClick={() => api.openExternal(u)}><ExternalLink size={12} /> {titel}</button>
            ))}
          </div>
        </div>
        <div>
          {punkte && <Liste punkte={punkte} />}
          <p style={S.hint}>{mac ? "Overwolf und diese Spiele gibt es nur für Windows. " : ""}Shots Fired ist nicht von uns. Valorant: kein Spike-Timer (Riot-Regel), gelegt, entschärft und explodiert sind einzelne Cues. Thrifty liefert Overwolf nicht, dafür bleibt die Bilderkennung.</p>
        </div>
      </div>
      {spiel === "valorant" && <SfTeams info={sf?.valorant} />}
      <button style={{ ...S.smallBtn, marginTop: 12 }} onClick={() => setOffen(!offen)}>{offen ? "Letzte Anfragen ausblenden" : `Letzte Anfragen (${sf?.anfragen || 0})`}</button>
      {offen && (
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {!sf?.roh?.length && <p style={{ ...S.hint, margin: 0 }}>Noch keine Anfrage angekommen.</p>}
          {sf?.roh?.map((r, i) => (
            <div key={i} style={{ fontSize: 12, padding: "6px 8px", background: "#1a1820", border: `1px solid ${LINE}`, borderRadius: 6 }}>
              <div style={{ color: SUB }}>{new Date(r.t).toLocaleTimeString()} · {r.methode} {r.pfad} · {r.spiel ? SF_SPIEL_NAMEN[r.spiel] : <span style={{ color: WARN }}>Spiel unbekannt: Pfad /valorant, /fortnite, /lol oder /finals</span>} · {r.events.length ? <span style={{ color: OK }}>{r.events.join(", ")}</span> : <span style={{ color: WARN }}>kein bekanntes Event</span>}</div>
              <code style={{ display: "block", whiteSpace: "pre-wrap", wordBreak: "break-all", marginTop: 4 }}>{r.body || "(leer)"}</code>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// Valorant: was Shots Fired über die Teams weiß (team, ui_team_order_allies / _enemies)
function SfTeams({ info }) {
  if (!info || (!info.seite && !info.verbuendete?.length && !info.gegner?.length && !info.match)) return null;
  const zeile = (titel, wert) => wert ? <div><span style={{ color: SUB }}>{titel}:</span> {wert}</div> : null;
  return (
    <div style={{ marginTop: 12, fontSize: 12, padding: "6px 8px", background: "#1a1820", border: `1px solid ${LINE}`, borderRadius: 6, display: "grid", gap: 2 }}>
      {zeile("Seite", info.seite)}
      {zeile("Team dieses PCs (aus der Seite)", info.team)}
      {zeile("Eigenes Team", info.verbuendete?.join(", "))}
      {zeile("Gegner", info.gegner?.join(", "))}
      {zeile("Match-ID", info.match)}
    </div>
  );
}

// League of Legends: Riots eigene Live Client Data API, ohne Overwolf. Beste Quelle für LoL.
function LolAnleitung({ punkte }) {
  return (
    <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>League of Legends über die Live Client Data API <SpielChip spiel="lol" /></span>}
      subtitle="Offizielle Schnittstelle von Riot, läuft im Spiel selbst. Nichts einzurichten: Sobald ein Spiel läuft, liest diese App Team, Kills, Objekte und Spielende. Hat Vorrang vor Shots Fired und der Bilderkennung.">
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", gap: 20, alignItems: "start" }}>
        <div>
          <Schritte liste={[
            <>League of Legends normal starten, kein Overwolf nötig. Die Schnittstelle läuft auf <Kbd>https://127.0.0.1:{LOL_PORT}</Kbd> nur auf diesem PC und nur, solange ein Spiel läuft (nicht im Client-Menü, nicht im Ladebildschirm).</>,
            <><b>Team</b> kommt aus dem Spiel: <Kbd>BLUE</Kbd> (unten links) oder <Kbd>RED</Kbd>. Das Team im Tab „Bilderkennung“ gilt nur, solange keins erkannt ist.</>,
            <><b>Jeder PC</b> meldet Kills, Tode, Assists und Multikills seines Spielers. Objekte (Türme, Inhibitoren, Drachen, Herold, Larven, Atakhan, Baron, First Blood, Ace) und das Spielende melden alle PCs, die Regie zählt sie einmal.</>,
          ]} />
          <button style={{ ...S.smallBtn, padding: "5px 9px", marginTop: 10 }} title={LOL_DOKU_URL} onClick={() => api.openExternal(LOL_DOKU_URL)}><ExternalLink size={12} /> Riot: Game Client API</button>
        </div>
        <div>{punkte && <Liste punkte={punkte} />}</div>
      </div>
    </Section>
  );
}

function OverdriveAnleitung({ punkte, mac, neuPruefen }) {
  const [meldung, setMeldung] = useState(null);
  const [offen, setOffen] = useState(false);
  // Startet die installierte App über Overwolf, sonst Store- oder Download-Seite
  const oeffnen = async () => {
    const r = await api.overdriveOeffnen();
    setMeldung(r);
    if (neuPruefen) setTimeout(neuPruefen, 4000);
  };
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
      subtitle="Ältere Alternative zu Shots Fired, nur für Valorant und nur Kill, Tod, Assist, Headshot und Match. Shots Fired hat Vorrang, die Bilderkennung kommt danach."
      right={<button style={S.smallBtn} onClick={() => setOffen(!offen)}>{offen ? "Einklappen" : "Anzeigen"}</button>}>
      {offen && <>
      <button style={{ ...S.smallBtn, marginBottom: 8 }} onClick={oeffnen}><Play size={13} /> Automation Overdrive öffnen</button>
      {meldung && <p style={{ ...S.hint, marginTop: 0, color: meldung.art === "gestartet" ? OK : WARN }}>{meldung.text}</p>}
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
      </>}
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

        <Section title="Bilderkennung: Valorant, The Finals, Fortnite, LoL" subtitle="Letzte Wahl, wenn Shots Fired oder die Spiel-Schnittstelle ein Event nicht liefern (z. B. Thrifty): Die App erkennt die Aktionen am Bild dieses PCs. Einrichten im Tab „Bilderkennung“: Gameplay aufnehmen, Bereiche als Aktionen anlegen oder die Datei eines anderen PCs importieren."
          right={goTab && <button style={S.primaryBtn} onClick={() => goTab("bild")}><ScanEye size={14} /> Bilderkennung</button>}>
          {check?.bild && <Liste punkte={check.bild} />}
          <p style={S.hint}>Spiel im randlosen Fenstermodus starten, sonst kann die Aufnahme schwarz bleiben.</p>
        </Section>
      </div>
      <ShotsFiredAnleitung punkte={check?.shotsfired} sf={g.shotsfired} mac={mac} notify={notify} />
      <LolAnleitung punkte={check?.lol} />
      <OverdriveAnleitung punkte={check?.overdrive} mac={mac} neuPruefen={laden} />
      {!standalone && <>
        <div className="sp-section-label" style={{ margin: "8px 0 10px" }}>Einstellungen</div>
        <Section title="Mini-Overlay" right={<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Toggle checked={cfg.overlay?.an} label="Anzeigen, wenn die App minimiert ist" onChange={(v) => mutate((d) => { d.overlay = { ...(d.overlay || {}), an: v }; })} />
          <button style={S.smallBtn} onClick={async () => { await api.overlayZuruecksetzen(); notify("Overlay steht wieder oben rechts."); }}><LocateFixed size={12} /> Position zurücksetzen</button>
        </div>}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", opacity: cfg.overlay?.an ? 1 : 0.45 }}>
            <OverlayVorschau farbe={ampel.farbe} />
            <span style={{ fontSize: 13, color: PUNKT[ampel.farbe] }}>{ampel.text}</span>
          </div>
        </Section>
      </>}
    </>
  );
}
