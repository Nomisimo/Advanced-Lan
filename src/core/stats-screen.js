"use strict";
// Game-Stats-Screen: macht aus Statistik und Spielstand der Regie eine Anzeige für Publikum und Stream
// (Pop-out-Fenster oder NDI). Reine Funktionen, laufen im Hauptprozess, in der Oberfläche und in den Tests.

const PHASEN = { warmup: "Aufwärmen", live: "Live", intermission: "Halbzeit", gameover: "Match vorbei" };
const RUNDEN = { freezetime: "Freezetime", live: "Runde läuft", over: "Runde vorbei" };
const BOMBE = { planted: "Bombe gelegt", defused: "Bombe entschärft", exploded: "Bombe explodiert" };
const DOTA_PHASE = { HERO_SELECTION: "Heldenwahl", STRATEGY_TIME: "Strategiezeit", PRE_GAME: "Vorbereitung", GAME_IN_PROGRESS: "Live", POST_GAME: "Match vorbei" };

const uhr = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

// spiel: Eintrag aus SPIELE, statistik: regie.statistik.json(), stand: regie.stand
// → { leer, teams: [{ name, score, sieger }] | null, mitte: { gross, klein }, chips, zahlen: [[label, wert]], spalten: [[key, label]], top, vorbei }
function statsDaten(spiel, statistik, stand) {
  if (!spiel) return { leer: true, teams: null, mitte: null, chips: [], zahlen: [], spalten: [], top: [], vorbei: false };
  const st = statistik?.spiel === spiel.id ? statistik : null;
  const sd = stand?.spiel === spiel.id ? stand : null;
  const m = st?.match || { siege: {}, tore: {} }, r = st?.runde || {};
  const top = st?.top || [];
  const team = (name, score) => ({ name, score: n(score), sieger: !!m.sieger && m.sieger === name });
  const out = { leer: !st && !sd, teams: null, mitte: null, chips: [], zahlen: [], spalten: [], top, vorbei: !!m.vorbei };

  if (spiel.id === "cs2") {
    out.teams = [team("CT", sd?.ct ?? m.siege?.CT), team("T", sd?.tt ?? m.siege?.T)];
    out.mitte = { gross: `Runde ${r.nr ?? sd?.runde ?? "–"}`, klein: RUNDEN[sd?.rundenPhase || r.phase] || PHASEN[sd?.phase] || "" };
    if (sd?.map) out.chips.push(sd.map);
    if (sd?.phase && PHASEN[sd.phase] && sd.phase !== "live") out.chips.push(PHASEN[sd.phase]);
    if (BOMBE[sd?.bombe || r.bombe]) out.chips.push(BOMBE[sd?.bombe || r.bombe]);
    const hs = m.kills ? Math.round((m.headshots / m.kills) * 100) : 0;
    out.zahlen = [["Runden", n(m.runden)], ["Kills", n(m.kills)], ["HS-Quote", `${hs}%`], ["Multikills", n(m.multikills)], ["Aces", n(m.aces)]];
    out.spalten = [["kills", "K"], ["tode", "D"], ["headshots", "HS"], ["mvps", "MVP"]];
    return out;
  }

  if (spiel.id === "rl") {
    const ot = !!(sd?.overtime || m.overtime);
    out.teams = [team("BLUE", sd?.blau ?? m.tore?.BLUE), team("ORANGE", sd?.orange ?? m.tore?.ORANGE)];
    out.mitte = { gross: `${ot ? "+" : ""}${uhr(n(sd?.zeit))}`, klein: ot ? "Verlängerung" : "Spielzeit" };
    if (sd?.arena) out.chips.push(sd.arena);
    out.zahlen = [["Torschüsse", n(m.schuesse)], ["Paraden", n(m.paraden)], ["Demolitions", n(m.demos)], ["Anstöße", n(m.anstoesse)]];
    out.spalten = [["tore", "Tore"], ["vorlagen", "Vorl."], ["paraden", "Parad."], ["schuesse", "Schüsse"]];
    if (m.letztesTor?.spieler) out.chips.push(`Letztes Tor: ${m.letztesTor.spieler}${m.letztesTor.speed ? ` (${m.letztesTor.speed} km/h)` : ""}`);
    return out;
  }

  // League of Legends: Kills je Team aus den Kills der Spieler, Objekte des Matches
  if (spiel.id === "lol") {
    const kills = (t) => top.filter((p) => p.team === t).reduce((a, p) => a + n(p.kills), 0);
    out.teams = [team("BLUE", kills("BLUE")), team("RED", kills("RED"))];
    out.mitte = { gross: "Kills", klein: m.vorbei ? "Spiel vorbei" : "League of Legends" };
    out.zahlen = [["Kills", n(m.kills)], ["Türme", n(m.tuerme)], ["Drachen", n(m.drachen)], ["Barone", n(m.barone)], ["Inhibitoren", n(m.inhibitoren)], ["Multikills", n(m.multikills)]];
    out.spalten = [["kills", "K"], ["tode", "D"], ["assists", "A"]];
    return out;
  }
  // Fortnite: Battle Royale ohne Teamstand
  if (spiel.id === "fortnite") {
    out.mitte = { gross: m.vorbei ? (m.sieger ? "Victory Royale" : "Match vorbei") : "Live", klein: m.sieger ? m.sieger : "Fortnite" };
    out.zahlen = [["Eliminierungen", n(m.kills)], ["Niedergeschlagen", n(m.knockouts)], ["Ausgeschieden", n(m.tode)], ["Wiederbelebt", n(m.wiederbelebt)]];
    out.spalten = [["kills", "Elims"], ["tode", "Raus"], ["assists", "A"]];
    return out;
  }

  const dota = spiel.id === "dota2";
  const hat = (id) => (spiel.events || []).some((e) => e.id === id);
  const mitAssists = hat("assist");
  out.zahlen = [
    ["Kills", n(m.kills)], ["Tode", n(m.tode)],
    ...(mitAssists ? [["Assists", n(m.assists)]] : []),
    ...(hat("headshot") ? [["Headshots", n(m.headshots)]] : []),
    ...(dota ? [["Multikills", n(m.multikills)], ["Türme", n(m.tuerme)], ["Roshan", n(m.roshan)]] : []),
    ...(hat("ace") ? [["Aces", n(m.aces)], ["Spikes", n(m.bomben)]] : []),
    ...(!dota ? [["Runden", n(m.runden)]] : []),
  ];
  out.spalten = [["kills", "K"], ["tode", "D"], ...(mitAssists ? [["assists", "A"]] : [])];
  if (sd?.map && !dota) out.chips.push(sd.map);
  const [t1, t2] = spiel.teams || [];
  if (t1 && t2) out.teams = [team(t1, dota ? sd?.score?.[t1] : m.siege?.[t1]), team(t2, dota ? sd?.score?.[t2] : m.siege?.[t2])];
  if (BOMBE[r.bombe]) out.chips.push(BOMBE[r.bombe].replace("Bombe", "Spike"));
  if (dota) {
    out.mitte = { gross: uhr(Math.max(0, n(sd?.zeit))), klein: DOTA_PHASE[sd?.phase] || "Spielzeit" };
    if (sd?.phase === "GAME_IN_PROGRESS") out.chips.push(sd.tag ? "Tag" : "Nacht");
  } else out.mitte = { gross: r.nr ? `Runde ${r.nr}` : ":", klein: "Runden" };
  return out;
}

// Letzte Events für den Screen: nur echte (nicht verworfene) des aktiven Spiels, neueste zuerst.
// namen: regie.namen(), Spielername statt Name im Spiel oder PC-ID
function statsEvents(log, spiel, max = 8, namen = {}) {
  return (log || []).filter((e) => !e.verworfen && e.ev?.spiel === spiel).slice(0, max)
    .map((e) => (e.ev.player && namen[e.ev.player] ? { ...e, ev: { ...e.ev, player: namen[e.ev.player] } } : e));
}

// Spieler des aktiven Spiels für Spieler-Karten, Teams und Einzelwerte. Quellen, in dieser Reihenfolge:
// Statistik der Regie (aus den Events), was Shots Fired meldet (stand.sf: Zähler, Team, Seite) und der Status des Game-PCs.
// status: regie.snapshot() → [{ id, pcId, name, team, seite, kills, tode, headshots, assists, verbunden }], beste zuerst
function spielerDaten(status, spielId) {
  if (!spielId) return [];
  const namen = status?.namen || {};
  const st = status?.statistik?.spiel === spielId ? status.statistik : null;
  const alle = st?.alle || st?.top || [];
  const statVon = new Map();
  for (const p of alle) { statVon.set(p.id || p.name, p); statVon.set(p.name, p); }
  const out = [], gesehen = new Set();
  for (const pc of status?.pcs || []) {
    if (pc.spiel !== spielId || pc.sim) continue;
    const name = namen[pc.pcId] || pc.spieler || pc.pcId;
    const s = statVon.get(pc.pcId) || statVon.get(name);
    if (s) gesehen.add(s);
    const sf = pc.stand?.sf || {}, ps = pc.status || {};
    const z = (a, b, c) => (a != null ? n(a) : b != null ? n(b) : c != null ? n(c) : 0);
    out.push({
      id: pc.pcId, pcId: pc.pcId, name, team: sf.team || ps.team || s?.team || "", seite: sf.seite || "",
      kills: z(s?.kills, sf.kills, ps.kills), tode: z(s?.tode, sf.deaths, ps.deaths), headshots: z(s?.headshots, sf.headshots, null), assists: z(s?.assists, null, null),
      verbunden: pc.verbunden !== false,
    });
  }
  // Spieler ohne eigenen PC (z. B. CS2: ein PC meldet alle Spieler, Beispieldaten)
  for (const s of alle) if (!gesehen.has(s) && !out.some((o) => o.name === s.name)) out.push({ id: s.id || s.name, pcId: "", name: s.name, team: s.team || "", seite: "", kills: n(s.kills), tode: n(s.tode), headshots: n(s.headshots), assists: n(s.assists), verbunden: true });
  return out.sort((a, b) => b.kills - a.kills || a.tode - b.tode || a.name.localeCompare(b.name));
}

// Spieler nach Wahl eines Blocks: quelle "rang" (1 = bester) oder eine PC-ID / ein Name
function spielerWahl(liste, quelle, rang = 1) {
  if (quelle && quelle !== "rang") return liste.find((p) => p.pcId === quelle || p.id === quelle || p.name === quelle) || null;
  return liste[Math.max(0, (Number(rang) || 1) - 1)] || null;
}

// Beide Teams mit ihren Spielern. Valorant mit Shots Fired: Namen aus ui_team_order (Verbündete = Team des PCs, Gegner = das andere),
// sonst aus den Spielern nach Team. → [{ name, spieler: [{ name, kills, tode, headshots }] }]
function teamListen(status, spiel) {
  const liste = spielerDaten(status, spiel?.id);
  const [t1, t2] = spiel?.teams?.length >= 2 ? spiel.teams : ["TEAM A", "TEAM B"];
  const andere = (t) => (t === t1 ? t2 : t === t2 ? t1 : "");
  const zahlen = (name) => liste.find((p) => p.name === name || p.pcId === name) || { name, kills: null, tode: null, headshots: null };
  // Shots Fired: Listen der PCs zusammenführen
  const sf = { [t1]: [], [t2]: [] };
  let ohneTeam = null;
  for (const pc of status?.pcs || []) {
    const i = pc.spiel === spiel?.id && pc.stand?.sf;
    if (!i || (!i.verbuendete?.length && !i.gegner?.length)) continue;
    if (i.team && sf[i.team]) {
      for (const nm of i.verbuendete || []) if (!sf[i.team].includes(nm)) sf[i.team].push(nm);
      for (const nm of i.gegner || []) if (!sf[andere(i.team)].includes(nm)) sf[andere(i.team)].push(nm);
    } else if (!ohneTeam) ohneTeam = i;
  }
  if (sf[t1].length || sf[t2].length) return [{ name: t1, spieler: sf[t1].slice(0, 10).map(zahlen) }, { name: t2, spieler: sf[t2].slice(0, 10).map(zahlen) }];
  if (ohneTeam) return [{ name: "Verbündete", spieler: (ohneTeam.verbuendete || []).map(zahlen) }, { name: "Gegner", spieler: (ohneTeam.gegner || []).map(zahlen) }];
  // Ohne Shots-Fired-Listen: Spieler nach Team
  const teams = [t1, t2, ...new Set(liste.map((p) => p.team).filter((t) => t && t !== t1 && t !== t2))];
  const out = teams.map((t) => ({ name: t, spieler: liste.filter((p) => p.team === t) })).filter((t, i) => i < 2 || t.spieler.length);
  const rest = liste.filter((p) => !p.team);
  if (rest.length) out.push({ name: "Ohne Team", spieler: rest });
  return out;
}

// Einzelwerte für den Block „Wert“: [key, Bezeichnung, für einen Spieler?]
const WERTE = [
  ["score1", "Punkte links"], ["score2", "Punkte rechts"], ["team1", "Team links"], ["team2", "Team rechts"], ["runde", "Runde"],
  ["kills", "Kills (Match)"], ["tode", "Tode (Match)"], ["headshots", "Headshots (Match)"], ["aces", "Aces (Match)"],
  ["sp.name", "Name", true], ["sp.kills", "Kills", true], ["sp.tode", "Tode", true], ["sp.headshots", "Headshots", true], ["sp.kd", "K/D", true],
  ["sp.team", "Team", true], ["sp.seite", "Seite (Angriff/Verteidigung)", true],
];
const WERT = Object.fromEntries(WERTE.map(([k, l, sp]) => [k, { label: l, spieler: !!sp }]));
// Kurze Beschriftung unter dem Wert
const WERT_KURZ = { score1: "", score2: "", team1: "", team2: "", runde: "Runde", kills: "Kills", tode: "Tode", headshots: "Headshots", aces: "Aces", "sp.name": "", "sp.kills": "Kills", "sp.tode": "Tode", "sp.headshots": "Headshots", "sp.kd": "K/D", "sp.team": "Team", "sp.seite": "Seite" };

const kd = (p) => (p.tode ? (p.kills / p.tode).toFixed(2) : String(p.kills));
// Wert eines Blocks: d = statsDaten, statistik, sp = gewählter Spieler → Text ("–" ohne Wert)
function wertVon(key, { d, statistik, stand, sp }) {
  const m = statistik?.match || {};
  if (key.startsWith("sp.")) {
    if (!sp) return "–";
    const k = key.slice(3);
    if (k === "kd") return kd(sp);
    const v = sp[k];
    return v == null || v === "" ? "–" : String(v);
  }
  switch (key) {
    case "score1": return d?.teams?.[0] ? String(d.teams[0].score) : "–";
    case "score2": return d?.teams?.[1] ? String(d.teams[1].score) : "–";
    case "team1": return d?.teams?.[0]?.name || "–";
    case "team2": return d?.teams?.[1]?.name || "–";
    case "runde": { const r = statistik?.runde?.nr ?? stand?.runde; return r != null && r !== "" ? String(r) : "–"; }
    default: return m[key] != null ? String(n(m[key])) : "–";
  }
}

module.exports = { statsDaten, statsEvents, spielerDaten, spielerWahl, teamListen, WERTE, WERT, WERT_KURZ, wertVon, kd };
