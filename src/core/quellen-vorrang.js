"use strict";
// Vorrang der Quellen eines Spiels auf dem Game-PC. Mehrere Quellen können dasselbe Event liefern (z. B. Kill über Shots Fired
// und über die Bilderkennung). Gezählt wird es nur von der besten Quelle, die dieses Event gerade liefert:
//   1. offizielle Schnittstelle des Spiels (LoL: Live Client Data API)
//   2. Shots Fired (Overwolf)
//   3. Automation Overdrive (Overwolf, nur Valorant)
//   4. Bilderkennung
// Ein Event einer schlechteren Quelle fällt weg, wenn eine bessere dasselbe Event in den letzten FENSTER ms geliefert hat.
// Events, die nur die schlechtere Quelle kennt (z. B. Thrifty aus der Bilderkennung), gehen immer durch.
// Reine Funktionen ohne Node-Abhängigkeiten.

const RANG = { api: 1, shotsfired: 2, overdrive: 3, bild: 4 };
const QUELLE_NAME = { api: "Spiel-Schnittstelle", shotsfired: "Shots Fired", overdrive: "Automation Overdrive", bild: "Bilderkennung" };
const FENSTER = 15 * 60 * 1000;

class QuellenVorrang {
  constructor(fenster = FENSTER) { this.fenster = fenster; this.zuletzt = new Map(); } // spiel:event → { quelle: Zeit }

  // true: Event zählen. quelle unbekannt (z. B. Simulator): immer.
  erlaubt(spiel, quelle, event, now = Date.now()) {
    const rang = RANG[quelle];
    if (!rang) return true;
    const k = `${spiel}:${event}`, z = this.zuletzt.get(k) || {};
    z[quelle] = now;
    this.zuletzt.set(k, z);
    return !Object.entries(z).some(([q, t]) => RANG[q] < rang && now - t < this.fenster);
  }

  // Beste Quelle, die für ein Spiel gerade etwas liefert (für die Anzeige), sonst ""
  aktiv(spiel, now = Date.now()) {
    let best = "";
    for (const [k, z] of this.zuletzt) if (k.startsWith(`${spiel}:`)) for (const [q, t] of Object.entries(z)) if (now - t < this.fenster && (!best || RANG[q] < RANG[best])) best = q;
    return best;
  }
}

module.exports = { QuellenVorrang, RANG, QUELLE_NAME, FENSTER };
