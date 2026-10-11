// Unsichtbares Erkennungsfenster des Game-PCs: nimmt den eingestellten Bildschirm auf und schickt je Bild die Signaturen
// der Bereiche (Auslöser aller Aktionen) an den Hauptprozess (src/main/bild.js). Bereiche mit Text gehen zusätzlich als PNG an die Texterkennung.
import { sigAus, istLeer, pngAus, bildGroesse } from "./bild.js";

const api = window.erkennungAPI;
const video = document.createElement("video");
video.muted = true;
let stream = null, timer = null, start = null, letzteTexte = 0, letzteLeer = 0, leer = false;

async function oeffnen(fps) {
  if (stream) return;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: fps, max: 10 } }, audio: false });
    video.srcObject = stream;
    await video.play();
    stream.getVideoTracks()[0]?.addEventListener("ended", () => { stream = null; api.status({ fehler: "Bildschirmaufnahme beendet" }); });
  } catch (e) {
    stream = null;
    api.status({ fehler: `Bildschirmaufnahme nicht möglich: ${e?.message || e}` });
  }
}

function bild() {
  if (!start || !stream || !video.videoWidth) return;
  const jetzt = Date.now();
  if (jetzt - letzteLeer > 2000) { leer = istLeer(video); letzteLeer = jetzt; }
  const sigs = {};
  for (const t of start.teile) sigs[t.key] = sigAus(video, t.region);
  const g = bildGroesse(video);
  api.frame({ t: jetzt, b: g.b, h: g.h, sigs, leer });
  // Texterkennung ist teurer: höchstens alle 700 ms
  if (jetzt - letzteTexte > 700) {
    letzteTexte = jetzt;
    for (const t of start.teile.filter((x) => x.text)) pngAus(video, t.region).then((png) => api.text(t.key, png)).catch(() => {});
  }
}

api.onStart(async (s) => {
  start = s;
  clearInterval(timer);
  await oeffnen(s.fps);
  timer = setInterval(bild, Math.round(1000 / s.fps));
});
