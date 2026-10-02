"use strict";
// Erzeugt die gamestate_integration-Datei, die CS2 auf dem Game-PC lädt.
// CS2 schickt den Spielstand an die LAN-Regie-App auf demselben PC (127.0.0.1).

const CFG_ORDNER = "Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg";
const CFG_DATEI = "gamestate_integration_lanregie.cfg";

function gsiCfg({ port, token }) {
  return [
    '"LAN-Regie"',
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
    ...["provider", "map", "round", "player_id", "player_state", "player_match_stats", "allplayers_id", "allplayers_state", "allplayers_match_stats", "bomb", "phase_countdowns"].map((k) => `\t\t"${k}"\t"1"`),
    "\t}",
    "}",
    "",
  ].join("\r\n");
}

module.exports = { gsiCfg, CFG_ORDNER, CFG_DATEI };
