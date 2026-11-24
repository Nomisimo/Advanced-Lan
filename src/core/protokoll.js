"use strict";
// Netzwerkprotokoll zwischen Game-PC und Regie.
//
// Finden: Die Regie veröffentlicht ihre Session per mDNS (DNS-SD, Multicast 224.0.0.251:5353) als Dienst „_advancedlan._tcp“.
//   TXT-Einträge: session (Name), v (Protokollversion), spiel (aktives Spiel), ip (nur wenn die Regie auf einer Karte lauscht).
// Verbinden: WebSocket zur Regie (Port aus dem Dienst: 47801, falls belegt ein freier). Anmeldung mit Challenge-Response,
// das Passwort geht nie im Klartext übers Netz:
//   Regie → PC   { t: "hallo", session, nonce, aktivesSpiel }
//   PC → Regie   { t: "anmelden", pcId, spiele, version, beweis, geraet, spieler, vorlage }  spiele = alle Spiele, die der PC erkennt   beweis = HMAC-SHA256(passwort, nonce) als Hex
//                geraet = { hostname, app, mac, karte, plattform } für die Übersicht im Tab „Session“ der Regie
//                spieler = Name aus dem Namens-Popup des Game-PCs, leer = keiner eingetragen
//                pcId darf leer sein, wenn der Rechner im Plan der Regie steht. vorlage = Stand der Game-PC-Vorlage oder "eigene"
//   Regie → PC   { t: "ok", aktivesSpiel, pcId } oder { t: "abgelehnt", grund }   pcId = PC-ID aus dem Plan der Regie (gilt ab jetzt)
// Danach:
//   PC → Regie   { t: "event", spiel, ev }            ein erkanntes Spielereignis (immer, egal welches Spiel die Regie nutzt)
//   PC → Regie   { t: "status", spiel, status, stand } Spieler und Spielstand (gedrosselt)
//   PC → Regie   { t: "spieler", name }                 neuer Spielername (Namens-Popup oder Tab „Session“), leer = PC-ID zeigen
//   Regie → PC   { t: "aktivesSpiel", spiel }           wenn die Regie das Spiel wechselt
//   Regie → PC   { t: "quittung", n, verworfen }        Rückmeldung zu einem Ereignis
//   Regie → PC   { t: "einrichtung", name, daten, stand } Game-PC-Vorlage aus dem Plan der Regie übernehmen
//   PC → Regie   { t: "einrichtung-ok", stand }          übernommen (stand) oder "eigene", wenn der PC keine Vorlage annimmt
//   Regie → PC   { t: "vorlage-holen" }                 Einstellungen dieses PCs als Vorlage schicken
//   PC → Regie   { t: "vorlage", name, daten }          Game-PC-Show-Daten dieses PCs
//   PC → Regie   { t: "hinweis", vollbild, nameOffen }  vollbild = "exklusiv" (Overlay und Popup unsichtbar), "vollbild" oder ""
//                                                       nameOffen = Namens-Popup wartet aufs Ende des exklusiven Vollbilds
//   Regie → PC   { t: "spieler-setzen", name }          Spielernamen von der Regie eintragen (PC antwortet mit „spieler“)
//   Regie → PC   { t: "name-fragen" }                   Namens-Popup zeigen (im exklusiven Vollbild: sobald es endet)
// Ältere Game-PCs ignorieren die neuen Nachrichten. Code 4004 beim Schließen: neu zugeordnet, sofort neu anmelden.

const MDNS_TYP = "advancedlan"; // → _advancedlan._tcp.local
const PROTOKOLL_VERSION = 1;

const mdnsTxt = ({ session, aktivesSpiel, ip }) => ({ session, v: String(PROTOKOLL_VERSION), spiel: aktivesSpiel || "", ...(ip ? { ip } : {}) });

// Angaben des Game-PCs zu sich selbst, gekürzt auf Text
function leseGeraet(g) {
  const t = (x, n = 64) => (typeof x === "string" || typeof x === "number" ? String(x).slice(0, n) : "");
  return g && typeof g === "object" ? { hostname: t(g.hostname, 253), app: t(g.app, 32), mac: t(g.mac, 17), karte: t(g.karte), plattform: t(g.plattform, 16) } : {};
}

// Spielername: ein Leerzeichen zwischen Wörtern, höchstens 32 Zeichen
const SPIELER_MAX = 32;
const leseSpieler = (x) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, SPIELER_MAX) : "");

function leseNachricht(data) {
  try { const m = JSON.parse(String(data)); return m && typeof m.t === "string" ? m : null; } catch { return null; }
}

module.exports = { mdnsTxt, leseNachricht, leseGeraet, leseSpieler, SPIELER_MAX, MDNS_TYP, PROTOKOLL_VERSION };
