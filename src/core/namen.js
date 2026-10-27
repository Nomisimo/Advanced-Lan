"use strict";
// Namens-Popup des Game-PCs: wann es erscheint. Reine Logik ohne Electron, Zeit kommt von außen.
//
// Spielstart: Ein Spiel liefert wieder Daten, nachdem SPIELSTART_PAUSE lang keines welche geliefert hat.
//   Fragt höchstens alle ABSTAND, damit es nicht bei jedem Match aufgeht.
// Leerlauf: So lange keine Eingabe an Maus oder Tastatur (und kein Spiel liefert Daten) → der Spieler ist weg („weg“).
//   Sobald wieder jemand etwas drückt → „zurueck“: das Popup fragt, wer jetzt spielt.
//   Gamepads zählen unter Windows nicht als Eingabe, deshalb gilt ein laufendes Spiel als belegt.

const SPIELSTART_PAUSE = 3 * 60_000;
const ABSTAND = 15 * 60_000;
const SPIEL_LAEUFT = 60_000; // so frisch müssen Spieldaten sein, damit der PC als belegt gilt
const AKTIV = 5; // s seit der letzten Eingabe: jemand sitzt wieder am PC
const LEERLAUF_STUFEN = [0, 5, 10, 15, 30, 60]; // Minuten, 0 = aus (Auswahl im Tab „Session“)

const standardNamensAbfrage = () => ({ spielstart: true, leerlaufMin: 15 });
function migrateNamensAbfrage(a) {
  const d = standardNamensAbfrage();
  if (!a || typeof a !== "object") return d;
  const min = Number(a.leerlaufMin);
  return { spielstart: typeof a.spielstart === "boolean" ? a.spielstart : d.spielstart, leerlaufMin: Number.isFinite(min) ? Math.max(0, Math.min(240, Math.round(min))) : d.leerlaufMin };
}

class NamensWaechter {
  constructor({ now = Date.now } = {}) {
    this.now = now;
    this.letzteDaten = 0; // letzte echte Spieldaten (nicht Simulator)
    this.letzteFrage = 0;
    this.weg = false;
  }

  // Echte Spieldaten sind angekommen. → "spielstart", wenn das Popup jetzt fragen soll, sonst ""
  spielDaten(einst) {
    const t = this.now(), start = !this.letzteDaten || t - this.letzteDaten > SPIELSTART_PAUSE;
    this.letzteDaten = t;
    if (!start || !einst?.spielstart) return "";
    if (this.letzteFrage && t - this.letzteFrage < ABSTAND) return "";
    return "spielstart";
  }

  spielLaeuft() { return !!this.letzteDaten && this.now() - this.letzteDaten < SPIEL_LAEUFT; }

  // idle: Sekunden seit der letzten Eingabe (powerMonitor.getSystemIdleTime). → "weg", "zurueck" oder ""
  leerlauf(idle, einst) {
    const min = Number(einst?.leerlaufMin) || 0;
    if (!min) { this.weg = false; return ""; }
    const s = this.spielLaeuft() ? 0 : Number(idle) || 0;
    if (!this.weg && s >= min * 60) { this.weg = true; return "weg"; }
    if (this.weg && s <= AKTIV) { this.weg = false; return "zurueck"; }
    return "";
  }

  gefragt() { this.letzteFrage = this.now(); }
}

module.exports = { NamensWaechter, standardNamensAbfrage, migrateNamensAbfrage, LEERLAUF_STUFEN, SPIELSTART_PAUSE, ABSTAND };
