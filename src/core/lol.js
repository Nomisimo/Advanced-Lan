"use strict";
// League of Legends über Riots Live Client Data API. Läuft lokal im Spielclient, solange ein Spiel läuft:
//   https://127.0.0.1:2999/liveclientdata/allgamedata  (selbst signiertes Zertifikat von Riot, nur auf diesem PC)
// Offiziell von Riot, ohne Overwolf und ohne Anmeldung: https://developer.riotgames.com/docs/lol#game-client-api
// Liefert activePlayer (dieser PC), allPlayers (mit team ORDER oder CHAOS) und events.Events (alle Ereignisse des Spiels
// mit fortlaufender EventID). Jeder PC sieht dieselben Ereignisse: Objekte und Spielende gehen mit EventID als „einmal“
// an die Regie, die sie nur einmal zählt. Kills, Tode, Assists und Multikills meldet nur der PC des Spielers.
// Reine Funktionen ohne Node-Abhängigkeiten: laufen im Hauptprozess, in der Oberfläche und in den Tests.

const LOL_PORT = 2999;
const LOL_URL = `https://127.0.0.1:${LOL_PORT}/liveclientdata/allgamedata`;
const LOL_DOKU_URL = "https://developer.riotgames.com/docs/lol#game-client-api";
const TEAMS = { ORDER: "BLUE", CHAOS: "RED" };
const MULTI = { 2: "double_kill", 3: "triple_kill", 4: "quadra_kill", 5: "penta_kill" };

const lolZustand = () => ({ letzteId: -1, ich: "", team: "", spielzeit: 0, erstesTurm: false });

// Namen eines Spielers, wie sie in den Events stehen können (Riot ID ohne Tag, Riot ID, alter Beschwörername)
const namen = (p) => [p?.riotIdGameName, p?.riotId, p?.summonerName, String(p?.riotId || "").split("#")[0]].filter(Boolean).map((n) => String(n).toLowerCase());
const gleich = (p, name) => !!name && namen(p).includes(String(name).toLowerCase());

// Team, dem ein Ereignis gehört: Spieler über den Namen, sonst über den Namen des Gebäudes (Turret_T1 gehört ORDER, zerstört hat es CHAOS)
function teamVon(daten, name, gebaeude) {
  const p = (daten.allPlayers || []).find((x) => gleich(x, name));
  if (p?.team) return TEAMS[p.team] || "";
  const t = /_T([12])_/.exec(String(gebaeude || ""))?.[1];
  if (t) return t === "1" ? "RED" : "BLUE";
  const m = /Minion_T(100|200)/i.exec(String(name || ""))?.[1];
  if (m) return m === "100" ? "BLUE" : "RED";
  return "";
}

// allgamedata → { team, ich, nachrichten: [{ event, seite, einmal? }] }. Beim ersten Aufruf in einem laufenden Spiel
// gelten ältere Ereignisse als gesehen (App neu gestartet), außer das Spiel hat gerade erst begonnen.
function lolAuswerten(daten, z = lolZustand()) {
  const raus = [];
  if (!daten || typeof daten !== "object") return { team: z.team, ich: z.ich, nachrichten: raus };
  const ich = (daten.allPlayers || []).find((p) => gleich(p, daten.activePlayer?.riotIdGameName) || gleich(p, daten.activePlayer?.riotId) || gleich(p, daten.activePlayer?.summonerName));
  z.ich = daten.activePlayer?.riotIdGameName || String(daten.activePlayer?.riotId || "").split("#")[0] || daten.activePlayer?.summonerName || z.ich;
  z.team = TEAMS[ich?.team] || z.team;
  const events = Array.isArray(daten.events?.Events) ? daten.events.Events : [];
  const zeit = Number(daten.gameData?.gameTime) || 0;
  // Neues Spiel: Spielzeit springt zurück oder die Liste ist kürzer
  const maxId = events.reduce((m, e) => Math.max(m, Number(e.EventID) || 0), -1);
  if (zeit + 5 < z.spielzeit || maxId < z.letzteId) Object.assign(z, { letzteId: -1, erstesTurm: false });
  if (z.letzteId === -1 && zeit > 30) z.letzteId = maxId; // App erst mitten im Spiel gestartet: alte Ereignisse nicht nachholen
  z.spielzeit = zeit;
  const seite = (team) => (!team || !z.team ? "keins" : team === z.team ? "eigen" : "gegner");
  const objekt = (event, team, id) => raus.push({ event, seite: seite(team), einmal: String(id) });
  const binIch = (name) => gleich(ich || daten.activePlayer, name);
  for (const e of events) {
    const id = Number(e.EventID);
    if (!Number.isFinite(id) || id <= z.letzteId) continue;
    z.letzteId = id;
    switch (e.EventName) {
      case "GameStart": raus.push({ event: "match_start", seite: "eigen" }); break;
      case "MinionsSpawning": objekt("minions", "", id); break;
      case "FirstBlood": objekt("first_blood", teamVon(daten, e.Recipient), id); break;
      case "FirstBrick": objekt("first_tower", teamVon(daten, e.KillerName), id); break;
      case "TurretKilled": objekt("tower_destroyed", teamVon(daten, e.KillerName, e.TurretKilled), id); break;
      case "InhibKilled": objekt("inhibitor_destroyed", teamVon(daten, e.KillerName, e.InhibKilled), id); break;
      case "DragonKill": objekt(/elder/i.test(e.DragonType) ? "elder_killed" : "dragon_killed", teamVon(daten, e.KillerName), id); if (String(e.Stolen) === "True" || e.Stolen === true) objekt("objective_stolen", teamVon(daten, e.KillerName), `${id}s`); break;
      case "HeraldKill": objekt("herald_killed", teamVon(daten, e.KillerName), id); if (String(e.Stolen) === "True" || e.Stolen === true) objekt("objective_stolen", teamVon(daten, e.KillerName), `${id}s`); break;
      case "BaronKill": objekt("baron_killed", teamVon(daten, e.KillerName), id); if (String(e.Stolen) === "True" || e.Stolen === true) objekt("objective_stolen", teamVon(daten, e.KillerName), `${id}s`); break;
      case "HordeKill": objekt("grubs_killed", teamVon(daten, e.KillerName), id); break;
      case "AtakhanKill": objekt("atakhan_killed", teamVon(daten, e.KillerName), id); break;
      case "Ace": objekt("team_ace", TEAMS[e.AcingTeam] || teamVon(daten, e.Acer), id); break;
      case "ChampionKill":
        if (binIch(e.KillerName)) raus.push({ event: "kill", seite: "eigen" });
        if (binIch(e.VictimName)) raus.push({ event: "death", seite: "eigen" });
        if ((e.Assisters || []).some((a) => binIch(a))) raus.push({ event: "assist", seite: "eigen" });
        break;
      case "Multikill": if (binIch(e.KillerName) && MULTI[Math.min(5, Number(e.KillStreak))]) raus.push({ event: MULTI[Math.min(5, Number(e.KillStreak))], seite: "eigen" }); break;
      case "GameEnd": raus.push({ event: "match_won", seite: /win/i.test(e.Result) ? "eigen" : "gegner" }); break;
    }
  }
  return { team: z.team, ich: z.ich, nachrichten: raus };
}

module.exports = { LOL_PORT, LOL_URL, LOL_DOKU_URL, lolZustand, lolAuswerten, teamVon };
