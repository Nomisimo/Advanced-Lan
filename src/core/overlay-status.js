"use strict";
// Ampel für das Mini-Overlay des Game-PCs: grün = alles läuft, orange = wartet, rot = gestört.

const FRISCH = 15000; // ms: so lange gelten Spieldaten als aktuell

// weitere: { Spielname: Zeitpunkt der letzten Daten } für Dota 2 und die Overwolf-Spiele
function overlayStatus({ client = {}, gsi = {}, rl = {}, letzteCs2 = 0, letzteRl = 0, weitere = {}, jetzt = Date.now() }) {
  const z = client.zustand;
  if (gsi.fehler) return { farbe: "err", text: `CS2-Empfang gestört: ${gsi.fehler}` };
  if (z === "abgelehnt") return { farbe: "err", text: `Session abgelehnt${client.grund ? `: ${client.grund}` : ""}` };
  if (z !== "verbunden" && z !== "verbinde") return { farbe: "err", text: "Nicht mit einer Session verbunden" };
  if (z === "verbinde") return { farbe: "warn", text: "Verbinde mit der Session …" };
  const frisch = (t) => t && jetzt - t < FRISCH;
  const spiel = [frisch(letzteCs2) && "CS2", frisch(letzteRl) && "Rocket League", ...Object.entries(weitere).filter(([, t]) => frisch(t)).map(([n]) => n)].filter(Boolean).join(" + ");
  if (!spiel) return { farbe: "warn", text: `Session „${client.session || "?"}“ ok, kein Spiel liefert Daten` };
  return { farbe: "ok", text: `${spiel} → Session „${client.session || "?"}“, ${client.gesendet || 0} Events gesendet` };
}

module.exports = { overlayStatus, FRISCH };
