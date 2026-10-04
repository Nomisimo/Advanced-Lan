"use strict";
// Dota 2 über Valves Game State Integration, wie CS2: eine cfg-Datei im Dota-Ordner lässt das Spiel seinen Zustand
// per HTTP an die App auf demselben PC schicken (gleicher Empfang wie CS2, erkannt an provider.appid 570).
// Dota braucht zusätzlich die Startoption -gamestateintegration (Steam → Dota 2 → Eigenschaften → Startoptionen).
// Ein spielender PC bekommt nur seinen eigenen Spieler, dazu Karte, Uhr, Roshan und die Gebäude seines Teams.
// Reine Funktionen ohne Node-Abhängigkeiten: laufen im Hauptprozess und in der Browser-Vorschau.

const { Dedupe } = require("./events");

const DOTA_APPID = 570;
const TEAM = { radiant: "RADIANT", dire: "DIRE" };
const GEGNER = { RADIANT: "DIRE", DIRE: "RADIANT" };

const DOTA_EVENT_TYPES = [
  { id: "draft", label: "Heldenwahl beginnt", gruppe: "Match" },
  { id: "pre_game", label: "Vorbereitung (Helden auf der Karte)", gruppe: "Match" },
  { id: "match_start", label: "Horn: Spiel startet", gruppe: "Match" },
  { id: "match_end", label: "Ancient zerstört, Match vorbei", gruppe: "Match", team: true },
  { id: "day", label: "Tag bricht an", gruppe: "Karte" },
  { id: "night", label: "Nacht bricht an", gruppe: "Karte" },
  { id: "roshan_killed", label: "Roshan getötet", gruppe: "Karte" },
  { id: "aegis", label: "Aegis aufgenommen", gruppe: "Karte" },
  { id: "tower_destroyed", label: "Turm zerstört", gruppe: "Karte", team: true },
  { id: "barracks_destroyed", label: "Kaserne zerstört", gruppe: "Karte", team: true },
  { id: "kill", label: "Kill", gruppe: "Spieler", team: true, spieler: true },
  { id: "double_kill", label: "Double Kill", gruppe: "Spieler", team: true, spieler: true },
  { id: "triple_kill", label: "Triple Kill", gruppe: "Spieler", team: true, spieler: true },
  { id: "ultra_kill", label: "Ultra Kill", gruppe: "Spieler", team: true, spieler: true },
  { id: "rampage", label: "Rampage", gruppe: "Spieler", team: true, spieler: true },
  { id: "assist", label: "Assist", gruppe: "Spieler", team: true, spieler: true },
  { id: "death", label: "Spieler stirbt", gruppe: "Spieler", team: true, spieler: true },
];

const PHASE = { DOTA_GAMERULES_STATE_HERO_SELECTION: "draft", DOTA_GAMERULES_STATE_PRE_GAME: "pre_game", DOTA_GAMERULES_STATE_GAME_IN_PROGRESS: "match_start" };
const MULTI = 18; // Sekunden Spielzeit zwischen zwei Kills für eine Kill-Serie (Double Kill …)
const stufe = (n) => (n >= 5 ? "rampage" : n === 4 ? "ultra_kill" : n === 3 ? "triple_kill" : n === 2 ? "double_kill" : null);
const zahl = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Spieler eines Zustands: spielend nur der eigene, als Zuschauer alle (player.team2.player0 …)
function dotaSpieler(s) {
  const out = new Map(), p = s?.player;
  if (!p || typeof p !== "object") return out;
  if (p.steamid) { out.set(String(p.steamid), p); return out; }
  for (const t of Object.values(p)) if (t && typeof t === "object") for (const x of Object.values(t)) if (x && x.steamid) out.set(String(x.steamid), x);
  return out;
}

// Gebäude, die noch stehen: name → { team (Besitzer), art }
function gebaeude(s) {
  const out = new Map();
  for (const [seite, liste] of Object.entries(s?.buildings || {})) {
    if (!liste || typeof liste !== "object") continue;
    for (const [name, b] of Object.entries(liste)) {
      const art = /tower/.test(name) ? "tower_destroyed" : /rax|barracks/.test(name) ? "barracks_destroyed" : null;
      if (art && b && zahl(b.health) > 0) out.set(name, { team: TEAM[seite] || "", art });
    }
  }
  return out;
}

class DotaQuelle {
  constructor() {
    this.prev = null;
    this.dedupe = new Dedupe();
    this.serie = new Map(); // steamid → { t, n } Kill-Serie
    this.gesehen = new Set(); // Ereignisse aus events[] schon gemeldet
    this.ende = false;
  }

  ingest(body, now = Date.now()) {
    const ev = this.erkenne(this.prev, body || {});
    this.prev = body;
    return { events: ev.filter((e) => this.dedupe.accept(e, now)), status: dotaStatus(body), stand: dotaStand(body) };
  }

  erkenne(prev, cur) {
    const ev = [], cm = cur.map || {}, pm = prev?.map || {};
    const ctx = { round: 0, map: "Dota 2", zeit: zahl(cm.clock_time) };
    const push = (type, extra = {}) => ev.push({ type, team: "", ...ctx, ...extra });
    if (!prev) return ev;
    // Neues Match: andere Match-ID oder wieder Heldenwahl
    if ((cm.matchid && pm.matchid && cm.matchid !== pm.matchid) || (cm.game_state === "DOTA_GAMERULES_STATE_HERO_SELECTION" && pm.game_state !== cm.game_state)) {
      this.ende = false; this.serie.clear(); this.gesehen.clear();
    }
    if (cm.game_state && cm.game_state !== pm.game_state && PHASE[cm.game_state]) push(PHASE[cm.game_state]);
    const sieg = cm.win_team && cm.win_team !== "none" ? TEAM[cm.win_team] || "" : "";
    if (!this.ende && (sieg || (cm.game_state === "DOTA_GAMERULES_STATE_POST_GAME" && pm.game_state && pm.game_state !== cm.game_state))) {
      this.ende = true;
      push("match_end", { team: sieg });
    }
    if (typeof cm.daytime === "boolean" && typeof pm.daytime === "boolean" && cm.daytime !== pm.daytime && cm.game_state === "DOTA_GAMERULES_STATE_GAME_IN_PROGRESS") push(cm.daytime ? "day" : "night");

    // Roshan: aus der Ereignisliste, sonst aus dem Roshan-Zustand
    for (const x of Array.isArray(cur.events) ? cur.events : []) {
      const k = `${x?.event_type}:${x?.game_time}`;
      if (this.gesehen.has(k)) continue;
      this.gesehen.add(k);
      if (x.event_type === "roshan_killed") push("roshan_killed");
      if (x.event_type === "aegis_picked_up") push("aegis", { player: x.player_name || "" });
    }
    if (pm.roshan_state === "alive" && cm.roshan_state && cm.roshan_state !== "alive") push("roshan_killed");

    // Gebäude: stand vorher, jetzt nicht mehr. Team = das Team, das es zerstört hat.
    if (cur.buildings && prev.buildings) {
      const jetzt = gebaeude(cur);
      for (const [name, b] of gebaeude(prev)) {
        if (jetzt.has(name)) continue;
        if (!cur.buildings[Object.keys(TEAM).find((k) => TEAM[k] === b.team)]) continue; // Team-Block fehlt: nichts zerstört, nur nicht gemeldet
        push(b.art, { team: GEGNER[b.team] || "", gebaeude: name, einmal: `${cm.matchid || ""}:${name}` });
      }
    }

    // Spieler: Kills, Serien, Assists, Tode
    const vorher = dotaSpieler(prev);
    for (const [id, p] of dotaSpieler(cur)) {
      const q = vorher.get(id);
      if (!q) continue;
      const extra = { team: TEAM[p.team_name] || "", player: String(p.name || ""), steamid: `dota:${id}` };
      const dk = zahl(p.kills) - zahl(q.kills);
      if (dk > 0) {
        const s = this.serie.get(id) || { t: -999, n: 0 };
        const alt = s.n;
        s.n = ctx.zeit - s.t <= MULTI ? s.n + dk : dk;
        s.t = ctx.zeit;
        this.serie.set(id, s);
        push("kill", { ...extra, kills: zahl(p.kills) });
        if (stufe(s.n) && stufe(s.n) !== stufe(alt)) push(stufe(s.n), { ...extra, kills: zahl(p.kills) });
      }
      if (zahl(p.assists) > zahl(q.assists)) push("assist", { ...extra, kills: zahl(p.assists) });
      if (zahl(p.deaths) > zahl(q.deaths)) push("death", { ...extra, kills: zahl(p.deaths) });
    }
    return ev;
  }
}

function dotaStatus(b) {
  const p = b?.player;
  if (!p || !p.steamid) return { spieler: "", team: "", zuschauer: !!p, kills: 0, deaths: 0, assists: 0 };
  return { spieler: String(p.name || ""), team: TEAM[p.team_name] || "", held: String(b.hero?.name || "").replace(/^npc_dota_hero_/, ""), kills: zahl(p.kills), deaths: zahl(p.deaths), assists: zahl(p.assists) };
}

function dotaStand(b) {
  const m = b?.map;
  if (!m) return null;
  const score = m.radiant_score != null || m.dire_score != null ? { RADIANT: zahl(m.radiant_score), DIRE: zahl(m.dire_score) } : null;
  return { match: String(m.matchid || ""), map: "Dota 2", phase: String(m.game_state || "").replace("DOTA_GAMERULES_STATE_", ""), zeit: zahl(m.clock_time), tag: !!m.daytime, score, runde: 0 };
}

/* ── cfg-Datei ─────────────────────────────────────────────────────────── */
const DOTA_CFG_ORDNER = "Steam\\steamapps\\common\\dota 2 beta\\game\\dota\\cfg\\gamestate_integration";
const DOTA_CFG_DATEI = "gamestate_integration_advancedlan.cfg";
const DOTA_STARTOPTION = "-gamestateintegration";

function dotaCfg({ port, token }) {
  return [
    '"Advanced LAN"',
    "{",
    `\t"uri"\t\t"http://127.0.0.1:${port}/gsi"`,
    '\t"timeout"\t"1.1"',
    '\t"buffer"\t"0.0"',
    '\t"throttle"\t"0.1"',
    '\t"heartbeat"\t"10.0"',
    '\t"auth"',
    "\t{",
    `\t\t"token"\t"${token}"`,
    "\t}",
    '\t"data"',
    "\t{",
    ...["provider", "map", "player", "hero", "buildings", "events", "roshan"].map((k) => `\t\t"${k}"\t"1"`),
    "\t}",
    "}",
    "",
  ].join("\r\n");
}

// Startoptionen von Dota (App 570) aus Steams localconfig.vdf. null = nicht gefunden.
function dotaStartoptionen(vdf) {
  const s = String(vdf || "");
  const re = /"570"\s*\{/g;
  let m;
  while ((m = re.exec(s))) {
    let tiefe = 1, i = m.index + m[0].length;
    const start = i;
    while (i < s.length && tiefe > 0) { if (s[i] === "{") tiefe++; else if (s[i] === "}") tiefe--; i++; }
    const block = s.slice(start, i);
    // Nur die oberste Ebene des Blocks: LaunchOptions steht direkt unter "570"
    let oben = block, alt;
    do { alt = oben; oben = oben.replace(/\{[^{}]*\}/g, ""); } while (oben !== alt);
    const lo = /"LaunchOptions"\s*"((?:[^"\\]|\\.)*)"/i.exec(oben);
    if (lo) return lo[1];
  }
  return null;
}

module.exports = { DOTA_APPID, DOTA_EVENT_TYPES, DotaQuelle, dotaStatus, dotaStand, dotaSpieler, dotaCfg, dotaStartoptionen, DOTA_CFG_ORDNER, DOTA_CFG_DATEI, DOTA_STARTOPTION, TEAM };
