"use strict";
// Macht aus einem Ereignis ein neutrales OSC-Signal. Es sagt nur, was passiert ist,
// nicht was ein Empfänger (Lichtpult, Playout …) damit tun soll. Das entscheidet der Empfänger.
//
//   Ereignis für das ganze Spiel:  /lan/<spiel>/<event>         z. B. /lan/cs2/round_end
//   Ereignis eines Spielers:       /lan/<spiel>/<pc>/<event>    z. B. /lan/cs2/pc03/kill
//   Argumente immer gleich:        team (s), spieler (s), pc (s), runde (i)

// "PC 03" → "pc03": OSC-Adressen ohne Leer- und Sonderzeichen
const slug = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "") || "x";

function oscAdresse(ev, spielerEvent) {
  return spielerEvent && ev.pcId ? `/lan/${slug(ev.spiel)}/${slug(ev.pcId)}/${ev.type}` : `/lan/${slug(ev.spiel)}/${ev.type}`;
}

// Runde, Bombe usw. melden alle PCs: dort bleibt der PC leer, damit das Signal nicht davon abhängt, welcher PC zuerst war
const oscArgs = (ev, spielerEvent = true) => [
  { type: "s", value: String(ev.team || "") },
  { type: "s", value: String(ev.player || "") },
  { type: "s", value: spielerEvent ? String(ev.pcId || ev.pc || "") : "" },
  { type: "i", value: Number(ev.round) || 0 },
];

// Ist dieses Ereignis in der Regie zum Senden freigegeben? Standard: ja.
const freigegeben = (cfg, spiel, type) => cfg.signale?.[spiel]?.[type] !== false;

module.exports = { oscAdresse, oscArgs, freigegeben, slug };
