"use strict";
// Netzwerkprotokoll zwischen Game-PC und Regie.
//
// Finden: Die Regie veröffentlicht ihre Session per mDNS (DNS-SD, Multicast 224.0.0.251:5353) als Dienst „_advancedlan._tcp“.
//   TXT-Einträge: session (Name), v (Protokollversion), spiel (aktives Spiel).
// Verbinden: WebSocket zur Regie (Port aus dem Dienst: 47801, falls belegt ein freier). Anmeldung mit Challenge-Response,
// das Passwort geht nie im Klartext übers Netz:
//   Regie → PC   { t: "hallo", session, nonce, aktivesSpiel }
//   PC → Regie   { t: "anmelden", pcId, spiele, version, beweis }  spiele = alle Spiele, die der PC erkennt   beweis = HMAC-SHA256(passwort, nonce) als Hex
//   Regie → PC   { t: "ok", aktivesSpiel } oder { t: "abgelehnt", grund }
// Danach:
//   PC → Regie   { t: "event", spiel, ev }            ein erkanntes Spielereignis (immer, egal welches Spiel die Regie nutzt)
//   PC → Regie   { t: "status", spiel, status, stand } Spieler und Spielstand (gedrosselt)
//   Regie → PC   { t: "aktivesSpiel", spiel }           wenn die Regie das Spiel wechselt
//   Regie → PC   { t: "quittung", n, verworfen }        Rückmeldung zu einem Ereignis

const MDNS_TYP = "advancedlan"; // → _advancedlan._tcp.local
const PROTOKOLL_VERSION = 1;

const mdnsTxt = ({ session, aktivesSpiel }) => ({ session, v: String(PROTOKOLL_VERSION), spiel: aktivesSpiel || "" });

function leseNachricht(data) {
  try { const m = JSON.parse(String(data)); return m && typeof m.t === "string" ? m : null; } catch { return null; }
}

module.exports = { mdnsTxt, leseNachricht, MDNS_TYP, PROTOKOLL_VERSION };
