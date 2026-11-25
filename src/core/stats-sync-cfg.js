"use strict";
// Einstellungen der Stats-Screen-PCs (ohne Node-Module, läuft auch in der Oberfläche). Protokoll: core/stats-sync.js

const DATEN_PORT = 47803; // Stats-PCs lauschen hier (Multicast und Unicast), die Regie auf Port + 1
const GRUPPE = "239.255.47.81"; // Multicast-Gruppe (organisationslokal)
const istMulticast = (ip) => /^(22[4-9]|23\d)\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(String(ip || ""));

// Einstellungen: Senden in der Regie (Tab „Setup“) und Empfang auf dem Stats-PC
function standardSync() { return { an: true, gruppe: GRUPPE, port: DATEN_PORT, netz: "" }; }
function migrateSync(s) {
  const d = standardSync();
  if (!s || typeof s !== "object") return d;
  const port = Math.round(Number(s.port));
  return { an: s.an !== false, gruppe: istMulticast(s.gruppe) ? String(s.gruppe) : d.gruppe, port: port >= 1024 && port <= 65534 ? port : d.port, netz: typeof s.netz === "string" ? s.netz : "" };
}
// Stats-PC: Adresse der Regie (leer = automatisch über Multicast und Session-Suche), Netzwerkkarte, Port, Fenster beim Start
function standardStatsPc() { return { regie: "", netz: "", gruppe: GRUPPE, port: DATEN_PORT, fenster: [], vollbild: true }; }
function migrateStatsPc(s) {
  const d = standardStatsPc();
  if (!s || typeof s !== "object") return d;
  const port = Math.round(Number(s.port));
  return {
    regie: typeof s.regie === "string" ? s.regie.trim().slice(0, 100) : "",
    netz: typeof s.netz === "string" ? s.netz : "",
    gruppe: istMulticast(s.gruppe) ? String(s.gruppe) : d.gruppe,
    port: port >= 1024 && port <= 65534 ? port : d.port,
    fenster: Array.isArray(s.fenster) ? s.fenster.filter((x) => typeof x === "string").slice(0, 8) : [],
    vollbild: s.vollbild !== false,
  };
}

module.exports = { DATEN_PORT, GRUPPE, istMulticast, standardSync, migrateSync, standardStatsPc, migrateStatsPc };
