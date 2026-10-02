"use strict";
// Netzwerkprotokoll zwischen Game-PC und Regie.
//
// Finden: Die Regie ruft jede Sekunde per UDP-Broadcast an Port 47800 ihre Session aus (Beacon).
// Verbinden: WebSocket zur Regie (Port 47801). Anmeldung mit Challenge-Response, das Passwort geht nie im Klartext übers Netz:
//   Regie → PC   { t: "hallo", session, nonce, aktivesSpiel }
//   PC → Regie   { t: "anmelden", pcId, spiel, version, beweis }   beweis = HMAC-SHA256(passwort, nonce) als Hex
//   Regie → PC   { t: "ok", aktivesSpiel } oder { t: "abgelehnt", grund }
// Danach:
//   PC → Regie   { t: "event", spiel, ev }            ein erkanntes Spielereignis
//   PC → Regie   { t: "status", spiel, status, stand } Spieler und Spielstand (gedrosselt)
//   Regie → PC   { t: "aktivesSpiel", spiel }           wenn die Regie das Spiel wechselt
//   Regie → PC   { t: "quittung", n, verworfen }        Rückmeldung zu einem Ereignis

const BEACON_APP = "lan-regie";
const PROTOKOLL_VERSION = 1;

function beacon({ session, port, host, aktivesSpiel, pcs }) {
  return JSON.stringify({ app: BEACON_APP, v: PROTOKOLL_VERSION, session, port, host, aktivesSpiel, pcs });
}

function leseBeacon(buf) {
  try {
    const b = JSON.parse(String(buf));
    if (b.app !== BEACON_APP || typeof b.session !== "string" || !(b.port > 0)) return null;
    return b;
  } catch { return null; }
}

function leseNachricht(data) {
  try { const m = JSON.parse(String(data)); return m && typeof m.t === "string" ? m : null; } catch { return null; }
}

module.exports = { beacon, leseBeacon, leseNachricht, BEACON_APP, PROTOKOLL_VERSION };
