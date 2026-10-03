"use strict";
// Netzwerkprotokoll zwischen Game-PC und Regie.
//
// Finden: Die Regie veröffentlicht ihre Session per mDNS (DNS-SD, Multicast 224.0.0.251:5353) als Dienst „_advancedlan._tcp“.
//   TXT-Einträge: session (Name), v (Protokollversion), spiel (aktives Spiel), ip (nur wenn die Regie auf einer Karte lauscht).
// Verbinden: WebSocket zur Regie (Port aus dem Dienst: 47801, falls belegt ein freier). Anmeldung mit Challenge-Response,
// das Passwort geht nie im Klartext übers Netz:
//   Regie → PC   { t: "hallo", session, nonce, aktivesSpiel }
//   PC → Regie   { t: "anmelden", pcId, spiele, version, beweis, geraet }  spiele = alle Spiele, die der PC erkennt   beweis = HMAC-SHA256(passwort, nonce) als Hex
//                geraet = { hostname, app, mac, karte, plattform } für die Übersicht im Tab „Session“ der Regie
//   Regie → PC   { t: "ok", aktivesSpiel } oder { t: "abgelehnt", grund }
// Danach:
//   PC → Regie   { t: "event", spiel, ev }            ein erkanntes Spielereignis (immer, egal welches Spiel die Regie nutzt)
//   PC → Regie   { t: "status", spiel, status, stand } Spieler und Spielstand (gedrosselt)
//   Regie → PC   { t: "aktivesSpiel", spiel }           wenn die Regie das Spiel wechselt
//   Regie → PC   { t: "quittung", n, verworfen }        Rückmeldung zu einem Ereignis

const MDNS_TYP = "advancedlan"; // → _advancedlan._tcp.local
const PROTOKOLL_VERSION = 1;

const mdnsTxt = ({ session, aktivesSpiel, ip }) => ({ session, v: String(PROTOKOLL_VERSION), spiel: aktivesSpiel || "", ...(ip ? { ip } : {}) });

// Angaben des Game-PCs zu sich selbst, gekürzt auf Text
function leseGeraet(g) {
  const t = (x, n = 64) => (typeof x === "string" || typeof x === "number" ? String(x).slice(0, n) : "");
  return g && typeof g === "object" ? { hostname: t(g.hostname, 253), app: t(g.app, 32), mac: t(g.mac, 17), karte: t(g.karte), plattform: t(g.plattform, 16) } : {};
}

function leseNachricht(data) {
  try { const m = JSON.parse(String(data)); return m && typeof m.t === "string" ? m : null; } catch { return null; }
}

module.exports = { mdnsTxt, leseNachricht, leseGeraet, MDNS_TYP, PROTOKOLL_VERSION };
