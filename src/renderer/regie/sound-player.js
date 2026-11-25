// Sound-Player der Regie (Hauptfenster) für das Ziel „Local Sound“: spielt Dateien auf dem Ausgabegerät des Ziels.
// Welche Datei, entscheidet core/sound.js (soundAktion). Das Gerät wird über HTMLMediaElement.setSinkId gewählt (Chromium/Electron).
import { useEffect, useRef } from "react";
import { api } from "../api.js";
import { soundAktion, zielEinstellung } from "../../core/sound.js";

const laufend = new Set();

// Eine Datei abspielen. sound: Einstellungen (Gerät, Lautstärke, abbrechen). → Promise, lehnt mit Fehlertext ab
export async function abspielen(datei, sound = {}) {
  if (!datei?.url) throw new Error("Datei fehlt");
  if (sound.abbrechen !== false) stoppen();
  const a = new Audio(datei.url);
  a.volume = Math.max(0, Math.min(1, Number(sound.lautstaerke ?? 1)));
  if (sound.geraet && typeof a.setSinkId === "function") {
    try { await a.setSinkId(sound.geraet); } catch (e) { throw new Error(`Ausgabegerät nicht verfügbar (${e.message})`); }
  }
  laufend.add(a);
  a.onended = a.onerror = () => laufend.delete(a);
  try { await a.play(); } catch (e) { laufend.delete(a); throw new Error(`Datei lässt sich nicht abspielen: ${datei.name} (${e.message})`); }
  return a;
}

export function stoppen() {
  for (const a of laufend) { try { a.pause(); a.currentTime = 0; } catch {} }
  laufend.clear();
}

// Ausgabegeräte: [{ id, name }]. Ohne Berechtigung liefert Chromium manchmal leere Namen: dann „Gerät n“.
export async function ausgabeGeraete() {
  try {
    const alle = await navigator.mediaDevices?.enumerateDevices?.();
    return (alle || []).filter((d) => d.kind === "audiooutput" && d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications")
      .map((d, i) => ({ id: d.deviceId, name: d.label || `Gerät ${i + 1}` }));
  } catch { return []; }
}

// Kurzer Testton (440 Hz, 0,4 s) als WAV, damit „Test“ beim Ziel ohne Datei etwas auf dem Gerät hörbar macht
let testUrl = "";
function testton() {
  if (testUrl) return testUrl;
  const rate = 22050, n = Math.round(rate * 0.4), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const txt = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); txt(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); txt(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin((2 * Math.PI * 440 * i) / rate) * 12000 * Math.min(1, (n - i) / 2000), true);
  testUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  return testUrl;
}

// Ziel „Local Sound“: die Regie schickt jede Nachricht dieses Ziels hierher (sound-ausgabe). Was gespielt wird, sagt core/sound.js.
// bibliothek: cfg.sound (Dateien mit URL). Nur im Hauptfenster der Regie, nicht im Pop-out oder NDI.
export function useLocalSound(bibliothek, notify) {
  const ref = useRef(bibliothek);
  ref.current = bibliothek;
  useEffect(() => api.onSoundAusgabe?.((m) => {
    const a = soundAktion(ref.current, m), e = zielEinstellung(m?.ziel);
    if (a.art === "stopp") return stoppen();
    if (a.art === "fehler") return notify?.(`Sound: ${a.text}`, "err");
    const datei = a.art === "test" ? { url: testton(), name: "Testton" } : a.datei;
    abspielen(datei, e).catch((f) => notify?.(`Sound: ${f.message}`, "err"));
  }), []);
}
