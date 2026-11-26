"use strict";
// Overwolf-Events über die Overwolf-App „Shots Fired“ (Mike Holloway). Shots Fired gibt die Live-Events von Overwolf (GEP)
// unverändert an einen Webhook weiter. Diese App ist der Webhook: Auf dem Game-PC lauscht sie auf http://localhost:44207,
// je Spiel ein eigener Pfad (/valorant, /fortnite, /lol, /finals).
//
// Format laut Shots-Fired-Doku (github.com/ministerofpanic/shots-fired-support) und Beispielserver (artdevgame/kills-death-wins):
//   POST, JSON { gameId: <Overwolf-Spiel-ID>, event: "<feature>.<name>", data: <Daten von Overwolf> }
//   z. B. { gameId: 21216, event: "kill.kill", data: 3 } oder { gameId: 21216, event: "rank.rank", data: 1 }
// Info-Updates kommen genauso, mit dem Schlüssel als Namen (z. B. "match_info.score"). Weil das nicht genauer dokumentiert ist,
// liest zerlegen() auch andere übliche Formen, und der Empfänger schreibt jede Anfrage mit (Setup → „Letzte Anfragen“).
//
// Valorant (OW-Electron-Doku, supported-games/valorant):
// Manche Shots-Fired-Versionen bieten für Valorant nur Zähler und Infos an: kills, deaths, headshots, round_number, team,
// ui_team_order_allies / _enemies, map und game_mode. Die Zähler werden zu Kill (mit Ace), Tod und Headshot, eine neue
// round_number zum Rundenstart. team und ui_team_order zeigt das Setup an, aus team folgt notfalls das Team dieses PCs.
// - Events: match_start, match_end, kill, death, assist, headshot, spike_planted, spike_defused, spike_detonated
// - Info-Updates: round_phase (shopping, combat = Barriere fällt, end), agent und player_name (me), kill_feed (Waffe), score / match_score ({ won, lost } aus Sicht dieses Spielers)
// Rundenstart, Rundenende, Rundengewinner und Matchgewinner gibt es für Valorant nicht als Event (anders als bei R6 oder OW2):
// Rundenstart = round_phase wechselt auf „shopping“, Rundenende mit Sieger = score steigt. Ohne score zählt round_phase „end“
// als Rundenende ohne Sieger. Kommen trotzdem round_start oder round_end als Event, werden sie übernommen.
// match_end kommt laut Doku nicht bei Custom Matches, deshalb zählt auch der Stand (13 Runden mit 2 Vorsprung).
// Riot-Regel: kein Spike-Timer. Gelegt, entschärft und explodiert sind einzelne Cues.
//
// Fortnite: kill (Eliminierung), knockout (Gegner niedergeschlagen), assist, death, knockedout (selbst niedergeschlagen), revived,
// matchStart, matchEnd, dazu die Info-Updates phase (aircraft = Battle Bus, landed) und rank (Platzierung, 1 = Victory Royale).
// The Finals: match_start, match_end, elimination (eigener Kill), death.
// League of Legends: kill, death, assist, matchStart, matchEnd und die Multikills der Ansage. Besser und vollständiger kommt LoL
// über Riots Live Client Data API (lol.js), die hat Vorrang.
// Reine Funktionen ohne Node-Abhängigkeiten: laufen im Hauptprozess, in der Oberfläche und in den Tests.

const SHOTSFIRED_PORT = 44207;
const SHOTSFIRED_STORE_URL = "https://www.overwolf.com/app/mike_holloway-shots_fired";
const SHOTSFIRED_BASIS = `http://localhost:${SHOTSFIRED_PORT}`;
const SF_SPIELE = ["valorant", "fortnite", "lol", "finals"];
const sfUrl = (spiel) => `${SHOTSFIRED_BASIS}/${spiel}`;
const SHOTSFIRED_URL = sfUrl("valorant");
// Overwolf-Spiel-IDs (gameId in der Anfrage), falls der Pfad fehlt. The Finals nur über den Pfad.
const SF_GAME_IDS = { 21640: "valorant", 21216: "fortnite", 5426: "lol" };
const PFAD_ALIAS = { valorant: "valorant", val: "valorant", fortnite: "fortnite", fn: "fortnite", lol: "lol", league: "lol", leagueoflegends: "lol", finals: "finals", thefinals: "finals", the_finals: "finals" };

// GEP-Event → Event der Valorant-Quelle (bild-spiele.js)
const SF_EVENTS = {
  match_start: "match_start", match_end: "match_end", kill: "kill", death: "death", assist: "assist", headshot: "headshot",
  spike_planted: "spike_planted", spike_defused: "spike_defused", spike_detonated: "spike_detonated", spike_exploded: "spike_detonated",
  round_start: "round_start", round_end: "round_end",
};
const SCORE_KEYS = ["score", "match_score"];
// Valorant: Events und Info-Updates, die gelesen werden (kill_feed kommt je nach Version als Event oder Info-Update)
// Shots Fired bietet je nach Version statt der Events nur Zähler an: kills, deaths, headshots (Summe im Match) und round_number.
// Zähler → Event, das bei jedem Schritt nach oben entsteht
const ZAEHLER = { kills: "kill", deaths: "death", headshots: "headshot" };
const ZAEHLER_KEYS = Object.keys(ZAEHLER);
// Dazu Infos ohne eigenen Cue: team (Seite: Angriff oder Verteidigung) und ui_team_order_allies / _enemies (Spieler beider Teams)
const TEAM_KEYS = ["team", "ui_team_order_allies", "ui_team_order_enemies"];
// Match-ID aus GEP match_info: gleiche ID = gleiches Match, damit die Regie die PCs nach Match trennt (ohne Riot Client)
const MATCH_KEYS = ["match_id", "pseudo_match_id"];
// Eigener Agent und Spielername (GEP „me“): Agent für den Stats-Screen, Name, um die eigenen Kills im kill_feed zu erkennen
const ME_KEYS = ["agent", "player_name"];
const VAL = { events: SF_EVENTS, infos: [...SCORE_KEYS, "round_phase", "kill_feed", ...ZAEHLER_KEYS, "round_number", ...TEAM_KEYS, ...MATCH_KEYS, ...ME_KEYS] };
// Interne Agent-Namen von Overwolf (OW-Electron-Doku, supported-games/valorant, agent) → Name im Spiel
const AGENTEN = {
  clay: "Raze", pandemic: "Viper", wraith: "Omen", hunter: "Sova", thorne: "Sage", phoenix: "Phoenix", wushu: "Jett", gumshoe: "Cypher",
  sarge: "Brimstone", breach: "Breach", vampire: "Reyna", killjoy: "Killjoy", guide: "Skye", stealth: "Yoru", rift: "Astra", grenadier: "KAY/O",
  deadeye: "Chamber", sprinter: "Neon", bountyhunter: "Fade", mage: "Harbor", aggrobot: "Gekko", cable: "Deadlock", sequoia: "Iso", smonk: "Clove",
  nox: "Vyse", cashew: "Tejo", terra: "Waylay",
};
// "Clay_PC_C" → "Raze". Unbekannte IDs ohne „_PC_C“, damit neue Agenten wenigstens lesbar erscheinen. Drohnen u. Ä. (anderer Blickwinkel) ändern die ID nicht.
function agentVon(v) {
  let x = json(v);
  if (x && typeof x === "object") x = x.agent ?? x.value;
  const roh = String(x ?? "").trim();
  if (!roh || roh === "null") return "";
  const id = roh.replace(/_PC_C$/i, "").replace(/_C$/i, "");
  return AGENTEN[id.toLowerCase()] || (/_PC_C$/i.test(roh) ? id : roh);
}
// Waffen und Fähigkeiten im kill_feed (OW-Electron-Doku, kill_feed) → Name im Spiel
const WAFFEN = {
  tx_hud_pistol_glock_s: "Classic", tx_hud_pistol_sawedoff_s: "Shorty", tx_hud_autopistol: "Frenzy", tx_hud_pistol_luger_s: "Ghost", tx_hud_pistol_revolver_s: "Sheriff",
  tx_hud_pump: "Bucky", tx_hud_shotguns_spas12_s: "Judge", tx_hud_vector: "Stinger", tx_hud_smg_mp5_s: "Spectre",
  tx_hud_burst: "Bulldog", tx_hud_dmr: "Guardian", tx_hud_assault_ar10a2_s: "Phantom", tx_hud_volcano: "Vandal",
  tx_hud_sniper_boltaction_s: "Marshal", tx_hud_operator: "Operator", tx_hud_doublesniper: "Outlaw", tx_hud_lmg: "Ares", tx_hud_hmg: "Odin",
  tx_hud_knife_standard_s: "Messer", tx_breach_fusionblast: "Aftershock", tx_sarge_molotovlauncher: "Incendiary", tx_sarge_orbitalstrike: "Orbital Strike",
  tx_pheonix_firewall: "Blaze", tx_pheonix_molotov: "Hot Hands", tx_hunter_shockarrow: "Shock Bolt", tx_hunter_bowblast: "Hunter's Fury",
  tx_hud_deadeye_q_pistol: "Headhunter", tx_hud_deadeye_x_giantslayer: "Tour de Force", tx_cable_fishinghook: "Annihilation", tx_hud_wushu_x_dagger: "Blade Storm",
  tx_neon_ult: "Overdrive", tx_gumshoe_tripwire: "Trapwire", tx_gren_icon: "Fragment", tx_aggrobot_bubbles: "Mosh Pit", tx_kj_bees: "Nanoswarm", tx_kj_turret: "Turret",
  tx_clay_boomba: "Boom Bot", tx_clay_clusterbomb: "Paint Shells", tx_clay_rocketlauncher: "Showstopper", tx_guide4: "Trailblazer", tx_pandemic_acidlauncher: "Snake Bite",
  tx_ui_cashew_e: "Guided Salvo", tx_ui_cashew_x: "Armageddon",
};
// "TX_Hud_Volcano" → "Vandal". Unbekannt: ohne „TX_Hud_“ und mit Leerzeichen, z. B. „Spike“ oder „Fall“.
function waffeVon(v) {
  const roh = String(v ?? "").trim();
  if (!roh || roh === "null") return "";
  return WAFFEN[roh.toLowerCase()] || roh.replace(/^tx_(hud_|ui_)?/i, "").replace(/_s$/i, "").replace(/_/g, " ").trim();
}
const gleicherName = (a, b) => !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const SIEG_RUNDEN = 13;

const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/[\s\-.]+/g, "_");
const json = (v) => { if (typeof v !== "string") return v; const t = v.trim(); if (!/^[{[]/.test(t)) return v; try { return JSON.parse(t); } catch { return v; } };

// Name eines Events → Event-ID oder null. Nimmt auch „Spike Planted“, „match_info.spike_planted“ oder „kill.kill“.
function eventName(name, map = SF_EVENTS) {
  const n = norm(name);
  if (!n) return null;
  if (map[n]) return map[n];
  const teil = Object.keys(map).filter((k) => n.endsWith(`_${k}`) || n.endsWith(`:${k}`)).sort((a, b) => b.length - a.length)[0];
  return teil ? map[teil] : null;
}
// Letzter Teil eines Namens: „match_info.score“ → „score“
const schluessel = (name) => norm(String(name ?? "").split(".").pop());

// Spielstand { won, lost } aus einem Wert (Objekt oder JSON-Text)
function scoreVon(v) {
  const s = json(v);
  if (!s || typeof s !== "object") return null;
  const won = Number(s.won ?? s.win ?? s.wins), lost = Number(s.lost ?? s.loss ?? s.losses);
  return Number.isFinite(won) && Number.isFinite(lost) ? { won, lost } : null;
}

// Eine Anfrage (Text oder Objekt) → { events: [{ name, data }], infos: [{ key, value }] }
// spiel: { events: Name → Event-ID, infos: [Schlüssel] } des Spiels, Standard Valorant
function zerlegen(body, spiel = VAL) {
  const out = { events: [], infos: [] };
  const map = spiel.events, INFO_KEYS = spiel.infos;
  const eventName_ = (n) => eventName(n, map);
  const besuche = (x, tiefe = 0) => {
    x = json(x);
    if (tiefe > 5 || x == null) return;
    if (typeof x === "string") { if (eventName_(x)) out.events.push({ name: x, data: null }); return; }
    if (Array.isArray(x)) { x.forEach((y) => besuche(y, tiefe + 1)); return; }
    if (typeof x !== "object") return;
    // GEP-Events: { events: [{ name, data }] } oder ein einzelnes { name, data }
    if (Array.isArray(x.events)) x.events.forEach((y) => besuche(y, tiefe + 1));
    const name = x.event ?? x.name ?? x.eventName ?? x.event_name ?? x.type ?? x.key ?? x.id;
    if (typeof name === "string") {
      if (INFO_KEYS.includes(schluessel(name))) out.infos.push({ key: schluessel(name), value: x.value ?? x.data ?? x.val });
      else if (eventName_(name)) out.events.push({ name, data: x.data ?? x.value ?? null });
      else if (typeof x.value === "string" && eventName_(x.value)) out.events.push({ name: x.value, data: null });
    }
    // GEP-Info-Updates: { info: { match_info: { score: "{…}" } } } oder { feature, key, value }
    const info = json(x.info);
    if (info && typeof info === "object") for (const gruppe of Object.values(info)) {
      const g = json(gruppe);
      if (g && typeof g === "object") for (const [k, v] of Object.entries(g)) if (INFO_KEYS.includes(k)) out.infos.push({ key: k, value: v });
    }
    for (const k of INFO_KEYS) if (x[k] != null && k !== name) out.infos.push({ key: k, value: x[k] });
    // Verschachtelt ({ event: { name } }, { payload: … }), aber nicht die Daten eines schon erkannten Events
    const erkannt = typeof name === "string" && (INFO_KEYS.includes(schluessel(name)) || eventName_(name));
    for (const k of ["event", "data", "payload", "body", "message"]) if (x[k] != null && !(erkannt && k === "data") && typeof json(x[k]) === "object") besuche(x[k], tiefe + 1);
  };
  besuche(body);
  return out;
}

// Ace, Clutch und Thrifty gibt es bei Overwolf nicht als Event:
// - Ace: dieser Spieler hat in einer Runde 5 Kills (gezählt aus kill)
// - Clutch: das eigene Team gewinnt die Runde, dieser Spieler lebt noch und alle 4 Mitspieler sind tot (aus kill_feed und death)
// - Thrifty: Sieg trotz deutlich billigerer Ausrüstung. Overwolf liefert dafür keine Werte des Gegners: nur über die Bilderkennung.
const ACE_KILLS = 5;
const MITSPIELER = 4;
const neueRunde = () => ({ kills: 0, tot: false, mitspielerTot: 0, ace: false });

// Zustand je Game-PC: letzter Spielstand, ob das Match schon entschieden ist, und die laufende Runde
// Zähler: letzter Stand von kills, deaths und round_number. Kommen echte kill- oder death-Events, gelten die (keine Doppelten).
// Sind beide in Shots Fired angelegt (kill und kills), kann der Zähler vor dem ersten echten Event ankommen. Dann hat er den
// Cue schon ausgelöst, und das echte Event kurz danach (ZAEHLER_FENSTER) wird geschluckt.
const ZAEHLER_FENSTER = 3000;
const neueZaehler = () => ({ kills: null, deaths: null, headshots: null, runde: null });
const neueEcht = () => ({ kill: false, death: false, headshot: false });
// info: Seite und Spieler aus team und ui_team_order (nur zur Anzeige und für das Team dieses PCs)
// agent und name bleiben bei match_start (kommen schon in der Agentenwahl), waffe: Waffe des letzten eigenen Kills (aus kill_feed)
const neueInfo = (match = "", pseudo = "", agent = "", name = "") => ({ seite: "", verbuendete: [], gegner: [], match, pseudo, agent, name, waffe: "", letzterKill: null });
const sfZustand = () => ({ score: null, entschieden: false, phase: "", r: neueRunde(), z: neueZaehler(), echt: neueEcht(), info: neueInfo() });

// team → "Angriff", "Verteidigung" oder "" (Overwolf schreibt attack/attacker/defense/defender, sicherheitshalber auch Deutsch)
function seiteVon(v) {
  let x = json(v);
  if (x && typeof x === "object") x = x.team ?? x.side ?? x.value;
  const t = norm(x);
  if (/^(att|angr)/.test(t)) return "Angriff";
  if (/^(def|vert)/.test(t)) return "Verteidigung";
  return "";
}
// ui_team_order_* → Liste von Namen. Nimmt Arrays (Texte oder Objekte), Objekte mit Liste, JSON-Text und kommagetrennten Text.
const NAME_FELDER = ["name", "player_name", "playerName", "player", "nickname", "agent", "character", "id"];
function spielerVon(v) {
  let x = json(v);
  if (typeof x === "string") x = x.split(/[,;|]/);
  if (x && typeof x === "object" && !Array.isArray(x)) x = Object.values(x).find(Array.isArray) || Object.values(x);
  if (!Array.isArray(x)) return [];
  return x.map((p) => {
    p = json(p);
    if (p && typeof p === "object") { const f = NAME_FELDER.find((k) => typeof p[k] === "string" || typeof p[k] === "number"); return f ? String(p[f]) : ""; }
    return p == null ? "" : String(p);
  }).map((n) => n.trim()).filter(Boolean).slice(0, 10);
}
// Team dieses PCs aus der Seite: Rot (TEAM A) beginnt im Angriff, nach Runde 12 wechseln die Seiten (wie riot-team.js).
// In der Verlängerung (ab Runde 25) wechseln die Seiten jede Runde, das ist zu unsicher: dann "".
function teamAusSeite(seite, runde) {
  if (!seite || !Number.isFinite(runde) || runde < 1 || runde > 24) return "";
  const angriffIstA = runde <= 12;
  return (seite === "Angriff") === angriffIstA ? "TEAM A" : "TEAM B";
}
// Was Shots Fired über die Teams weiß: { seite, team, verbuendete, gegner }
function sfInfo(z) {
  const i = z?.info || neueInfo();
  return { seite: i.seite, team: teamAusSeite(i.seite, z?.z?.runde), verbuendete: [...i.verbuendete], gegner: [...i.gegner], match: i.match || i.pseudo || "", agent: i.agent || "", waffe: i.waffe || "", letzterKill: i.letzterKill ? { ...i.letzterKill } : null };
}
// Zahl aus einem Wert: 3, "3", { kills: 3 } oder JSON-Text
function zahlVon(v, key) {
  let x = json(v);
  if (x && typeof x === "object") x = x[key] ?? x.value ?? x.count;
  const n = Number(x);
  return x !== "" && x != null && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}
// Höchstens so viele Kills oder Tode aus einem Sprung des Zählers (ein Ausreißer löst keine Flut von Cues aus)
const MAX_SPRUNG = 5;
const wahr = (v) => v === true || v === "true" || v === 1 || v === "1";

// Anfrage → Nachrichten für die Valorant-Quelle: [{ event, seite }]. seite: eigen = Team dieses PCs, gegner = das andere, keins = ohne Team.
// jetzt: Zeit in ms (für Tests), sonst Date.now()
function shotsfiredEvents(body, z = sfZustand(), jetzt = Date.now()) {
  const { events, infos } = zerlegen(body, VAL);
  const raus = [];
  const matchSieg = (seite) => { if (!z.entschieden) { z.entschieden = true; raus.push({ event: "match_won", seite }); } };
  z.r = z.r || neueRunde();
  z.z = z.z || neueZaehler();
  z.echt = z.echt || neueEcht();
  z.info = z.info || neueInfo();
  const kill = () => {
    raus.push({ event: "kill", seite: "eigen" });
    if (++z.r.kills >= ACE_KILLS && !z.r.ace) { z.r.ace = true; raus.push({ event: "ace", seite: "eigen" }); }
  };
  const tod = () => { z.r.tot = true; raus.push({ event: "death", seite: "eigen" }); };
  // Echte Events zuerst merken: dann zählen die Zähler nur noch mit und lösen nichts aus
  z.zaehlerZeit = z.zaehlerZeit || {};
  // Erstes echtes Event je Art: hat der Zähler gerade eben denselben Cue ausgelöst, wird es einmal geschluckt
  const schlucken = {};
  // Liefert das Event eine Zahl (Overwolf: Stand im Match), entscheidet die: gleich dem Zähler = derselbe Kill.
  const ZAEHLER_VON = { kill: "kills", death: "deaths", headshot: "headshots" };
  for (const { name: n, data } of events) {
    const id = eventName(n);
    if (!(id in z.echt)) continue;
    const nr = zahlVon(data, ZAEHLER_VON[id]), stand = z.z?.[ZAEHLER_VON[id]];
    const gleich = nr != null && stand != null ? nr <= stand : jetzt - (z.zaehlerZeit[id] ?? -Infinity) < ZAEHLER_FENSTER;
    if (!z.echt[id] && z.zaehlerZeit[id] != null && gleich) schlucken[id] = 1;
    z.echt[id] = true;
  }
  const rundeStart = () => { z.r = neueRunde(); raus.push({ event: "round_start", seite: "eigen" }); };
  // Rundenende: bei Sieg des eigenen Teams Clutch prüfen, danach zählt die nächste Runde neu
  const rundeEnde = (seite) => {
    raus.push({ event: "round_end", seite });
    if (seite === "eigen" && !z.r.tot && z.r.mitspielerTot >= MITSPIELER) raus.push({ event: "clutch", seite: "eigen" });
    z.r = neueRunde();
  };
  for (const { key, value } of infos) {
    if (ZAEHLER_KEYS.includes(key)) {
      const n = zahlVon(value, key);
      if (n == null) continue;
      const alt = z.z[key];
      z.z[key] = n;
      const ev = ZAEHLER[key];
      // Erster Wert: ab 0 oder 1 zählt er (Match läuft gerade an), ein höherer Stand ist nur der Ausgangswert (App mitten im Match gestartet)
      const neu = alt == null ? (n <= 1 ? n : 0) : n > alt ? n - alt : 0;
      if (!z.echt[ev] && neu > 0) {
        z.zaehlerZeit[ev] = jetzt;
        for (let i = 0; i < Math.min(neu, MAX_SPRUNG); i++) ev === "kill" ? kill() : ev === "death" ? tod() : raus.push({ event: ev, seite: "eigen" });
      }
      continue;
    }
    if (key === "agent") { const a = agentVon(value); if (a) z.info.agent = a; continue; }
    if (key === "player_name") { const v = json(value), nm = String((v && typeof v === "object" ? v.player_name : v) ?? "").trim(); if (nm && nm !== "null") z.info.name = nm.slice(0, 60); continue; }
    if (key === "team") { const s = seiteVon(value); if (s) z.info.seite = s; continue; }
    if (MATCH_KEYS.includes(key)) {
      const v = json(value), id = String((v && typeof v === "object" ? v[key] : v) ?? "").trim().slice(0, 100);
      if (id && id !== "null") z.info[key === "match_id" ? "match" : "pseudo"] = id;
      continue;
    }
    if (key === "ui_team_order_allies" || key === "ui_team_order_enemies") {
      const liste = spielerVon(value);
      if (liste.length) z.info[key.endsWith("allies") ? "verbuendete" : "gegner"] = liste;
      continue;
    }
    if (key === "round_number") {
      const n = zahlVon(value, key);
      if (n == null || n === z.z.runde) continue;
      z.z.runde = n;
      // Neue Rundennummer = Rundenstart. Hat die Kaufphase (round_phase) diese Runde schon gestartet, nicht doppelt.
      if (z.r.perPhase && !z.r.perNummer) z.r.perNummer = true;
      else { rundeStart(); z.r.perNummer = true; }
      continue;
    }
    if (key === "round_phase") {
      const p = norm(json(value)?.round_phase ?? value);
      if (p === "shopping" && z.phase !== "shopping") {
        // Hat round_number diese Runde schon gestartet, nur merken
        if (z.r.perNummer && !z.r.perPhase) z.r.perPhase = true;
        else { rundeStart(); z.r.perPhase = true; }
      }
      // Barriere fällt: Kampf beginnt (einmal je Runde, nur nach der Kaufphase)
      if (p === "combat" && z.phase === "shopping") raus.push({ event: "round_combat", seite: "eigen" });
      // Ohne Spielstand: Rundenende ohne Sieger. Mit Spielstand kommt das Rundenende mit Sieger, wenn score steigt.
      if (p === "end" && z.phase !== "end" && !z.score) rundeEnde("keins");
      z.phase = p;
      continue;
    }
    if (key === "kill_feed") {
      const k = json(value);
      if (!k || typeof k !== "object") continue;
      if (wahr(k.is_victim_teammate)) z.r.mitspielerTot++;
      // Waffe für den Stats-Screen: letzter Kill im Feed, und der letzte eigene (Angreifer = eigener Name, bei versteckten Namen „Me“).
      // Nicht über den Agent: der Gegner kann denselben spielen.
      const waffe = waffeVon(k.weapon);
      if (waffe || k.attacker) z.info.letzterKill = { angreifer: String(k.attacker ?? "").slice(0, 60), opfer: String(k.victim ?? "").slice(0, 60), waffe, headshot: wahr(k.headshot) };
      if (waffe && (gleicherName(k.attacker, z.info.name) || gleicherName(k.attacker, "me"))) z.info.waffe = waffe;
      continue;
    }
    const s = scoreVon(value);
    if (!s) continue;
    const alt = z.score;
    // Neues Match: Stand fällt zurück (oder erster Stand 0:0)
    if (!alt || s.won < alt.won || s.lost < alt.lost) { z.score = s; z.entschieden = false; if (!alt || s.won + s.lost === 0) continue; }
    else z.score = s;
    if (alt && s.won > alt.won) rundeEnde("eigen");
    if (alt && s.lost > alt.lost) rundeEnde("gegner");
    if (s.won >= SIEG_RUNDEN && s.won - s.lost >= 2) matchSieg("eigen");
    else if (s.lost >= SIEG_RUNDEN && s.lost - s.won >= 2) matchSieg("gegner");
  }
  for (const { name: n } of events) {
    const id = eventName(n);
    if (schlucken[id]) { schlucken[id]--; continue; }
    if (id === "match_start") { z.score = null; z.entschieden = false; z.phase = ""; z.r = neueRunde(); z.z = neueZaehler(); z.info = neueInfo(z.info?.match, z.info?.pseudo, z.info?.agent, z.info?.name); raus.push({ event: id, seite: "eigen" }); }
    else if (id === "kill") kill();
    else if (id === "death") tod();
    else if (id === "match_end") {
      // Mit bekanntem Stand den Sieger mitliefern, sonst nur „Match vorbei“
      const s = z.score;
      if (s && s.won !== s.lost) matchSieg(s.won > s.lost ? "eigen" : "gegner");
      else raus.push({ event: id, seite: "eigen" });
    } else if (id === "round_end") { if (!z.score) rundeEnde("keins"); } // mit Spielstand kommt das Ende mit Sieger aus score
    else if (id === "round_start") { if (z.phase !== "shopping") rundeStart(); z.phase = "shopping"; }
    else if (id) raus.push({ event: id, seite: "eigen" });
  }
  return raus;
}

/* ── Fortnite ─────────────────────────────────────────────────────────── */
const FN = {
  events: { kill: "kill", knockout: "knockout", assist: "assist", death: "death", knockedout: "knocked", revived: "revived",
    matchstart: "match_start", match_start: "match_start", matchend: "match_end", match_end: "match_end" },
  infos: ["rank", "phase"],
};
const fnZustand = () => ({ laeuft: false, platz: null, bus: false, landed: false, top10: false, top5: false, sieg: false });
function fortniteEvents(body, z = fnZustand()) {
  const { events, infos } = zerlegen(body, FN);
  const raus = [], eig = (event) => raus.push({ event, seite: "eigen" });
  const start = () => { Object.assign(z, fnZustand(), { laeuft: true }); eig("match_start"); };
  for (const { key, value } of infos) {
    const v = json(value);
    if (key === "phase") {
      const p = norm(v?.phase ?? v);
      if ((p === "aircraft" || p === "airfield") && !z.laeuft) start();
      if (p === "aircraft" && !z.bus) { z.bus = true; eig("bus"); }
      if (p === "landed" && !z.landed) { z.landed = true; eig("landed"); }
    } else if (key === "rank") {
      const platz = Number(v?.rank ?? v);
      if (!Number.isFinite(platz) || platz < 1) continue;
      z.platz = platz;
      if (platz <= 10 && !z.top10) { z.top10 = true; eig("top10"); }
      if (platz <= 5 && !z.top5) { z.top5 = true; eig("top5"); }
      if (platz === 1 && !z.sieg) { z.sieg = true; eig("match_won"); }
    }
  }
  for (const { name } of events) {
    const id = eventName(name, FN.events);
    if (id === "match_start") start();
    else if (id === "match_end") { if (!z.sieg) eig("match_end"); z.laeuft = false; }
    else if (id) eig(id);
  }
  return raus;
}

/* ── The Finals ───────────────────────────────────────────────────────── */
const FIN = { events: { match_start: "match_start", match_end: "match_end", elimination: "kill", kill: "kill", death: "death", revived: "revived" }, infos: [] };
const finalsEvents = (body) => zerlegen(body, FIN).events.map(({ name }) => ({ event: eventName(name, FIN.events), seite: "eigen" })).filter((n) => n.event);

/* ── League of Legends (nur, wenn die Live Client Data API nicht läuft) ──── */
const LOL = {
  events: { kill: "kill", death: "death", assist: "assist", matchstart: "match_start", match_start: "match_start", matchend: "match_end", match_end: "match_end",
    double_kill: "double_kill", triple_kill: "triple_kill", quadra_kill: "quadra_kill", penta_kill: "penta_kill" },
  infos: [],
};
const lolEvents = (body) => zerlegen(body, LOL).events.map(({ name }) => ({ event: eventName(name, LOL.events), seite: "eigen" })).filter((n) => n.event);

/* ── Einrichtung (Setup und Anleitung) ─────────────────────────────────── */
// Je Spiel: Events und Info-Updates, die man in Shots Fired als Webhook-Aktion anlegt, und was daraus wird
const SF_EINRICHTEN = {
  valorant: [["spike_planted, spike_defused, spike_detonated", "Spike gelegt, entschärft, explodiert"], ["match_start, match_end", "Match startet, Match vorbei"],
    ["kill, death, assist, headshot", "Kill, Tod, Assist, Headshot, dazu Ace (5 Kills in einer Runde)"], ["kill_feed", "für Clutch (letzter Überlebender gewinnt)"],
    ["kills, deaths, headshots, round_number", "wenn Shots Fired nur diese anbietet: Kill und Ace, Tod, Headshot, Rundenstart"],
    ["team, ui_team_order_allies, ui_team_order_enemies", "Seite und Spieler beider Teams; Team dieses PCs, wenn der Riot Client keins liefert"],
    ["round_phase", "Rundenstart (Kaufphase), Kampf beginnt (Barriere fällt) und Rundenende"],
    ["agent, player_name", "eigener Agent für den Stats-Screen; mit kill_feed die Waffe des letzten eigenen Kills"], ["score", "Rundengewinner und Matchgewinner (13 Runden, 2 Vorsprung)"]],
  fortnite: [["matchStart, matchEnd", "Match startet, Match vorbei"], ["kill, knockout, assist", "Eliminierung, Gegner niedergeschlagen, Assist"],
    ["death, knockedout, revived", "Ausgeschieden, selbst niedergeschlagen, wiederbelebt"], ["phase", "Battle Bus startet, gelandet"], ["rank", "Top 10, Top 5, Victory Royale (Platz 1)"]],
  lol: [["kill, death, assist", "Kill, Tod, Assist"], ["matchStart, matchEnd", "Spiel startet, Spiel vorbei"], ["Multikills der Ansage", "Double bis Pentakill"]],
  finals: [["match_start, match_end", "Match startet, Match vorbei"], ["elimination, death", "Kill, Spieler stirbt"]],
};

/* ── Verteilen ────────────────────────────────────────────────────────── */
// Spiel einer Anfrage: Pfad (/fortnite) vor gameId
function sfSpiel(pfad, body) {
  const seg = norm(String(pfad || "").split("?")[0].split("/").filter(Boolean)[0] || "").replace(/_/g, "");
  if (PFAD_ALIAS[seg] || PFAD_ALIAS[norm(seg)]) return PFAD_ALIAS[seg] || PFAD_ALIAS[norm(seg)];
  const b = json(body);
  const id = b && typeof b === "object" ? Number(b.gameId ?? b.game_id ?? b.gameID) : NaN;
  // Overwolf hängt manchmal eine Klassen-ID an (z. B. 216401 statt 21640): auf die bekannten IDs kürzen
  const passend = Object.keys(SF_GAME_IDS).find((k) => id === Number(k) || Math.floor(id / 10) === Number(k));
  return passend ? SF_GAME_IDS[passend] : null;
}
const sfZustaende = () => ({ valorant: sfZustand(), fortnite: fnZustand() });
// Anfrage → { spiel, nachrichten: [{ event, seite }] }. spiel null: unbekanntes Spiel, nur mitschreiben.
function shotsfiredNachrichten(body, pfad = "/", z = sfZustaende()) {
  const spiel = sfSpiel(pfad, body);
  if (spiel === "valorant") return { spiel, nachrichten: shotsfiredEvents(body, (z.valorant ||= sfZustand())) };
  if (spiel === "fortnite") return { spiel, nachrichten: fortniteEvents(body, (z.fortnite ||= fnZustand())) };
  if (spiel === "finals") return { spiel, nachrichten: finalsEvents(body) };
  if (spiel === "lol") return { spiel, nachrichten: lolEvents(body) };
  return { spiel: null, nachrichten: [] };
}

module.exports = { SF_EINRICHTEN, ACE_KILLS, SHOTSFIRED_PORT, SHOTSFIRED_URL, SHOTSFIRED_BASIS, SHOTSFIRED_STORE_URL, SF_SPIELE, SF_GAME_IDS, sfUrl, SF_EVENTS,
  shotsfiredEvents, fortniteEvents, finalsEvents, lolEvents, shotsfiredNachrichten, sfSpiel, sfZustand, fnZustand, sfZustaende, zerlegen, scoreVon, eventName,
  sfInfo, seiteVon, spielerVon, teamAusSeite, agentVon, waffeVon };
