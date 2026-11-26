// Sound-Player der Regie (Hauptfenster) für das Ziel „Local Sound“: spielt Dateien auf dem Ausgabegerät des Ziels.
// Welche Datei, entscheidet core/sound.js (soundAktion). Das Gerät wird über HTMLMediaElement.setSinkId gewählt (Chromium/Electron).
import { useEffect, useRef } from "react";
import { api } from "../api.js";
import { soundAktion, zielEinstellung } from "../../core/sound.js";

const laufend = new Set();
const gestoppt = new WeakSet(); // von stoppen() angehalten: ein abgebrochenes play() ist dann kein Fehler
// „Neuer Sound beendet laufenden“ gilt je Event: Sounds desselben Events (gleiche Log-ID) laufen zusammen,
// ein Sound aus einem neueren Event beendet sie. auftrag zählt die Events, damit ein älterer Sound,
// der noch auf sein Ausgabegerät wartet, nach einem neueren nicht doch noch startet.
let aktuell = null, auftrag = 0;

// Eine Datei abspielen. sound: Einstellungen (Gerät, Lautstärke, abbrechen). ereignis: ID des auslösenden Events (ohne: eigener Start).
// → Promise mit dem Audio-Element (null, wenn schon ein neuerer Sound dran ist), lehnt mit Fehlertext ab
export async function abspielen(datei, sound = {}, ereignis = null) {
  if (!datei?.url) throw new Error("Datei fehlt");
  const abbrechen = sound.abbrechen !== false;
  if (abbrechen && (ereignis == null || ereignis !== aktuell)) { aktuell = ereignis; auftrag++; stoppen(); }
  const nr = auftrag;
  const a = new Audio(datei.url);
  a.volume = Math.max(0, Math.min(1, Number(sound.lautstaerke ?? 1)));
  if (sound.geraet && typeof a.setSinkId === "function") {
    try { await a.setSinkId(sound.geraet); } catch (e) { throw new Error(`Ausgabegerät nicht verfügbar (${e.message})`); }
  }
  if (abbrechen && nr !== auftrag) return null; // während des Wartens auf das Gerät kam ein neueres Event
  laufend.add(a);
  a.onended = a.onerror = () => laufend.delete(a);
  try { await a.play(); } catch (e) {
    if (gestoppt.has(a)) return null; // schon wieder gestoppt (neueres Event oder Stopp): kein Fehler
    laufend.delete(a); throw new Error(`Datei lässt sich nicht abspielen: ${datei.name} (${e.message})`);
  }
  return a;
}

export function stoppen() {
  for (const a of laufend) { gestoppt.add(a); try { a.pause(); a.currentTime = 0; } catch {} }
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
    abspielen(datei, e, a.art === "test" ? null : m?.ereignis ?? null).catch((f) => notify?.(`Sound: ${f.message}`, "err"));
  }), []);
}
