"use strict";
// Valorant über die Overwolf-App „Automation Overdrive“ (Raimen TTV). Die App verbindet sich per WebSocket mit
// ws://localhost:44206 (dort lauscht sonst ihr Touch-Portal-Plugin) und schickt jedes Overwolf-Event im
// Touch-Portal-Format, z. B. {"type":"stateUpdate","id":"overwolfEvent","value":"kill"}. Danach setzt das Plugin
// den Wert wieder auf "". Diese App nimmt den Platz des Plugins ein: Touch Portal ist nicht nötig.
// Reine Funktionen ohne Node-Abhängigkeiten: laufen im Hauptprozess, in der Oberfläche und in den Tests.

const OVERDRIVE_PORT = 44206;
const OVERDRIVE_STATE = "overwolfEvent";

// Overwolf-Event → Event der Valorant-Quelle (bild-spiele.js). Andere Spiele (goal, knockdown …) werden ignoriert.
const OVERDRIVE_EVENTS = { kill: "kill", death: "death", assist: "assist", headshot: "headshot", match_start: "match_start", match_end: "match_end" };

// Eine Nachricht der App → Event-ID oder null. Nimmt auch reinen Text („kill“), falls die App das Format ändert.
function overdriveEvent(text) {
  let wert = String(text ?? "").trim();
  if (wert.startsWith("{")) {
    let m;
    try { m = JSON.parse(wert); } catch { return null; }
    if (!m || typeof m.value !== "string") return null;
    if (m.id != null && m.id !== OVERDRIVE_STATE) return null;
    wert = m.value.trim();
  }
  return OVERDRIVE_EVENTS[wert.toLowerCase()] || null;
}

module.exports = { OVERDRIVE_PORT, OVERDRIVE_STATE, OVERDRIVE_EVENTS, overdriveEvent };
