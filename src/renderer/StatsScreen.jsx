import React, { useState, useEffect, createContext, useContext } from "react";
import { ACCENT, ACCENT_HI, LINE, SUB, MUTED, OK, WARN, BG, teamFarbe } from "./theme.js";
import { api } from "./api.js";
import { APP_ICON } from "./Kopf.jsx";
import { EventIcon, eventLabel, zeit } from "./ui.jsx";
import { SPIEL_BY_ID } from "../core/spiele.js";
import { statsDaten, statsEvents, spielerDaten, spielerWahl, teamListen, wertVon, WERT_KURZ, kd } from "../core/stats-screen.js";
import { migrateLayout, textEinsetzen, verlaufCss, inhaltsSkala } from "../core/stats-layout.js";
import { screenVon, leseStatsHash } from "../core/stats-screens.js";
import { Crown, Trophy } from "lucide-react";

// Game-Stats-Screen für Publikum und Stream: in der Größe des Screens gestaltet (Standard 1920×1080), auf die Fenstergröße skaliert.
// Läuft im Pop-out-Fenster und im unsichtbaren NDI-Fenster der Regie (index.html#stats=<id>, NDI mit „&ndi“).
const FRISCH = 15000;
const FONT = "'Segoe UI',system-ui,sans-serif";

function useSkalierung(B, H) {
  const mass = () => Math.min(window.innerWidth / B, window.innerHeight / H);
  const [s, setS] = useState(mass);
  useEffect(() => { const f = () => setS(mass()); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, [B, H]);
  return s;
}

function logEinfuegen(l, e) {
  const neu = l.some((x) => x.id === e.id) ? l.map((x) => (x.id === e.id ? e : x)) : [e, ...l];
  return neu.slice(0, 200);
}

// Darstellung des Elements (Kachel-Transparenz, Ecken, Rahmen), gesetzt in ElementKasten
const StilKontext = createContext({ kachel: 92, ecken: 18, rahmen: true });
// Schrift- und Akzentfarbe des Elements kommen als CSS-Variablen
const TXT = "var(--txt, #fff)", AKZ = `var(--akz, ${ACCENT_HI})`;
const Panel = ({ children, style }) => {
  const { kachel, ecken, rahmen } = useContext(StilKontext);
  const k = kachel / 100;
  return (
    <div style={{ background: `linear-gradient(180deg, rgba(35,33,44,${k}), rgba(27,25,34,${k}))`, border: `1px solid ${rahmen ? LINE : "transparent"}`, borderRadius: ecken,
      boxShadow: k > 0 || rahmen ? `0 0 30px rgba(157,92,255,${0.12 * k}), inset 0 1px 0 rgba(255,255,255,${0.04 * k})` : "none", ...style, ...(rahmen ? {} : { borderColor: "transparent" }) }}>{children}</div>
  );
};
const Titel = ({ children }) => <div style={{ fontSize: 22, fontWeight: 700, color: SUB, textTransform: "uppercase", letterSpacing: 2, marginBottom: 14 }}>{children}</div>;

// Zeichenkette der Anzeige (Option) oder ihr Standard; leer = nichts anzeigen
const opt = (el, k, std) => (typeof el?.[k] === "string" ? el[k] : std);

function TeamBlock({ t, rechts, h = 330, o, tx }) {
  const f = teamFarbe(t.name);
  return (
    <Panel style={{ flex: 1, display: "flex", flexDirection: rechts ? "row-reverse" : "row", alignItems: "center", gap: 36, padding: "0 46px", borderColor: t.sieger ? f : LINE, boxShadow: t.sieger ? `0 0 40px ${f}66` : undefined, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", [rechts ? "right" : "left"]: 0, top: 0, bottom: 0, width: 10, background: f, boxShadow: `0 0 24px ${f}` }} />
      <div style={{ flex: 1, textAlign: rechts ? "right" : "left" }}>
        {o.teamnamen !== false && <div style={{ fontSize: 56, fontWeight: 800, color: f, letterSpacing: 3, textShadow: `0 0 18px ${f}88` }}>{t.name}</div>}
        {t.sieger && tx(opt(o, "textSieger", "Sieger")) && <div style={{ fontSize: 26, fontWeight: 700, color: TXT, display: "inline-flex", alignItems: "center", gap: 10, marginTop: 6 }}><Trophy size={28} color={f} /> {tx(opt(o, "textSieger", "Sieger"))}</div>}
      </div>
      <div style={{ fontSize: Math.min(190, h * 0.58), fontWeight: 800, lineHeight: 1, color: TXT, fontVariantNumeric: "tabular-nums", textShadow: `0 0 34px ${f}aa` }}>{t.score}</div>
    </Panel>
  );
}

function Mitte({ d, o }) {
  const chips = o.chips !== false;
  return (
    <div style={{ width: 380, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center" }}>
      {d.mitte && <div style={{ fontSize: d.mitte.gross.length > 6 ? 64 : 84, fontWeight: 800, color: TXT, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{d.mitte.gross}</div>}
      {d.mitte?.klein && o.mitteKlein !== false && <div style={{ fontSize: 28, color: AKZ, fontWeight: 600, textShadow: "0 0 12px rgba(157,92,255,.7)" }}>{d.mitte.klein}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
        {d.vorbei && <Chip farbe={WARN}>Match vorbei</Chip>}
        {chips && d.chips.map((c) => <Chip key={c}>{c}</Chip>)}
      </div>
    </div>
  );
}

const Chip = ({ children, farbe }) => (
  <span style={{ fontSize: 22, padding: "6px 16px", borderRadius: 30, border: `1px solid ${farbe || LINE}`, color: farbe || "#d4d0de", background: "rgba(26,24,32,.8)", whiteSpace: "nowrap" }}>{children}</span>
);

function Bestenliste({ d, mitTeam, titel, zeilen, o, tx }) {
  const zelle = { padding: "8px 14px", fontSize: 28, borderBottom: `1px solid ${LINE}` };
  const kopf = { ...zelle, fontSize: 20, color: SUB, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", borderBottom: `2px solid ${LINE}` };
  return (
    <Panel style={{ height: "100%", boxSizing: "border-box", padding: "26px 32px", minWidth: 0, overflow: "hidden" }}>
      {titel && <Titel>{titel}</Titel>}
      {d.top.length === 0 ? <div style={{ fontSize: 26, color: MUTED, fontStyle: "italic" }}>{tx(opt(o, "textLeer", "Noch keine Spielerdaten."))}</div> : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
          {o.kopf !== false && <thead><tr>
            <th style={{ ...kopf, textAlign: "left", width: 50 }}>#</th>
            <th style={{ ...kopf, textAlign: "left" }}>Spieler</th>
            {d.spalten.map(([k, l]) => <th key={k} style={{ ...kopf, textAlign: "right" }}>{l}</th>)}
          </tr></thead>}
          <tbody>{d.top.slice(0, zeilen).map((p, i) => {
            const f = mitTeam && p.team ? teamFarbe(p.team) : ACCENT;
            return (
              <tr key={p.name} style={{ background: i === 0 ? "rgba(157,92,255,.12)" : "transparent" }}>
                <td style={{ ...zelle, color: i === 0 ? AKZ : MUTED, fontWeight: 800 }}>{i === 0 ? <Crown size={28} style={{ verticalAlign: -4 }} /> : i + 1}</td>
                <td style={{ ...zelle, fontWeight: i === 0 ? 800 : 600, borderLeft: `5px solid ${f}`, maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</td>
                {d.spalten.map(([k], j) => <td key={k} style={{ ...zelle, textAlign: "right", fontWeight: j === 0 ? 800 : 400, color: j === 0 ? TXT : SUB }}>{p[k] ?? 0}</td>)}
              </tr>
            );
          })}</tbody>
        </table>
      )}
    </Panel>
  );
}

function LetzteEvents({ events, titel, o, tx }) {
  const neueste = events[0]?.id;
  return (
    <Panel style={{ height: "100%", boxSizing: "border-box", padding: "26px 32px", overflow: "hidden" }}>
      {titel && <Titel>{titel}</Titel>}
      {events.length === 0 ? <div style={{ fontSize: 26, color: MUTED, fontStyle: "italic" }}>{tx(opt(o, "textLeer", "Noch keine Events."))}</div> : events.map((e) => {
        const f = e.ev.team ? teamFarbe(e.ev.team) : AKZ;
        return (
          <div key={e.id} className={e.id === neueste ? "neu" : ""} style={{ display: "flex", alignItems: "center", gap: 18, padding: "7px 12px", borderBottom: `1px solid ${LINE}`, borderRadius: 8 }}>
            <span style={{ color: f, display: "inline-flex", filter: `drop-shadow(0 0 6px ${f})` }}><EventIcon type={e.ev.type} spiel={e.ev.spiel} size={34} /></span>
            <span style={{ fontSize: 28, fontWeight: 700, whiteSpace: "nowrap" }}>{eventLabel(e.ev.type, e.ev.spiel)}</span>
            <span style={{ fontSize: 26, color: f, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.spieler !== false ? e.ev.player || e.ev.team || "" : ""}</span>
            {o.zeit !== false && <span style={{ fontSize: 20, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{zeit(e.t)}</span>}
          </div>
        );
      })}
    </Panel>
  );
}

function Spielstand({ d, spiel, h, o, tx }) {
  return (
    <div style={{ display: "flex", gap: 26, height: "100%" }}>
      {d.leer ? (
        <Panel style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
          {tx(opt(o, "textWarten", "Warten auf Spieldaten …")) && <div style={{ fontSize: 64, fontWeight: 800, color: TXT }}>{tx(opt(o, "textWarten", "Warten auf Spieldaten …"))}</div>}
          {o.wartenKlein !== false && <div style={{ fontSize: 28, color: SUB }}>{spiel ? `${spiel.name}: der Screen füllt sich, sobald das Match läuft` : "Kein aktives Spiel"}</div>}
        </Panel>
      ) : d.teams ? (
        <><TeamBlock t={d.teams[0]} h={h} o={o} tx={tx} /><Mitte d={d} o={o} /><TeamBlock t={d.teams[1]} rechts h={h} o={o} tx={tx} /></>
      ) : <Panel style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><Mitte d={d} o={o} /></Panel>}
    </div>
  );
}

const zwei = (n) => String(n).padStart(2, "0");
// Werte für Platzhalter in Texten ({spiel}, {session}, …)
export function textWerte({ spiel, d, cfg, jetzt, statistik, stand }) {
  const t = new Date(jetzt);
  const m = statistik?.spiel === spiel?.id ? statistik?.match || {} : {};
  return {
    runde: wertVon("runde", { statistik: statistik?.spiel === spiel?.id ? statistik : null, stand }).replace("–", ""),
    kills: m.kills ?? "", tode: m.tode ?? "", headshots: m.headshots ?? "",
    spiel: spiel?.name || "", kurz: spiel?.kurz || "", session: cfg?.regie?.session?.name || "",
    team1: d.teams?.[0]?.name || "", team2: d.teams?.[1]?.name || "", score1: d.teams?.[0]?.score ?? "", score2: d.teams?.[1]?.score ?? "",
    uhrzeit: `${zwei(t.getHours())}:${zwei(t.getMinutes())}`, datum: `${zwei(t.getDate())}.${zwei(t.getMonth() + 1)}.${t.getFullYear()}`,
  };
}

const WERT_SP = (k) => String(k).startsWith("sp.");
const JUSTIFY = { links: "flex-start", mitte: "center", rechts: "flex-end" };
function TextElement({ el, werte }) {
  const inhalt = (
    <div style={{ width: "100%", fontSize: el.groesse, lineHeight: 1.15, fontWeight: el.fett ? 800 : 400, color: el.farbe, textAlign: el.ausrichtung === "mitte" ? "center" : el.ausrichtung === "rechts" ? "right" : "left", whiteSpace: "pre-wrap", overflowWrap: "anywhere", textShadow: el.fett ? `0 0 18px ${el.farbe}55` : "none" }}>
      {textEinsetzen(el.text, werte)}
    </div>
  );
  const box = { width: "100%", height: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: JUSTIFY[el.ausrichtung], overflow: "hidden" };
  return el.panel ? <Panel style={{ ...box, padding: "0 30px" }}>{inhalt}</Panel> : <div style={box}>{inhalt}</div>;
}

// Teams mit ihren Spielern (Valorant mit Shots Fired: Namen aus ui_team_order beider Teams)
function TeamsAnzeige({ teams, titel, o, tx }) {
  const zelle = { padding: "6px 12px", fontSize: 26, borderBottom: `1px solid ${LINE}` };
  const leer = teams.every((t) => !t.spieler.length);
  return (
    <Panel style={{ height: "100%", boxSizing: "border-box", padding: "26px 32px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {titel && <Titel>{titel}</Titel>}
      {leer ? <div style={{ fontSize: 26, color: MUTED, fontStyle: "italic" }}>{tx(opt(o, "textLeer", "Noch keine Spieler."))}</div> : (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(teams.length, 3)}, minmax(0,1fr))`, gap: 26, flex: 1, minHeight: 0 }}>
          {teams.slice(0, 3).map((t) => {
            const f = teamFarbe(t.name);
            return (
              <div key={t.name} style={{ minWidth: 0, overflow: "hidden" }}>
                {o.kopf !== false && <div style={{ fontSize: 30, fontWeight: 800, color: f, letterSpacing: 2, borderBottom: `3px solid ${f}`, paddingBottom: 6, marginBottom: 4, textShadow: `0 0 14px ${f}88`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>}
                {t.spieler.map((p) => (
                  <div key={p.name} style={{ ...zelle, display: "flex", gap: 12, alignItems: "center", borderLeft: `4px solid ${f}` }}>
                    <span style={{ flex: 1, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    {o.zahlen !== false && p.kills != null && <span style={{ fontSize: 22, color: SUB, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}><b style={{ color: TXT }}>{p.kills}</b> / {p.tode ?? 0}</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// Spieler-Karte: Name, Team und Zahlen eines Spielers
function SpielerKarte({ el, sp }) {
  const f = sp?.team ? teamFarbe(sp.team) : ACCENT;
  const zahlen = [["kills", "Kills", sp?.kills], ["tode", "Tode", sp?.tode], ["headshots", "HS", sp?.headshots], ["kd", "K/D", sp ? kd(sp) : null]].filter(([k]) => el[k] !== false);
  const unter = [el.team !== false && sp?.team, el.seite !== false && sp?.seite].filter(Boolean).join(" · ");
  return (
    <Panel style={{ width: "100%", height: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 24, padding: "0 28px 0 0", overflow: "hidden", position: "relative" }}>
      <div style={{ alignSelf: "stretch", width: 10, background: f, boxShadow: `0 0 20px ${f}` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 44, fontWeight: 800, color: TXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sp ? sp.name : "Kein Spieler"}</div>
        {unter && <div style={{ fontSize: 22, fontWeight: 700, color: f, letterSpacing: 1, textTransform: "uppercase", marginTop: 4, whiteSpace: "nowrap" }}>{unter}</div>}
      </div>
      {zahlen.map(([k, l, v]) => (
        <div key={k} style={{ textAlign: "center", minWidth: 70 }}>
          <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1, color: k === "kills" ? AKZ : TXT, fontVariantNumeric: "tabular-nums" }}>{v ?? "–"}</div>
          <div style={{ fontSize: 16, color: SUB, textTransform: "uppercase", letterSpacing: 1, marginTop: 6 }}>{l}</div>
        </div>
      ))}
    </Panel>
  );
}

// Einzelwert: groß, passt sich der Blockgröße an (Schrift aus Höhe und Länge)
function WertElement({ el, wert }) {
  const label = el.beschriftung !== false ? el.text || WERT_KURZ[el.wert] || "" : "";
  const h = el.h - (el.panel ? 20 : 0), b = el.b - (el.panel ? 40 : 0);
  const lh = label ? Math.max(10, Math.min(48, h * 0.2)) : 0;
  const g = Math.max(10, Math.min((h - lh * 1.3) * 0.82, b / Math.max(1, String(wert).length * 0.62)));
  const inhalt = (
    <div style={{ width: "100%", textAlign: el.ausrichtung === "mitte" ? "center" : el.ausrichtung === "rechts" ? "right" : "left" }}>
      <div style={{ fontSize: g, fontWeight: 800, lineHeight: 1, color: el.farbe, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", textShadow: `0 0 18px ${el.farbe}55` }}>{wert}</div>
      {label && <div style={{ fontSize: lh, color: SUB, textTransform: "uppercase", letterSpacing: 1.5, marginTop: lh * 0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>}
    </div>
  );
  const box = { width: "100%", height: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: JUSTIFY[el.ausrichtung], overflow: "hidden" };
  return el.panel ? <Panel style={{ ...box, padding: "0 20px" }}>{inhalt}</Panel> : <div style={box}>{inhalt}</div>;
}

const OBJECT_FIT = { fuellen: "cover", einpassen: "contain", strecken: "fill" };
function BildElement({ el, bilder }) {
  const src = bilder?.[el.bild];
  const img = src ? <img src={src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: OBJECT_FIT[el.passung] || "contain", display: "block", borderRadius: el.panel ? 0 : el.radius }} /> : null;
  if (el.panel) return <Panel style={{ width: "100%", height: "100%", boxSizing: "border-box", padding: 14, overflow: "hidden", borderRadius: Math.max(el.ecken ?? 18, el.radius) }}><div style={{ width: "100%", height: "100%", borderRadius: Math.max(0, el.radius - 14), overflow: "hidden" }}>{img}</div></Panel>;
  return <div style={{ width: "100%", height: "100%", borderRadius: el.radius, overflow: "hidden" }}>{img}</div>;
}

// Inhalt eines Elements des Layouts in seinem Kasten
export function ElementInhalt({ el, ctx }) {
  const { d, spiel, live, log, cfg, werte, namen } = ctx;
  const tx = (t) => textEinsetzen(t, werte);
  switch (el.typ) {
    case "logo": {
      const g = Math.min(70, el.h - 8);
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 22, height: "100%", overflow: "hidden" }}>
          {el.icon !== false && <img src={APP_ICON} alt="" style={{ width: g, height: g, flexShrink: 0, filter: "drop-shadow(0 0 14px rgba(157,92,255,.85))" }} />}
          {el.titel && <div style={{ fontWeight: 800, fontSize: 40, letterSpacing: 3, color: AKZ, textShadow: "0 0 16px rgba(157,92,255,.8)", whiteSpace: "nowrap" }}>{textEinsetzen(el.titel, werte)}</div>}
        </div>
      );
    }
    case "spiel":
      return spiel ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, height: "100%", whiteSpace: "nowrap", overflow: "hidden" }}>
          {el.kurz !== false && <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: 2, padding: "8px 22px", borderRadius: 10, background: spiel.farbe, color: "#14121a", boxShadow: `0 0 24px ${spiel.farbe}aa` }}>{spiel.kurz}</span>}
          {el.name !== false && <span style={{ fontSize: 36, fontWeight: 700 }}>{spiel.name}</span>}
        </div>
      ) : tx(opt(el, "textOhne", "")) ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 30, color: SUB, whiteSpace: "nowrap", overflow: "hidden" }}>{tx(el.textOhne)}</div> : null;
    case "session":
      return <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", fontSize: 26, color: SUB, whiteSpace: "nowrap", overflow: "hidden" }}>{cfg?.regie?.session?.name || tx(opt(el, "textOhne", ""))}</div>;
    case "live":
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", overflow: "hidden" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 24, fontWeight: 800, letterSpacing: 2, color: live ? OK : MUTED, whiteSpace: "nowrap", minWidth: 0 }}>
            {el.punkt !== false && <span style={{ width: 18, height: 18, borderRadius: "50%", background: live ? OK : MUTED, boxShadow: live ? `0 0 14px ${OK}` : "none", animation: live ? "pulsGruen 1.6s ease-in-out infinite" : "none" }} />}
            {el.textAn !== false && tx(live ? opt(el, "textLive", "LIVE") : opt(el, "textWartet", "WARTET"))}
          </span>
        </div>
      );
    case "spielstand": return <Spielstand d={d} spiel={spiel} h={el.h} o={el} tx={tx} />;
    case "zahlen":
      return d.zahlen.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${d.zahlen.length}, 1fr)`, gap: 18, height: "100%" }}>
          {d.zahlen.map(([label, w]) => (
            <Panel key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <div style={{ fontSize: Math.min(54, el.h * 0.46), fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{w}</div>
              {el.labels !== false && <div style={{ fontSize: 20, color: SUB, textTransform: "uppercase", letterSpacing: 1.5, marginTop: 8 }}>{label}</div>}
            </Panel>
          ))}
        </div>
      ) : null;
    case "bestenliste": return <Bestenliste d={d} mitTeam={!!d.teams} titel={tx(el.titel || "")} o={el} tx={tx} zeilen={el.zeilen || Math.max(1, Math.floor((el.h - (el.titel ? 140 : 100)) / 54))} />;
    case "events": return <LetzteEvents titel={tx(el.titel || "")} o={el} tx={tx} events={statsEvents(log, spiel?.id, el.anzahl || Math.max(1, Math.min(12, Math.floor((el.h - (el.titel ? 100 : 60)) / 56))), namen)} />;
    case "text": return <TextElement el={el} werte={werte} />;
    case "teams": return <TeamsAnzeige teams={ctx.teams} titel={tx(el.titel || "")} o={el} tx={tx} />;
    case "spieler": return <SpielerKarte el={el} sp={spielerWahl(ctx.liste, el.quelle, el.rang)} />;
    case "wert": return <WertElement el={el} wert={wertVon(el.wert, { d, statistik: ctx.statistik, stand: ctx.stand, sp: WERT_SP(el.wert) ? spielerWahl(ctx.liste, el.quelle, el.rang) : null })} />;
    case "bild": return <BildElement el={el} bilder={ctx.bilder} />;
    default: return null;
  }
}

const HINTERGRUND = {
  verlauf: (spiel) => `radial-gradient(1200px 700px at 8% -10%, rgba(157,92,255,.28), transparent 60%), radial-gradient(1000px 600px at 105% 110%, ${spiel?.farbe || ACCENT}33, transparent 60%), ${BG}`,
  schwarz: () => "#000",
  gruen: () => "#00b140",
  transparent: () => "transparent",
  farbe: (_, l) => l.hg.farbe,
  eigen: (_, l) => verlaufCss(l.hg.verlauf),
  bild: (_, l) => {
    const src = l.bilder[l.hg.bild];
    if (!src) return BG;
    // Ebenen von oben: eigener Verlauf (wenn darübergelegt), Abdunkeln, Bild
    const verlauf = l.hg.verlaufDrueber ? `${verlaufCss(l.hg.verlauf)}, ` : "";
    const dunkel = l.hg.abdunkeln ? `linear-gradient(rgba(0,0,0,${l.hg.abdunkeln / 100}), rgba(0,0,0,${l.hg.abdunkeln / 100})), ` : "";
    return `${verlauf}${dunkel}url("${src}") center / ${l.hg.passung === "einpassen" ? "contain" : "cover"} no-repeat, #000`;
  },
};
export const hintergrundCss = (l, spiel) => (HINTERGRUND[l.hintergrund] || HINTERGRUND.verlauf)(spiel, l);

// Ein Element in seinem Kasten. Anzeigen werden in ihrer Gestaltungsgröße gesetzt und auf den Kasten skaliert,
// so wachsen Schrift, Logos und Tabellen mit dem Block.
export function ElementKasten({ e, ctx }) {
  const { f, b, h } = inhaltsSkala(e);
  const stil = { kachel: e.kachel ?? 92, ecken: e.ecken ?? 18, rahmen: e.rahmen !== false };
  return (
    <StilKontext.Provider value={stil}>
    <div style={{ position: "absolute", left: e.x, top: e.y, width: e.b, height: e.h, opacity: (e.deckkraft ?? 100) / 100,
      ...(e.schrift ? { "--txt": e.schrift, color: e.schrift } : {}), ...(e.akzent ? { "--akz": e.akzent } : {}) }}>
      {f === 1 ? <ElementInhalt el={e} ctx={ctx} /> : (
        <div style={{ width: b, height: h, transform: `scale(${f})`, transformOrigin: "0 0" }}>
          <ElementInhalt el={{ ...e, b, h }} ctx={ctx} />
        </div>
      )}
    </div>
    </StilKontext.Provider>
  );
}

// Daten für alle Elemente einmal ausrechnen
export function buehnenDaten({ status, cfg, log, jetzt }) {
  const spiel = SPIEL_BY_ID[status?.aktivesSpiel || cfg?.regie?.aktivesSpiel];
  const d = statsDaten(spiel, status?.statistik, status?.stand);
  const live = !!(status?.stand?.t && jetzt - status.stand.t < FRISCH);
  const statistik = status?.statistik?.spiel === spiel?.id ? status.statistik : null;
  return { spiel, d, live, log, cfg, namen: status?.namen || {}, werte: textWerte({ spiel, d, cfg, jetzt, statistik, stand: status?.stand }), bilder: {},
    statistik, stand: status?.stand, liste: spielerDaten(status, spiel?.id), teams: teamListen(status, spiel) };
}

// screen: Eintrag aus cfg.regie.stats.screens (Größe und Layout), layout: statt des gespeicherten (Editor)
export function StatsBuehne({ status, cfg, log, jetzt = Date.now(), layout, screen }) {
  const sc = screen || screenVon(cfg?.regie?.stats, "");
  const B = sc?.b || 1920, H = sc?.h || 1080;
  const l = layout || migrateLayout(sc?.layout, { b: B, h: H });
  const ctx = { ...buehnenDaten({ status, cfg, log, jetzt }), bilder: l.bilder };
  return (
    <div style={{ width: B, height: H, position: "relative", overflow: "hidden", fontFamily: FONT, color: "#ece9f2", background: hintergrundCss(l, ctx.spiel) }}>
      {l.elemente.filter((e) => e.sichtbar).map((e) => <ElementKasten key={e.id} e={e} ctx={ctx} />)}
    </div>
  );
}

export default function StatsScreen() {
  const [status, setStatus] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [log, setLog] = useState([]);
  const [jetzt, setJetzt] = useState(Date.now());
  // Welcher Screen: aus dem Hash (#stats=<id>), ohne ID der erste; im NDI-Fenster ohne eigenen Hintergrund (Alpha)
  const wahl = leseStatsHash(window.location.hash) || { id: "", ndi: false };
  const screen = cfg ? screenVon(cfg.regie?.stats, wahl.id) : null;
  const B = screen?.b || 1920, H = screen?.h || 1080;
  const s = useSkalierung(B, H);
  const durchsichtig = wahl.ndi && screen?.layout?.hintergrund === "transparent";
  useEffect(() => {
    // NDI mit Alpha: auch Seite und html ohne Hintergrund
    for (const el of [document.documentElement, document.body]) el.style.background = durchsichtig ? "transparent" : "";
  }, [durchsichtig]);
  useEffect(() => { document.title = `Advanced LAN · ${screen?.name || "Game Stats"}`; }, [screen?.name]);
  useEffect(() => {
    const laden = () => api.getConfig().then(setCfg);
    laden();
    api.status().then((st) => setStatus(st?.regie || null));
    api.regieLog().then((l) => setLog(l || []));
    const ab = [api.onStatus((st) => setStatus(st?.regie || null)), api.onRegieEvent((e) => setLog((l) => logEinfuegen(l, e))), api.onStatsConfig?.(setCfg)];
    // Einstellungen kommen per stats-config; zur Sicherheit alle 10 s neu laden (Layouts mit Bildern sind groß)
    let n = 0;
    const t = setInterval(() => { setJetzt(Date.now()); if (++n % 5 === 0) laden(); }, 2000);
    return () => { ab.forEach((f) => f && f()); clearInterval(t); };
  }, []);
  return (
    <div onDoubleClick={() => api.statsVollbild?.()} title="Doppelklick: Vollbild" style={{ position: "fixed", inset: 0, background: durchsichtig ? "transparent" : "#000", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: B, height: H, transform: `translate(-50%, -50%) scale(${s})`, transformOrigin: "center" }}>
        {cfg && <StatsBuehne status={status} cfg={cfg} log={log} jetzt={jetzt} screen={screen} />}
      </div>
    </div>
  );
}
