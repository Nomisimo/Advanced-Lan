// Sound-Player der Regie (Hauptfenster): spielt bei jedem neuen Event die passende Datei auf dem gewählten Ausgabegerät.
// Welche Datei, entscheidet core/sound.js. Das Gerät wird über HTMLMediaElement.setSinkId gewählt (Chromium/Electron).
import { useEffect, useRef } from "react";
import { api } from "../api.js";
import { soundFuer } from "../../core/sound.js";

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

// Hört auf die Events der Regie und spielt pro Log-Eintrag höchstens einmal (Fehler-Nachmeldungen haben dieselbe ID)
export function useSoundPlayer(sound, notify) {
  const ref = useRef(sound);
  ref.current = sound;
  useEffect(() => {
    const gespielt = new Set();
    return api.onRegieEvent((e) => {
      if (!e?.id || gespielt.has(e.id)) return;
      gespielt.add(e.id);
      if (gespielt.size > 500) gespielt.delete(gespielt.values().next().value);
      const datei = soundFuer(ref.current, e);
      if (datei) abspielen(datei, ref.current).catch((f) => notify?.(`Sound: ${f.message}`, "err"));
    });
  }, []);
}
