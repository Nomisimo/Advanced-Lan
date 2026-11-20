"use strict";
// Valorant über die Overwolf-App „Shots Fired“ (Mike Holloway). Shots Fired gibt die Live-Events von Overwolf (GEP)
// unverändert an einen Webhook weiter. Diese App ist der Webhook: Auf dem Game-PC lauscht sie auf
// http://localhost:44207 und nimmt jede Anfrage an. Das genaue Format der Anfragen ist nicht dokumentiert,
// deshalb liest shotsfiredEvents() mehrere übliche Formen und alles, was ankommt, wird mitgeschrieben (letzte Anfragen).
//
// GEP-Daten für Valorant (OW-Electron-Doku, supported-games/valorant):
// - Events: match_start, match_end, kill, death, assist, headshot, spike_planted, spike_defused, spike_detonated
// - Info-Updates: round_phase (shopping, combat, end), score / match_score ({ won, lost } aus Sicht dieses Spielers)
// Rundenstart, Rundenende, Rundengewinner und Matchgewinner gibt es für Valorant nicht als Event (anders als bei R6 oder OW2):
// Rundenstart = round_phase wechselt auf „shopping“, Rundenende mit Sieger = score steigt. Ohne score zählt round_phase „end“
// als Rundenende ohne Sieger. Kommen trotzdem round_start oder round_end als Event, werden sie übernommen.
// match_end kommt laut Doku nicht bei Custom Matches, deshalb zählt auch der Stand (13 Runden mit 2 Vorsprung).
// Riot-Regel: kein Spike-Timer. Gelegt, entschärft und explodiert sind einzelne Cues.
// Reine Funktionen ohne Node-Abhängigkeiten: laufen im Hauptprozess, in der Oberfläche und in den Tests.

const SHOTSFIRED_PORT = 44207;
const SHOTSFIRED_STORE_URL = "https://www.overwolf.com/app/mike_holloway-shots_fired";
const SHOTSFIRED_URL = `http://localhost:${SHOTSFIRED_PORT}/valorant`;

// GEP-Event → Event der Valorant-Quelle (bild-spiele.js)
const SF_EVENTS = {
  match_start: "match_start", match_end: "match_end", kill: "kill", death: "death", assist: "assist", headshot: "headshot",
  spike_planted: "spike_planted", spike_defused: "spike_defused", spike_detonated: "spike_detonated", spike_exploded: "spike_detonated",
  round_start: "round_start", round_end: "round_end",
};
const SCORE_KEYS = ["score", "match_score"];
const SIEG_RUNDEN = 13;

const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/[\s\-.]+/g, "_");
const json = (v) => { if (typeof v !== "string") return v; const t = v.trim(); if (!/^[{[]/.test(t)) return v; try { return JSON.parse(t); } catch { return v; } };

// Name eines Events → Event-ID oder null. Nimmt auch „Spike Planted“ oder „valorant.spike_planted“.
function eventName(name) {
  const n = norm(name);
  if (!n) return null;
  if (SF_EVENTS[n]) return SF_EVENTS[n];
  const teil = Object.keys(SF_EVENTS).filter((k) => n.endsWith(`_${k}`) || n.endsWith(`:${k}`)).sort((a, b) => b.length - a.length)[0];
  return teil ? SF_EVENTS[teil] : null;
}

// Spielstand { won, lost } aus einem Wert (Objekt oder JSON-Text)
function scoreVon(v) {
  const s = json(v);
  if (!s || typeof s !== "object") return null;
  const won = Number(s.won ?? s.win ?? s.wins), lost = Number(s.lost ?? s.loss ?? s.losses);
  return Number.isFinite(won) && Number.isFinite(lost) ? { won, lost } : null;
}

// Eine Anfrage (Text oder Objekt) → { events: [Name], infos: [{ key, value }] }
function zerlegen(body) {
  const out = { events: [], infos: [] };
  const besuche = (x, tiefe = 0) => {
    x = json(x);
    if (tiefe > 5 || x == null) return;
    if (typeof x === "string") { if (eventName(x)) out.events.push(x); return; }
    if (Array.isArray(x)) { x.forEach((y) => besuche(y, tiefe + 1)); return; }
    if (typeof x !== "object") return;
    // GEP-Events: { events: [{ name, data }] } oder ein einzelnes { name, data }
    if (Array.isArray(x.events)) x.events.forEach((y) => besuche(y, tiefe + 1));
    const name = x.event ?? x.name ?? x.eventName ?? x.event_name ?? x.type ?? x.key ?? x.id;
    if (typeof name === "string") {
      if (SCORE_KEYS.includes(norm(name)) || norm(name) === "round_phase") out.infos.push({ key: norm(name), value: x.value ?? x.data ?? x.val });
      else if (eventName(name)) out.events.push(name);
      else if (typeof x.value === "string" && eventName(x.value)) out.events.push(x.value);
    }
    // GEP-Info-Updates: { info: { match_info: { score: "{…}" } } } oder { feature, key, value }
    const info = json(x.info);
    if (info && typeof info === "object") for (const gruppe of Object.values(info)) {
      const g = json(gruppe);
      if (g && typeof g === "object") for (const [k, v] of Object.entries(g)) if (SCORE_KEYS.includes(k) || k === "round_phase") out.infos.push({ key: k, value: v });
    }
    for (const k of [...SCORE_KEYS, "round_phase"]) if (x[k] != null && k !== name) out.infos.push({ key: k, value: x[k] });
    for (const k of ["event", "data", "payload", "body", "message"]) if (x[k] != null && typeof json(x[k]) === "object") besuche(x[k], tiefe + 1);
  };
  besuche(body);
  return out;
}

// Zustand je Game-PC: letzter Spielstand und ob das Match schon entschieden ist
const sfZustand = () => ({ score: null, entschieden: false, phase: "" });

// Anfrage → Nachrichten für die Valorant-Quelle: [{ event, seite }]. seite: eigen = Team dieses PCs, gegner = das andere, keins = ohne Team.
function shotsfiredEvents(body, z = sfZustand()) {
  const { events, infos } = zerlegen(body);
  const raus = [];
  const matchSieg = (seite) => { if (!z.entschieden) { z.entschieden = true; raus.push({ event: "match_won", seite }); } };
  for (const { key, value } of infos) {
    if (key === "round_phase") {
      const p = norm(json(value)?.round_phase ?? value);
      if (p === "shopping" && z.phase !== "shopping") raus.push({ event: "round_start", seite: "eigen" });
      // Ohne Spielstand: Rundenende ohne Sieger. Mit Spielstand kommt das Rundenende mit Sieger, wenn score steigt.
      if (p === "end" && z.phase !== "end" && !z.score) raus.push({ event: "round_end", seite: "keins" });
      z.phase = p;
      continue;
    }
    const s = scoreVon(value);
    if (!s) continue;
    const alt = z.score;
    // Neues Match: Stand fällt zurück (oder erster Stand 0:0)
    if (!alt || s.won < alt.won || s.lost < alt.lost) { z.score = s; z.entschieden = false; if (!alt || s.won + s.lost === 0) continue; }
    else z.score = s;
    if (alt && s.won > alt.won) raus.push({ event: "round_end", seite: "eigen" });
    if (alt && s.lost > alt.lost) raus.push({ event: "round_end", seite: "gegner" });
    if (s.won >= SIEG_RUNDEN && s.won - s.lost >= 2) matchSieg("eigen");
    else if (s.lost >= SIEG_RUNDEN && s.lost - s.won >= 2) matchSieg("gegner");
  }
  for (const n of events) {
    const id = eventName(n);
    if (id === "match_start") { z.score = null; z.entschieden = false; z.phase = ""; raus.push({ event: id, seite: "eigen" }); }
    else if (id === "match_end") {
      // Mit bekanntem Stand den Sieger mitliefern, sonst nur „Match vorbei“
      const s = z.score;
      if (s && s.won !== s.lost) matchSieg(s.won > s.lost ? "eigen" : "gegner");
      else raus.push({ event: id, seite: "eigen" });
    } else if (id === "round_end") { if (!z.score) raus.push({ event: id, seite: "keins" }); } // mit Spielstand kommt das Ende mit Sieger aus score
    else if (id === "round_start") { if (z.phase !== "shopping") raus.push({ event: id, seite: "eigen" }); z.phase = "shopping"; }
    else if (id) raus.push({ event: id, seite: "eigen" });
  }
  return raus;
}

module.exports = { SHOTSFIRED_PORT, SHOTSFIRED_URL, SHOTSFIRED_STORE_URL, SF_EVENTS, shotsfiredEvents, sfZustand, zerlegen, scoreVon, eventName };
