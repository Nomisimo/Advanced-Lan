"use strict";
// Einstellungen der Rocket-League-Stats-API: <RL-Ordner>\TAGame\Config\TAStatsAPI.ini
const RL_INI_DATEI = "TAStatsAPI.ini";
const RL_INI_ORDNER = "rocketleague\\TAGame\\Config";
const RL_PORTS = { tcp: 49123, web: 49124 };
const RL_RATE = 10; // UpdateState pro Sekunde; 0 = aus

function rlIni({ rate = RL_RATE, port = RL_PORTS.tcp, webPort = RL_PORTS.web } = {}) {
  return ["[TAGame.MatchStatsExporter_TA]", `PacketSendRate=${rate}`, `Port=${port}`, `WebPort=${webPort}`, ""].join("\r\n");
}

// Liest PacketSendRate und WebPort aus einer vorhandenen ini
function leseRlIni(text) {
  const wert = (k) => { const m = new RegExp(`^\\s*${k}\\s*=\\s*([0-9.]+)`, "mi").exec(text || ""); return m ? Number(m[1]) : null; };
  return { rate: wert("PacketSendRate"), port: wert("Port"), webPort: wert("WebPort") };
}

module.exports = { rlIni, leseRlIni, RL_INI_DATEI, RL_INI_ORDNER, RL_PORTS, RL_RATE };
