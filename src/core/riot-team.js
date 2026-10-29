"use strict";
// Valorant: Team dieses PCs über den Riot Client erkennen (inoffizielle, nur lesende Schnittstellen, siehe main/riot-client.js).
// Der Riot Client legt beim Start eine lockfile mit Port und Passwort seiner lokalen Schnittstelle an. Darüber holt die App
// die Anmeldung des Spielers und fragt bei Riot nach dem laufenden Match (Agentenwahl oder Spiel). Dort steht die TeamID
// des Spielers: "Red" oder "Blue". Die bleibt das ganze Match gleich, auch nach dem Seitenwechsel. Rot beginnt im Angriff.
// Reine Funktionen ohne Node-Abhängigkeiten: laufen im Hauptprozess, in der Oberfläche und in den Tests.

// Riot-TeamID → Team der App. Gleiche Zuordnung auf allen PCs, damit die Regie beide Teams sauber trennt.
const RIOT_TEAMS = { Red: "TEAM A", Blue: "TEAM B" };
const RIOT_FARBE = { "TEAM A": "Rot, beginnt im Angriff", "TEAM B": "Blau, beginnt in der Verteidigung" };

// lockfile: "Riot Client:1234:54321:passwort:https" → { port, passwort, protokoll } oder null
function parseLockfile(text) {
  const t = String(text ?? "").trim().split(":");
  if (t.length < 5) return null;
  const port = Number(t[2]);
  if (!Number.isInteger(port) || port <= 0 || port > 65535 || !t[3]) return null;
  return { port, passwort: t[3], protokoll: t[4] || "https" };
}

// ShooterGame.log: Region und Shard aus der ersten Adresse wie https://glz-eu-1.eu.a.pvp.net → { region, shard } oder null.
// Die letzte Fundstelle zählt: Das Log wächst über die Sitzung, ein Regionswechsel steht unten.
function parseGlz(log) {
  const re = /https:\/\/glz-([a-z0-9]+)-1\.([a-z0-9]+)\.a\.pvp\.net/g;
  let m, letzte = null;
  while ((m = re.exec(String(log ?? "")))) letzte = { region: m[1], shard: m[2] };
  return letzte;
}

// /product-session/v1/external-sessions → Version von Valorant, z. B. "release-09.08-shipping-15-2734597", oder ""
function valorantVersion(sessions) {
  for (const s of Object.values(sessions || {})) if (s?.productId === "valorant" && typeof s.version === "string") return s.version;
  return "";
}

// Match aus core-game (Players[]) oder pregame (AllyTeam / Teams[]) → TeamID des Spielers oder ""
function eigeneTeamId(match, puuid) {
  if (!match || !puuid) return "";
  const spieler = match.Players?.find((p) => p?.Subject === puuid);
  if (spieler?.TeamID) return spieler.TeamID;
  if (match.AllyTeam?.TeamID && match.AllyTeam.Players?.some((p) => p?.Subject === puuid)) return match.AllyTeam.TeamID;
  for (const t of match.Teams || []) if (t?.Players?.some((p) => p?.Subject === puuid)) return t.TeamID || "";
  return match.AllyTeam?.TeamID || "";
}

const appTeam = (teamId) => RIOT_TEAMS[teamId] || "";

// Plattform-Header, den die GLZ-Server erwarten (base64 von JSON)
const CLIENT_PLATFORM = { platformType: "PC", platformOS: "Windows", platformOSVersion: "10.0.19042.1.256.64bit", platformChipset: "Unknown" };

module.exports = { RIOT_TEAMS, RIOT_FARBE, parseLockfile, parseGlz, valorantVersion, eigeneTeamId, appTeam, CLIENT_PLATFORM };
