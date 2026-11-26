"use strict";
// Sound-Bibliothek der Regie und das Ziel „Local Sound“ (core/ziel-typen.js). Sounds laufen wie OSC-Befehle:
// Tab „Ziele“ → Local Sound (Ausgabegerät, Lautstärke, Bibliothek), Tab „Signale“ → je Event „Sound abspielen“ mit Datei(en).
// Die Dateien liegen auf dem Regie-PC und werden nicht mit der App ausgeliefert. Reine Funktionen ohne Node-Abhängigkeiten.
//
// regie.sound = {
//   dateien: [{ id, spiel, event, pfad, url, name }]  // Bibliothek; event: Ordner-Zuordnung, Vorschlag im Tab „Signale“
//   umgezogen,           // alte Einstellungen (bis 1.0.7: Sounds direkt am Event) sind ins Ziel „Local Sound“ übernommen
//   an, nurScharf, geraet, geraetName, lautstaerke, abbrechen, beimTest  // bis 1.0.7, nur noch für den Umzug gelesen
// }
const { SPIEL_BY_ID } = require("./spiele");

const SOUND_ENDUNGEN = ["wav", "mp3", "ogg", "oga", "m4a", "aac", "flac", "opus", "webm"];
const MAX_DATEIEN = 500;

const standardSound = () => ({ an: false, nurScharf: true, geraet: "", geraetName: "", lautstaerke: 1, abbrechen: true, beimTest: true, umgezogen: true, dateien: [] });

const istSound = (name) => SOUND_ENDUNGEN.includes(String(name || "").split(".").pop().toLowerCase());
const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/[\s\-.]+/g, "_");

// Ordnernamen, die nicht genau eine Event-ID sind → Event-ID (je Spiel, sonst für alle)
const ORDNER_ALIAS = {
  valorant: { spike_planted: "spike_planted", plant: "spike_planted", defuse: "spike_defused", detonate: "spike_detonated", explode: "spike_detonated", spike_exploded: "spike_detonated", round_start: "round_start", buy: "round_start", combat: "round_combat", barrier: "round_combat", round_combat: "round_combat", victory: "match_won", win: "match_won" },
  "*": { kills: "kill", deaths: "death", death: "death", headshots: "headshot", aces: "ace", match_end: "match_end", matchstart: "match_start", matchend: "match_end", round_win: "round_end" },
};

// Ordner- oder Dateiname → Event-ID des Spiels oder ""
function eventVonOrdner(spiel, ordner) {
  const n = norm(ordner);
  if (!n) return "";
  const events = SPIEL_BY_ID[spiel]?.events || [];
  if (events.some((e) => e.id === n)) return n;
  const alias = ORDNER_ALIAS[spiel]?.[n] || ORDNER_ALIAS["*"][n];
  return alias && events.some((e) => e.id === alias) ? alias : "";
}

const uid = () => Math.random().toString(36).slice(2, 10);

// Gefundene Dateien eines Ordners ({ pfad, url, name, ordner }) → Einträge für das Spiel. Bekannte Pfade bleiben, wie sie sind
// (an/aus und Zuordnung gehen nicht verloren). Neu gefundene starten aus: man schaltet bewusst ein, was laufen soll.
function dateienAufnehmen(sound, spiel, gefunden) {
  const s = migrateSound(sound);
  const bekannt = new Set(s.dateien.map((d) => d.pfad));
  const neu = (gefunden || []).filter((f) => f && typeof f.pfad === "string" && istSound(f.pfad) && !bekannt.has(f.pfad))
    .map((f) => ({ id: uid(), spiel, event: f.event ?? eventVonOrdner(spiel, f.ordner), pfad: f.pfad, url: f.url || "", name: f.name || f.pfad.split(/[\\/]/).pop(), an: false }));
  return { ...s, dateien: [...s.dateien, ...neu].slice(0, MAX_DATEIEN), neu: neu.length };
}

// Dateien eines Spiels nach Event gruppiert: [{ event, dateien }], Reihenfolge wie im Spiel, nicht zugeordnete am Ende
function nachEvent(sound, spiel) {
  const dateien = migrateSound(sound).dateien.filter((d) => d.spiel === spiel);
  const reihenfolge = (SPIEL_BY_ID[spiel]?.events || []).map((e) => e.id);
  const gruppen = new Map();
  for (const d of dateien) { const k = d.event || ""; if (!gruppen.has(k)) gruppen.set(k, []); gruppen.get(k).push(d); }
  const rang = (k) => (k === "" ? Infinity : reihenfolge.indexOf(k) === -1 ? 1e6 : reihenfolge.indexOf(k));
  return [...gruppen.entries()].sort((a, b) => rang(a[0]) - rang(b[0])).map(([event, liste]) => ({ event, dateien: liste }));
}

// Wert des Parameters „datei“ (eine Datei je Zeile) ↔ Liste der Pfade
const dateiListe = (wert) => String(wert ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const dateiWert = (pfade) => [...new Set(pfade)].join("\n");

// Nachricht des Ziels Local Sound → was zu tun ist: { art: "spielen", datei } | { art: "stopp" } | { art: "test" } | { art: "fehler", text }
// Bei mehreren Dateien eine zufällig (rnd 0 … 1). Die Datei muss in der Bibliothek stehen (dort steht ihre URL).
function soundAktion(sound, nachricht, rnd = Math.random()) {
  const a = String(nachricht?.address || "");
  if (a === "/sound/stop") return { art: "stopp" };
  if (a === "/sound/test") return { art: "test" };
  if (a !== "/sound/play") return { art: "fehler", text: `Unbekannter Sound-Befehl ${a}` };
  const pfade = dateiListe(nachricht.args?.[0]?.value);
  if (!pfade.length) return { art: "fehler", text: "Keine Datei gewählt" };
  const bib = sound?.dateien || [];
  const da = pfade.map((p) => bib.find((d) => d.pfad === p)).filter((d) => d && d.url);
  if (!da.length) return { art: "fehler", text: `Datei nicht in der Sound-Bibliothek: ${pfade[0].split(/[\\/]/).pop()}` };
  return { art: "spielen", datei: da[Math.min(da.length - 1, Math.floor(rnd * da.length))] };
}

// Optionen des Ziels → Einstellungen für den Player { geraet, lautstaerke 0 … 1, abbrechen }
function zielEinstellung(ziel) {
  const o = ziel?.optionen || {};
  const n = Number(String(o.lautstaerke ?? "100").replace(",", "."));
  return { geraet: String(o.geraet || ""), geraetName: String(o.geraetName || ""), lautstaerke: Number.isFinite(n) ? Math.max(0, Math.min(100, n)) / 100 : 1, abbrechen: o.abbrechen !== "nein" };
}

// Vorschlag für „Sound abspielen“ an einem Event: die Dateien, deren Ordner zu diesem Event gehört
const vorschlagFuer = (sound, spiel, event) => (sound?.dateien || []).filter((d) => d.spiel === spiel && d.event === event).map((d) => d.pfad);

// Bis 1.0.7 hingen Sounds direkt an den Events. Einmalig: Ziel „Local Sound“ mit Gerät und Lautstärke anlegen und
// je Event mit eingeschalteten Dateien eine Zuweisung „Sound abspielen“ (mehrere Dateien: zufällig eine, wie vorher).
// Waren die Sounds aus, entsteht nur das Ziel. r: regie-Einstellungen (wird geändert), uidFn: neue IDs.
function soundUmziehen(r, uidFn) {
  const s = r.sound;
  if (!s || s.umgezogen) return r;
  s.umgezogen = true;
  if (!s.dateien?.length || (r.targets || []).some((t) => t.typ === "sound")) return r;
  const ziel = { id: uidFn(), typ: "sound", name: "Local Sound", host: "", port: 0, netz: "",
    optionen: { geraet: s.geraet || "", geraetName: s.geraetName || "", lautstaerke: String(Math.round((s.lautstaerke ?? 1) * 100)), abbrechen: s.abbrechen === false ? "nein" : "ja" } };
  r.targets = [...(r.targets || []), ziel];
  if (!s.an) return r;
  const gruppen = new Map();
  for (const d of s.dateien) if (d.an && d.event) { const k = `${d.spiel}\t${d.event}`; if (!gruppen.has(k)) gruppen.set(k, []); gruppen.get(k).push(d.pfad); }
  r.signale = r.signale || {};
  for (const [k, pfade] of gruppen) {
    const [spiel, event] = k.split("\t");
    const sp = (r.signale[spiel] = r.signale[spiel] || {});
    (sp[event] = Array.isArray(sp[event]) ? sp[event] : []).push({ id: uidFn(), ziel: ziel.id, befehl: "abspielen", werte: { datei: dateiWert(pfade) }, pc: "", team: "" });
  }
  return r;
}

function migrateSound(s) {
  const d = standardSound();
  if (!s || typeof s !== "object") return d;
  const zahl = Number(s.lautstaerke);
  return {
    an: s.an === true,
    nurScharf: s.nurScharf !== false,
    geraet: typeof s.geraet === "string" ? s.geraet : "",
    geraetName: typeof s.geraetName === "string" ? s.geraetName : "",
    lautstaerke: Number.isFinite(zahl) ? Math.max(0, Math.min(1, zahl)) : 1,
    abbrechen: s.abbrechen !== false,
    beimTest: s.beimTest !== false,
    umgezogen: s.umgezogen === true,
    dateien: (Array.isArray(s.dateien) ? s.dateien : []).filter((x) => x && typeof x.pfad === "string" && typeof x.spiel === "string").slice(0, MAX_DATEIEN)
      .map((x) => ({ id: typeof x.id === "string" && x.id ? x.id : uid(), spiel: x.spiel, event: typeof x.event === "string" ? x.event : "", pfad: x.pfad, url: typeof x.url === "string" ? x.url : "", name: typeof x.name === "string" && x.name ? x.name : x.pfad.split(/[\\/]/).pop(), an: x.an === true })),
  };
}

module.exports = { dateiListe, dateiWert, soundAktion, zielEinstellung, vorschlagFuer, soundUmziehen, SOUND_ENDUNGEN, MAX_DATEIEN, standardSound, migrateSound, istSound, eventVonOrdner, dateienAufnehmen, nachEvent };
