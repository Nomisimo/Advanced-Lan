"use strict";
// Sound-Player der Regie: spielt beim Auslösen eines Events eine Audiodatei auf einem wählbaren Ausgabegerät
// (z. B. Dante Virtual Soundcard). Die Dateien liegen auf dem Regie-PC und werden nicht mit der App ausgeliefert.
// Einstellungen im Tab „Stats-Screen“ unter „Sound“. Reine Funktionen ohne Node-Abhängigkeiten.
//
// regie.sound = {
//   an,                  // Sounds überhaupt abspielen
//   nurScharf,           // nur wenn die Ausgabe scharf ist (wie die OSC-Befehle)
//   geraet,              // deviceId des Ausgabegeräts, "" = Standardgerät von Windows/macOS
//   geraetName,          // Name dazu (zur Anzeige, falls das Gerät gerade fehlt)
//   lautstaerke,         // 0 … 1
//   abbrechen,           // ein neuer Sound beendet den laufenden
//   beimTest,            // Tab „Signale“: der Test-Knopf spielt die Sounds des Events mit
//   dateien: [{ id, spiel, event, pfad, url, name, an }]  // event "" = keinem Event zugeordnet
// }
const { SPIEL_BY_ID } = require("./spiele");

const SOUND_ENDUNGEN = ["wav", "mp3", "ogg", "oga", "m4a", "aac", "flac", "opus", "webm"];
const MAX_DATEIEN = 500;

const standardSound = () => ({ an: false, nurScharf: true, geraet: "", geraetName: "", lautstaerke: 1, abbrechen: true, beimTest: true, dateien: [] });

const istSound = (name) => SOUND_ENDUNGEN.includes(String(name || "").split(".").pop().toLowerCase());
const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/[\s\-.]+/g, "_");

// Ordnernamen, die nicht genau eine Event-ID sind → Event-ID (je Spiel, sonst für alle)
const ORDNER_ALIAS = {
  valorant: { spike_planted: "spike_planted", plant: "spike_planted", defuse: "spike_defused", detonate: "spike_detonated", explode: "spike_detonated", spike_exploded: "spike_detonated", round_start: "round_start", buy: "round_start", victory: "match_won", win: "match_won" },
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

// Event → Datei, die gespielt wird, oder null. Mehrere eingeschaltete Dateien: zufällig eine (rnd 0 … 1).
// eintrag: Log-Eintrag der Regie ({ ev, scharf, verworfen }).
function soundFuer(sound, eintrag, rnd = Math.random()) {
  const s = sound;
  const ev = eintrag?.ev;
  if (!s?.an || !ev?.type || eintrag.verworfen) return null;
  if (s.nurScharf !== false && !eintrag.scharf) return null;
  const passend = (s.dateien || []).filter((d) => d.an && d.spiel === ev.spiel && d.event === ev.type && d.url);
  if (!passend.length) return null;
  return passend[Math.min(passend.length - 1, Math.floor(rnd * passend.length))];
}

// Eingeschaltete Sounds eines Events (unabhängig von „Sounds an“ und scharfer Ausgabe)
const soundsVon = (sound, spiel, event) => (sound?.dateien || []).filter((d) => d.an && d.spiel === spiel && d.event === event && d.url);

// Test im Tab „Signale“: ein eingeschalteter Sound des Events, auch wenn „Sounds an“ aus oder die Ausgabe nicht scharf ist.
// Mit „beimTest“ aus: null.
function soundZumTest(sound, spiel, event, rnd = Math.random()) {
  if (!sound || sound.beimTest === false) return null;
  const l = soundsVon(sound, spiel, event);
  return l.length ? l[Math.min(l.length - 1, Math.floor(rnd * l.length))] : null;
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
    dateien: (Array.isArray(s.dateien) ? s.dateien : []).filter((x) => x && typeof x.pfad === "string" && typeof x.spiel === "string").slice(0, MAX_DATEIEN)
      .map((x) => ({ id: typeof x.id === "string" && x.id ? x.id : uid(), spiel: x.spiel, event: typeof x.event === "string" ? x.event : "", pfad: x.pfad, url: typeof x.url === "string" ? x.url : "", name: typeof x.name === "string" && x.name ? x.name : x.pfad.split(/[\\/]/).pop(), an: x.an === true })),
  };
}

module.exports = { SOUND_ENDUNGEN, MAX_DATEIEN, standardSound, migrateSound, istSound, eventVonOrdner, dateienAufnehmen, nachEvent, soundFuer, soundsVon, soundZumTest };
