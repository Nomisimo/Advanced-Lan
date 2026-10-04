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
// → { leer, teams: [{ name, score, sieger }] | null, br, mitte: { gross, klein }, chips, zahlen: [[label, wert]], spalten: [[key, label]], top, vorbei }
function statsDaten(spiel, statistik, stand) {
  if (!spiel) return { leer: true, teams: null, br: null, mitte: null, chips: [], zahlen: [], spalten: [], top: [], vorbei: false };
  const st = statistik?.spiel === spiel.id ? statistik : null;
  const sd = stand?.spiel === spiel.id ? stand : null;
  const m = st?.match || { siege: {}, tore: {} }, r = st?.runde || {};
  const top = st?.top || [];
  const team = (name, score) => ({ name, score: n(score), sieger: !!m.sieger && m.sieger === name });
  const out = { leer: !st && !sd, teams: null, br: null, mitte: null, chips: [], zahlen: [], spalten: [], top, vorbei: !!m.vorbei };

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

  const dota = spiel.id === "dota2", br = spiel.art === "br";
  const hat = (id) => (spiel.events || []).some((e) => e.id === id);
  const mitAssists = hat("assist");
  out.zahlen = [
    ["Kills", n(m.kills)], ["Tode", n(m.tode)],
    ...(mitAssists ? [["Assists", n(m.assists)]] : []),
    ...(hat("headshot") ? [["Headshots", n(m.headshots)]] : []),
    ...(br && (spiel.events || []).some((e) => /knock/.test(e.id)) ? [["Niedergeschlagen", n(m.knocks)]] : []),
    ...(dota ? [["Multikills", n(m.multikills)], ["Türme", n(m.tuerme)], ["Roshan", n(m.roshan)]] : []),
    ...(!dota && !br ? [["Runden", n(m.runden)]] : []),
  ];
  out.spalten = [["kills", "K"], ["tode", "D"], ...(mitAssists ? [["assists", "A"]] : [])];
  if (sd?.map && !dota) out.chips.push(sd.map);
  if (br) {
    out.br = { uebrig: sd?.uebrig ?? null, sieger: m.siegerSpieler || "" };
    return out;
  }
  const [t1, t2] = spiel.teams || [];
  if (t1 && t2) out.teams = [team(t1, dota ? sd?.score?.[t1] : m.siege?.[t1]), team(t2, dota ? sd?.score?.[t2] : m.siege?.[t2])];
  if (dota) {
    out.mitte = { gross: uhr(Math.max(0, n(sd?.zeit))), klein: DOTA_PHASE[sd?.phase] || "Spielzeit" };
    if (sd?.phase === "GAME_IN_PROGRESS") out.chips.push(sd.tag ? "Tag" : "Nacht");
  } else out.mitte = { gross: r.nr ? `Runde ${r.nr}` : ":", klein: "Runden" };
  return out;
}

// Letzte Events für den Screen: nur echte (nicht verworfene) des aktiven Spiels, neueste zuerst
function statsEvents(log, spiel, max = 8) {
  return (log || []).filter((e) => !e.verworfen && e.ev?.spiel === spiel).slice(0, max);
}

module.exports = { statsDaten, statsEvents };
