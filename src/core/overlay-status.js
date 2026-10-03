"use strict";
// Ampel für das Mini-Overlay des Game-PCs: grün = alles läuft, orange = wartet, rot = gestört.

const FRISCH = 15000; // ms: so lange gelten Spieldaten als aktuell

function overlayStatus({ client = {}, gsi = {}, rl = {}, letzteCs2 = 0, letzteRl = 0, jetzt = Date.now() }) {
  const z = client.zustand;
  if (gsi.fehler) return { farbe: "err", text: `CS2-Empfang gestört: ${gsi.fehler}` };
  if (z === "abgelehnt") return { farbe: "err", text: `Session abgelehnt${client.grund ? `: ${client.grund}` : ""}` };
  if (z !== "verbunden" && z !== "verbinde") return { farbe: "err", text: "Nicht mit einer Session verbunden" };
  if (z === "verbinde") return { farbe: "warn", text: "Verbinde mit der Session …" };
  const cs2 = letzteCs2 && jetzt - letzteCs2 < FRISCH, rocket = letzteRl && jetzt - letzteRl < FRISCH;
  if (!cs2 && !rocket) return { farbe: "warn", text: `Session „${client.session || "?"}“ ok, kein Spiel liefert Daten` };
  const spiel = [cs2 && "CS2", rocket && "Rocket League"].filter(Boolean).join(" + ");
  return { farbe: "ok", text: `${spiel} → Session „${client.session || "?"}“, ${client.gesendet || 0} Events gesendet` };
}

module.exports = { overlayStatus, FRISCH };
