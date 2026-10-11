"use strict";
// Spiele ohne offizielle Live-Schnittstelle: Valorant und The Finals. Der Game-PC erkennt ihre Aktionen am Bild (bild-erkennung.js).
// Welche Stelle des Bildes welche Aktion ist, legt der Nutzer im Editor fest: Gameplay aufnehmen, Frame wählen, Bereich ziehen,
// Event zuordnen, Threshold und optional ein Wort für die Texterkennung. Die Konfiguration lässt sich als Datei exportieren
// und auf den anderen Game-PCs importieren. Kein Speicherlesen, kein Eingriff ins Spiel.
// Riot-Regeln für Valorant: kein Spike-Timer. „Spike gelegt“ ist ein einzelner Cue, einen Countdown sendet die App nie.
// Reine Funktionen ohne Node-Abhängigkeiten: laufen im Hauptprozess, in der Oberfläche und in den Tests.

const { Dedupe } = require("./events");
const { region, ankerVon, umrechnen, ANKER_H, ANKER_V, SIG_LAENGE, dekodieren } = require("./bild-erkennung");

const M = (id, label, x = {}) => ({ id, label, gruppe: "Match", ...x });
const R = (id, label, x = {}) => ({ id, label, gruppe: "Runde", ...x });
const P = (id, label) => ({ id, label, gruppe: "Spieler", spieler: true, team: true });
// Eigene Aktionen: frei benennbar im Editor, in „Signale“ als „Eigene Aktion n“
const EIGENE = Array.from({ length: 6 }, (_, i) => ({ id: `eigene_${i + 1}`, label: `Eigene Aktion ${i + 1}`, gruppe: "Eigene", team: true }));

// art: wie die Quelle das Event behandelt. start = Runde beginnt, ende = Runde endet, matchende = Match vorbei
const BILD_SPIELE = [
  {
    id: "valorant", name: "Valorant", kurz: "VAL", farbe: "#ff4655", teams: ["TEAM A", "TEAM B"],
    exe: "valorant-win64-shipping.exe", fenster: "VALORANT",
    events: [
      M("match_start", "Match startet"), M("match_won", "Match gewonnen", { team: true, art: "matchende" }),
      R("round_start", "Kaufphase (Runde startet)", { art: "start" }), R("round_end", "Runde gewonnen", { team: true, art: "ende" }),
      R("spike_planted", "Spike gelegt"), R("spike_defused", "Spike entschärft"),
      P("kill", "Kill"), P("death", "Spieler stirbt"), P("ace", "Ace"), P("clutch", "Clutch"),
      ...EIGENE,
    ],
    // Vorschläge im Editor: Name, Event, Seite (eigen = dieser PC gewinnt, gegner = der andere), typischer Bereich bei 16:9
    vorschlaege: [
      ["Kaufphase", "round_start", "eigen", { x: 0.4, y: 0.12, b: 0.2, h: 0.06 }],
      ["Runde gewonnen", "round_end", "eigen", { x: 0.3, y: 0.2, b: 0.4, h: 0.12 }],
      ["Runde verloren", "round_end", "gegner", { x: 0.3, y: 0.2, b: 0.4, h: 0.12 }],
      ["Spike gelegt", "spike_planted", "eigen", { x: 0.47, y: 0.02, b: 0.06, h: 0.07 }],
      ["Spike entschärft", "spike_defused", "eigen", { x: 0.3, y: 0.2, b: 0.4, h: 0.12 }],
      ["Eigener Kill", "kill", "eigen", { x: 0.42, y: 0.72, b: 0.16, h: 0.14 }],
      ["Selbst gestorben", "death", "eigen", { x: 0.35, y: 0.78, b: 0.3, h: 0.12 }],
      ["Ace", "ace", "eigen", { x: 0.35, y: 0.62, b: 0.3, h: 0.1 }],
      ["Clutch", "clutch", "eigen", { x: 0.35, y: 0.62, b: 0.3, h: 0.1 }],
      ["Match gewonnen", "match_won", "eigen", { x: 0.3, y: 0.35, b: 0.4, h: 0.2 }],
      ["Match verloren", "match_won", "gegner", { x: 0.3, y: 0.35, b: 0.4, h: 0.2 }],
    ],
  },
  {
    id: "finals", name: "The Finals", kurz: "FIN", farbe: "#ffd23f", teams: ["TEAM A", "TEAM B", "TEAM C", "TEAM D"],
    exe: "discovery.exe", fenster: "THE FINALS",
    events: [
      M("match_start", "Match startet"), M("match_won", "Match gewonnen", { team: true, art: "matchende" }), M("eliminated", "Team ausgeschieden", { team: true }),
      R("round_start", "Runde startet", { art: "start" }), R("round_end", "Runde gewonnen", { team: true, art: "ende" }),
      R("vault_opened", "Tresor geöffnet"), R("cashout_started", "Cashout gestartet", { team: true }), R("cashout_stolen", "Cashout gestohlen", { team: true }), R("cashout_done", "Cashout geschafft", { team: true }),
      P("kill", "Kill"), P("death", "Spieler stirbt"), P("revived", "Wiederbelebt"), R("team_wipe", "Team ausgelöscht", { team: true }),
      ...EIGENE,
    ],
    vorschlaege: [
      ["Runde startet", "round_start", "eigen", { x: 0.35, y: 0.15, b: 0.3, h: 0.08 }],
      ["Runde gewonnen", "round_end", "eigen", { x: 0.3, y: 0.2, b: 0.4, h: 0.12 }],
      ["Cashout gestartet", "cashout_started", "eigen", { x: 0.35, y: 0.15, b: 0.3, h: 0.06 }],
      ["Cashout gestohlen", "cashout_stolen", "eigen", { x: 0.35, y: 0.15, b: 0.3, h: 0.06 }],
      ["Cashout geschafft", "cashout_done", "eigen", { x: 0.35, y: 0.15, b: 0.3, h: 0.06 }],
      ["Eigener Kill", "kill", "eigen", { x: 0.42, y: 0.6, b: 0.16, h: 0.1 }],
      ["Selbst gestorben", "death", "eigen", { x: 0.35, y: 0.4, b: 0.3, h: 0.12 }],
      ["Team ausgelöscht", "team_wipe", "eigen", { x: 0.3, y: 0.3, b: 0.4, h: 0.1 }],
      ["Match gewonnen", "match_won", "eigen", { x: 0.3, y: 0.35, b: 0.4, h: 0.2 }],
      ["Ausgeschieden", "eliminated", "eigen", { x: 0.3, y: 0.35, b: 0.4, h: 0.2 }],
    ],
  },
];
const BILD_BY_ID = Object.fromEntries(BILD_SPIELE.map((s) => [s.id, s]));

/* ── Einstellungen ────────────────────────────────────────────────────── */
const FPS = [2, 4, 6, 10];
const uid = () => Math.random().toString(36).slice(2, 10);
const text = (x, max = 60) => (typeof x === "string" ? x.slice(0, max) : "");
const num = (x, min, max, std) => (Number.isFinite(Number(x)) ? Math.min(max, Math.max(min, Number(x))) : std);

// Eine Aktion: ein oder mehrere Bereiche (Auslöser), je mit Frames und/oder einem Wort, das dort stehen muss,
// und welches Event dann an die Regie geht. modus: "eines" = ein Auslöser reicht, "alle" = alle gleichzeitig.
const MAX_BEREICHE = 6, MAX_FRAMES = 12;
function migrateBereich(b, i) {
  if (!b || typeof b !== "object") return null;
  const r = region(b.region);
  const anker = { h: ANKER_H.includes(b.anker?.h) ? b.anker.h : ankerVon(r).h, v: ANKER_V.includes(b.anker?.v) ? b.anker.v : ankerVon(r).v };
  const vorlagen = (Array.isArray(b.vorlagen) ? b.vorlagen : [])
    .filter((v) => v && typeof v.sig === "string" && dekodieren(v.sig)?.length === SIG_LAENGE)
    .slice(0, MAX_FRAMES).map((v) => ({ sig: v.sig, bild: typeof v.bild === "string" && v.bild.startsWith("data:image/") ? v.bild : "" }));
  return { id: text(b.id, 20) || `b${i + 1}`, region: r, anker, vorlagen, text: text(b.text, 120).trim() };
}
function migrateAktion(a, spiel) {
  const def = BILD_BY_ID[spiel];
  if (!a || typeof a !== "object" || !def) return null;
  const event = def.events.some((e) => e.id === a.event) ? a.event : null;
  if (!event) return null;
  // Bis Beta 7 hatte eine Aktion genau einen Bereich (region, anker, vorlagen, text direkt an der Aktion)
  const roh = Array.isArray(a.bereiche) && a.bereiche.length ? a.bereiche : [{ region: a.region, anker: a.anker, vorlagen: a.vorlagen, text: a.text }];
  const bereiche = roh.slice(0, MAX_BEREICHE).map(migrateBereich).filter(Boolean);
  const ids = new Set();
  for (const b of bereiche) { while (ids.has(b.id)) b.id = uid(); ids.add(b.id); }
  if (!bereiche.length) bereiche.push(migrateBereich({}, 0));
  return {
    id: text(a.id, 20) || uid(), name: text(a.name) || def.events.find((e) => e.id === event).label, event,
    seite: a.seite === "gegner" && def.teams.length === 2 ? "gegner" : "eigen",
    bereiche, modus: a.modus === "alle" ? "alle" : "eines",
    schwelle: num(a.schwelle, 0.5, 0.99, 0.8), pause: num(a.pause, 200, 60000, 2000), an: a.an !== false,
  };
}
// Hat der Bereich etwas zum Vergleichen? Ist die Aktion eingerichtet?
const bereichBereit = (b) => !!(b.vorlagen.length || b.text);
const aktionBereit = (a) => a.an && a.bereiche.some(bereichBereit);

// Aufträge für die Erkennung aus den Aktionen eines Spiels (Hauptprozess und Editor-Test):
// teile: [{ key, region, text }] für das Aufnahmefenster, aktionen und vorlagen für BildErkennung
function erkennungsAuftrag(aktionen) {
  const bereit = aktionen.filter(aktionBereit);
  const ort = (a) => JSON.stringify(a.bereiche.filter(bereichBereit).map((b) => b.region));
  // Aktionen mit denselben Bereichen bilden eine Gruppe: nur die ähnlichste zählt (z. B. Runde gewonnen/verloren)
  const gruppe = (a) => (bereit.filter((x) => ort(x) === ort(a)).length > 1 ? ort(a) : undefined);
  const teile = [], vorlagen = {};
  const liste = bereit.map((a) => ({
    id: a.id, gruppe: gruppe(a), pause: a.pause, schwelle: a.schwelle, modus: a.modus,
    teile: a.bereiche.filter(bereichBereit).map((b) => {
      const key = `${a.id}.${b.id}`;
      teile.push({ key, region: b.region, text: !!b.text });
      vorlagen[key] = b.vorlagen.map((v) => v.sig);
      return { key, text: b.text };
    }),
  }));
  return { teile, aktionen: liste, vorlagen };
}

function standardBildSpiel(id) {
  // quelle: "auto" (Spielfenster, sobald es offen ist), "bildschirm" (eingestellter Bildschirm) oder "fenster:<Titel>"
  return { team: BILD_BY_ID[id].teams[0], quelle: "auto", aufloesung: null, aktionen: [] }; // aufloesung: { b, h } des Bildes, in dem die Bereiche gezogen wurden
}
function standardBild() {
  return { an: true, display: "", fps: 4, spiele: Object.fromEntries(BILD_SPIELE.map((s) => [s.id, standardBildSpiel(s.id)])) };
}
const quelleOk = (q) => (q === "bildschirm" || (typeof q === "string" && /^fenster:.+/.test(q)) ? q.slice(0, 200) : "auto");
const aufloesung = (a) => (a && Number(a.b) > 0 && Number(a.h) > 0 ? { b: Math.round(Number(a.b)), h: Math.round(Number(a.h)) } : null);
function migrateBild(v) {
  const d = standardBild();
  if (!v || typeof v !== "object") return d;
  const spiele = {};
  for (const s of BILD_SPIELE) {
    const alt = v.spiele?.[s.id] || {};
    spiele[s.id] = {
      team: s.teams.includes(alt.team) ? alt.team : s.teams[0],
      quelle: quelleOk(alt.quelle),
      aufloesung: aufloesung(alt.aufloesung),
      aktionen: (Array.isArray(alt.aktionen) ? alt.aktionen : []).map((a) => migrateAktion(a, s.id)).filter(Boolean).slice(0, 40),
    };
  }
  return { an: v.an !== false, display: typeof v.display === "string" ? v.display : "", fps: FPS.includes(Number(v.fps)) ? Number(v.fps) : d.fps, spiele };
}

/* ── Bildquellen ──────────────────────────────────────────────────────── */
// Fenstertitel vergleichen: Groß/klein und Leerzeichen am Rand egal (Valorant heißt „VALORANT  “)
const titel = (t) => String(t || "").trim().replace(/\s+/g, " ").toUpperCase();
// Ist das Spielfenster offen? fenster: [{ id, name }] aus desktopCapturer (Typ window)
function spielFenster(def, fenster) {
  const muster = titel(def.fenster);
  return (muster && fenster.find((f) => titel(f.name) === muster)) || null; // genau der Titel: ein Browser-Tab „Valorant Guide“ zählt nicht
}
// Welches offene Fenster gehört zur eingestellten Quelle eines Spiels? null = Bildschirm oder (noch) nicht offen.
// "fenster:<Titel>": genau dieser Titel, sonst ein Fenster, dessen Titel ihn enthält (Programme mit wechselndem Titel, z. B. „OBS“)
function fensterFuer(def, sc, fenster = []) {
  const q = sc?.quelle || "auto";
  if (q === "bildschirm") return null;
  if (!q.startsWith("fenster:")) return spielFenster(def, fenster);
  const t = titel(q.slice(8));
  return (t && (fenster.find((x) => titel(x.name) === t) || fenster.find((x) => titel(x.name).includes(t)))) || null;
}
// Welche Bild-Spiele werden gerade erkannt, und woher kommt ihr Bild?
// bild: cfg.gamepc.bild, fenster: offene Fenster, aktiv: Bild-Spiel, das die Regie aktiv hat (oder null)
// → { spiel: { art: "fenster" | "bildschirm", id?, name } }. Mehrere Spiele gleichzeitig, jedes mit eigener Quelle.
function erkennungsPlan(bild, fenster = [], aktiv = null) {
  const plan = {};
  if (!bild?.an) return plan;
  for (const def of BILD_SPIELE) {
    const sc = bild.spiele?.[def.id];
    if (!sc || !sc.aktionen.some(aktionBereit)) continue;
    const f = fensterFuer(def, sc, fenster);
    if (f) plan[def.id] = { art: "fenster", id: f.id, name: f.name.trim() };
    else if (sc.quelle === "bildschirm" && (spielFenster(def, fenster) || aktiv === def.id)) plan[def.id] = { art: "bildschirm", name: "Bildschirm" };
  }
  return plan;
}

/* ── Export und Import ────────────────────────────────────────────────── */
const EXPORT_FORMAT = "advanced-lan-spiel";
// Team bleibt draußen: das stellt jeder PC selbst ein
function exportDatei(spiel, cfgSpiel) {
  return { format: EXPORT_FORMAT, version: 1, spiel, aufloesung: cfgSpiel.aufloesung, aktionen: cfgSpiel.aktionen };
}
// Datei → { spiel, aufloesung, aktionen, korrigiert } oder { fehler }. bildschirm: { b, h } dieses PCs für die Korrektur
function importDatei(json, bildschirm) {
  let d = json;
  if (typeof json === "string") { try { d = JSON.parse(json); } catch { return { fehler: "Keine gültige Datei (kein JSON)" }; } }
  if (!d || d.format !== EXPORT_FORMAT) return { fehler: "Das ist keine Spiel-Konfiguration von Advanced LAN" };
  if (!BILD_BY_ID[d.spiel]) return { fehler: `Unbekanntes Spiel: ${String(d.spiel).slice(0, 30)}` };
  const von = aufloesung(d.aufloesung), nach = aufloesung(bildschirm);
  let aktionen = (Array.isArray(d.aktionen) ? d.aktionen : []).map((a) => migrateAktion(a, d.spiel)).filter(Boolean);
  if (!aktionen.length) return { fehler: "Die Datei enthält keine Aktionen" };
  // Anderes Seitenverhältnis: Bereiche nach ihrem Anker verschieben. Die Frames bleiben gültig, sie werden ohnehin verkleinert verglichen.
  const korrigiert = !!(von && nach && Math.abs(von.b / von.h - nach.b / nach.h) > 0.01);
  if (korrigiert) aktionen = aktionen.map((a) => ({ ...a, bereiche: a.bereiche.map((b) => ({ ...b, region: umrechnen(b.region, von, nach, b.anker) })) }));
  return { spiel: d.spiel, aufloesung: korrigiert ? nach : von || nach, aktionen, korrigiert };
}

/* ── Quelle des Game-PCs ──────────────────────────────────────────────── */
let quellenNr = 0;

// Erkannte Aktionen → Events und Stand für die Regie.
// Nachrichten: { bild: true, event, seite } von der Erkennung; der Simulator schickt zusätzlich team und name mit.
class BildQuelle {
  constructor(spiel, { team, name = "" } = {}) {
    this.spiel = spiel;
    this.def = BILD_BY_ID[spiel];
    this.team = team || this.def.teams[0];
    this.name = name;
    this.dedupe = new Dedupe();
    this.uid = `${spiel}:${++quellenNr}:${Math.random().toString(36).slice(2, 7)}`;
    this.neu();
  }

  // Neues Match: Zustand an Ort und Stelle zurücksetzen
  neu() { this.z = Object.assign(this.z || {}, { laeuft: false, runde: 0, siege: {}, n: {}, nach: null, endeT: null }); }

  gegner() { const t = this.def.teams; return t.length === 2 ? t[t[0] === this.team ? 1 : 0] : ""; }

  ingest(m, now = Date.now()) {
    const ev = m && m.bild && this.def?.events.find((e) => e.id === m.event);
    if (!ev) return { events: [], status: this.status(), stand: this.stand() };
    if (m.team && this.def.teams.includes(m.team)) this.team = m.team;
    if (typeof m.name === "string" && m.name) this.name = m.name;
    const z = this.z, roh = [];
    const team = m.seite === "gegner" ? this.gegner() : this.team;
    const global = (type, extra = {}) => roh.push({ type, team: "", round: z.runde, ...extra });
    // Erste Runde nach dem Matchende (oder überhaupt): neues Match
    const matchStart = () => { if (!z.laeuft) { this.neu(); z.laeuft = true; global("match_start", { round: 0 }); } };
    if (ev.art === "start") {
      matchStart();
      z.runde++;
      global(ev.id, { round: z.runde });
    } else if (ev.art === "ende") {
      if (z.nach === z.runde && now - z.endeT < 15000) return this.ergebnis([], now); // eine Runde endet nur einmal, auch wenn Sieg und Niederlage flackern
      matchStart();
      if (z.runde === 0 || z.nach === z.runde) z.runde++; // ohne erkannten Rundenstart zählt das Rundenende
      Object.assign(z, { nach: z.runde, endeT: now });
      if (team) z.siege[team] = (z.siege[team] || 0) + 1;
      global(ev.id, { team });
    } else if (ev.art === "matchende") {
      if (!z.laeuft) return this.ergebnis([], now); // nur nach erkannten Runden, und nur einmal
      z.laeuft = false;
      global(ev.id, { team });
    } else if (ev.id === "match_start") matchStart();
    else if (ev.spieler) {
      z.n[ev.id] = (z.n[ev.id] || 0) + 1;
      roh.push({ type: ev.id, team, player: this.name, steamid: this.uid, kills: z.n[ev.id], round: z.runde });
    } else global(ev.id, ev.team ? { team } : {});
    return this.ergebnis(roh, now);
  }

  ergebnis(roh, now) {
    const events = roh.filter((x) => this.dedupe.accept(x, now));
    return { events, status: this.status(), stand: this.stand() };
  }

  status() { return { spieler: this.name, team: this.team, kills: this.z.n.kill || 0, deaths: this.z.n.death || 0 }; }

  stand() {
    const z = this.z;
    if (!z.laeuft && !z.runde) return null;
    return { runde: z.runde, score: { ...z.siege }, laeuft: z.laeuft };
  }
}

module.exports = { erkennungsAuftrag, aktionBereit, bereichBereit, migrateBereich, MAX_BEREICHE, MAX_FRAMES, erkennungsPlan, spielFenster, fensterFuer, BILD_SPIELE, BILD_BY_ID, FPS, standardBild, migrateBild, migrateAktion, exportDatei, importDatei, EXPORT_FORMAT, BildQuelle, uid };
