"use strict";
// Ziel-Datenbank: Software und Geräte, die OSC empfangen, mit ihren wichtigsten Befehlen.
// Grundlage ist die Recherche in docs/osc-ziele.md (Hersteller-Dokumentation, Stand Oktober 2026).
//
// Ein Befehl hat Parameter (Eingabefelder im Tab „Signale“) und eine oder mehrere OSC-Nachrichten.
// In Adressen und Argumenten stehen Platzhalter: {param} aus dem Befehl, {option} aus dem Ziel,
// {spieler} {team} {pc} {runde} {spiel} {event} aus dem Ereignis.
//   args:     feste Argumente [{ type: "i" | "f" | "s" | "T" | "F", value: "{param}" }]
//   argsFrei: Argumente als Text, z. B. "i:1 s:{spieler}" (für „Eigene Nachricht“)

const KATEGORIEN = [
  { id: "show", name: "Show-Steuerung" },
  { id: "licht", name: "Licht" },
  { id: "audio", name: "Audio" },
  { id: "video", name: "Video" },
  { id: "steuerung", name: "Steuerung" },
  { id: "allgemein", name: "Allgemein" },
];

const P = (key, label, standard = "", art = "text") => ({ key, label, standard, art });

// In jedem Ziel verfügbar: beliebige OSC-Nachricht
const EIGENE = {
  id: "eigene", label: "Eigene OSC-Nachricht",
  params: [P("adresse", "OSC-Adresse", "/advancedlan/{event}"), P("argumente", "Argumente", "s:{team} s:{spieler}")],
  osc: [{ address: "{adresse}", argsFrei: "{argumente}" }],
};

const ZIEL_TYPEN = [
  {
    id: "qlab", name: "QLab", hersteller: "Figure 53", kategorie: "show", port: 53, protokoll: "UDP",
    doku: "https://qlab.app/docs/v5/scripting/osc-dictionary-v5/",
    einrichten: "Workspace Settings → Network: OSC-Zugriff ohne Passcode erlauben (oder Passcode mit Rechten für „Control“). QLab hört auf UDP und TCP Port 53.",
    test: { address: "/thump" },
    befehle: [
      { id: "start", label: "Cue starten", params: [P("cue", "Cue-Nummer", "1")], osc: [{ address: "/cue/{cue}/start" }] },
      { id: "stop", label: "Cue stoppen", params: [P("cue", "Cue-Nummer", "1")], osc: [{ address: "/cue/{cue}/stop" }] },
      { id: "go", label: "GO (nächster Cue)", params: [], osc: [{ address: "/go" }] },
      { id: "goto", label: "Playhead auf Cue setzen", params: [P("cue", "Cue-Nummer", "1")], osc: [{ address: "/playhead/{cue}" }] },
      { id: "load", label: "Cue laden", params: [P("cue", "Cue-Nummer", "1")], osc: [{ address: "/cue/{cue}/load" }] },
      { id: "stopall", label: "Alles stoppen", params: [], osc: [{ address: "/stop" }] },
      { id: "panic", label: "Panic (ausblenden)", params: [], osc: [{ address: "/panic" }] },
    ],
  },
  {
    id: "ma3", name: "grandMA3", hersteller: "MA Lighting", kategorie: "licht", port: 8000, protokoll: "UDP",
    doku: "https://help.malighting.com/grandMA3/2.1/HTML/remote_inputs_osc.html",
    einrichten: "Menu → In & Out → OSC: Zeile anlegen mit Port 8000 und Prefix „gma3“, „Receive“ und „Receive Command“ einschalten, „Enable Input“ an.",
    optionen: [P("prefix", "Prefix", "gma3")],
    test: { address: "/{prefix}/cmd", args: [{ type: "s", value: "Echo \"Advanced LAN\"" }] },
    befehle: [
      { id: "goto_cue", label: "Sequenz: Cue anfahren", params: [P("seq", "Sequenz", "101", "zahl"), P("cue", "Cue", "1", "zahl")], osc: [{ address: "/{prefix}/cmd", args: [{ type: "s", value: "Goto Sequence {seq} Cue {cue}" }] }] },
      { id: "go", label: "Sequenz: Go+", params: [P("seq", "Sequenz", "101", "zahl")], osc: [{ address: "/{prefix}/cmd", args: [{ type: "s", value: "Go+ Sequence {seq}" }] }] },
      { id: "off", label: "Sequenz: Off", params: [P("seq", "Sequenz", "101", "zahl")], osc: [{ address: "/{prefix}/cmd", args: [{ type: "s", value: "Off Sequence {seq}" }] }] },
      { id: "flash", label: "Sequenz: Flash (kurz)", params: [P("seq", "Sequenz", "101", "zahl")], osc: [{ address: "/{prefix}/cmd", args: [{ type: "s", value: "Flash Sequence {seq}" }] }] },
      { id: "macro", label: "Makro starten", params: [P("macro", "Makro", "1", "zahl")], osc: [{ address: "/{prefix}/cmd", args: [{ type: "s", value: "Go+ Macro {macro}" }] }] },
      { id: "cmd", label: "Befehlszeile", params: [P("cmd", "Befehl", "Go+ Sequence 101 Cue 3")], osc: [{ address: "/{prefix}/cmd", args: [{ type: "s", value: "{cmd}" }] }] },
    ],
  },
  {
    id: "reaper", name: "REAPER", hersteller: "Cockos", kategorie: "audio", port: 8000, protokoll: "UDP",
    doku: "https://www.reaper.fm/sdk/osc/osc.php",
    einrichten: "Preferences → Control/OSC/web → Add → OSC: Mode „Local port“, Port 8000, Pattern „Default“. Audio-Clips als Marker oder Regionen anlegen.",
    befehle: [
      { id: "marker_play", label: "Audio ab Marker abspielen", params: [P("marker", "Marker", "1", "zahl")], osc: [{ address: "/marker", args: [{ type: "i", value: "{marker}" }] }, { address: "/play" }] },
      { id: "region_play", label: "Region abspielen", params: [P("region", "Region", "1", "zahl")], osc: [{ address: "/region", args: [{ type: "i", value: "{region}" }] }, { address: "/play" }] },
      { id: "play", label: "Play", params: [], osc: [{ address: "/play" }] },
      { id: "stop", label: "Stop", params: [], osc: [{ address: "/stop" }] },
      { id: "action", label: "Aktion ausführen (Action-ID)", params: [P("action", "Action-ID", "40044", "zahl")], osc: [{ address: "/action", args: [{ type: "i", value: "{action}" }] }] },
      { id: "mute", label: "Spur stumm", params: [P("track", "Spur", "1", "zahl"), P("an", "Stumm (1/0)", "1", "zahl")], osc: [{ address: "/track/{track}/mute", args: [{ type: "i", value: "{an}" }] }] },
    ],
  },
  {
    id: "eos", name: "Eos", hersteller: "ETC", kategorie: "licht", port: 8000, protokoll: "UDP",
    doku: "https://www.etcconnect.com/WebDocs/Controls/EosFamilyOnlineHelp/en/Content/23_Show_Control/08_OSC/Using_OSC_with_Eos/OSC_Overview.htm",
    einrichten: "Setup → System → Show Control → OSC: „OSC RX“ an, „OSC UDP RX Port“ 8000.",
    befehle: [
      { id: "fire", label: "Cue auslösen", params: [P("liste", "Cue-Liste", "1", "zahl"), P("cue", "Cue", "1", "zahl")], osc: [{ address: "/eos/cue/{liste}/{cue}/fire" }] },
      { id: "go", label: "GO", params: [], osc: [{ address: "/eos/key/go_0" }] },
      { id: "macro", label: "Makro auslösen", params: [P("macro", "Makro", "1", "zahl")], osc: [{ address: "/eos/macro/{macro}/fire" }] },
      { id: "cmd", label: "Befehlszeile", params: [P("cmd", "Befehl", "Go_To_Cue 1/3#")], osc: [{ address: "/eos/newcmd", args: [{ type: "s", value: "{cmd}" }] }] },
    ],
  },
  {
    id: "magicq", name: "MagicQ", hersteller: "ChamSys", kategorie: "licht", port: 8000, protokoll: "UDP",
    doku: "https://docs.chamsys.co.uk/magicq/remote-control/osc.html",
    einrichten: "Setup → View Settings → Network: „OSC mode“ auf „Rx and Tx“, „OSC rx port“ 8000.",
    befehle: [
      { id: "go", label: "Playback: Go", params: [P("pb", "Playback", "1", "zahl")], osc: [{ address: "/pb/{pb}/go" }] },
      { id: "cue", label: "Playback: Cue anfahren", params: [P("pb", "Playback", "1", "zahl"), P("cue", "Cue", "1", "zahl")], osc: [{ address: "/pb/{pb}/{cue}" }] },
      { id: "release", label: "Playback: Release", params: [P("pb", "Playback", "1", "zahl")], osc: [{ address: "/pb/{pb}/release" }] },
      { id: "flash", label: "Playback: Flash", params: [P("pb", "Playback", "1", "zahl"), P("an", "An (1/0)", "1", "zahl")], osc: [{ address: "/pb/{pb}/flash", args: [{ type: "i", value: "{an}" }] }] },
      { id: "level", label: "Playback: Level", params: [P("pb", "Playback", "1", "zahl"), P("level", "Level 0–100", "100", "zahl")], osc: [{ address: "/pb/{pb}", args: [{ type: "i", value: "{level}" }] }] },
    ],
  },
  {
    id: "resolume", name: "Resolume", hersteller: "Resolume (Arena, Avenue)", kategorie: "video", port: 7000, protokoll: "UDP",
    doku: "https://resolume.com/support/en/osc",
    einrichten: "Preferences → OSC: „OSC Input“ an, Port 7000.",
    befehle: [
      { id: "clip", label: "Clip starten", params: [P("layer", "Layer", "1", "zahl"), P("clip", "Clip", "1", "zahl")], osc: [{ address: "/composition/layers/{layer}/clips/{clip}/connect", args: [{ type: "i", value: "1" }] }] },
      { id: "column", label: "Spalte starten", params: [P("column", "Spalte", "1", "zahl")], osc: [{ address: "/composition/columns/{column}/connect", args: [{ type: "i", value: "1" }] }] },
      { id: "clear", label: "Layer leeren", params: [P("layer", "Layer", "1", "zahl")], osc: [{ address: "/composition/layers/{layer}/clear", args: [{ type: "i", value: "1" }] }] },
      { id: "deck", label: "Deck wählen", params: [P("deck", "Deck", "1", "zahl")], osc: [{ address: "/composition/decks/{deck}/select", args: [{ type: "i", value: "1" }] }] },
    ],
  },
  {
    id: "millumin", name: "Millumin", hersteller: "Anomes", kategorie: "video", port: 5000, protokoll: "UDP",
    doku: "https://help.millumin.com/docs/interactions/osc/",
    einrichten: "Menu Interaction → Device Manager → OSC: Input-Port 5000.",
    befehle: [
      { id: "column", label: "Spalte starten", params: [P("column", "Spalte", "1", "zahl")], osc: [{ address: "/millumin/action/launchColumn", args: [{ type: "i", value: "{column}" }] }] },
      { id: "stop", label: "Spalte stoppen", params: [], osc: [{ address: "/millumin/action/stopColumn" }] },
      { id: "media", label: "Medium in Layer starten", params: [P("layer", "Layer-Name", "Layer 1"), P("media", "Medium (Nr.)", "1", "zahl")], osc: [{ address: "/millumin/layer:{layer}/media", args: [{ type: "i", value: "{media}" }] }] },
    ],
  },
  {
    id: "companion", name: "Companion", hersteller: "Bitfocus", kategorie: "steuerung", port: 12321, protokoll: "UDP",
    doku: "https://bitfocus.io/companion",
    einrichten: "Settings → Protocols → OSC: „OSC Listener“ an, Port 12321. Companion steuert dann z. B. vMix, OBS, ATEM.",
    befehle: [
      { id: "press", label: "Taste drücken", params: [P("page", "Seite", "1", "zahl"), P("row", "Reihe", "0", "zahl"), P("column", "Spalte", "0", "zahl")], osc: [{ address: "/location/{page}/{row}/{column}/press" }] },
      { id: "down", label: "Taste halten", params: [P("page", "Seite", "1", "zahl"), P("row", "Reihe", "0", "zahl"), P("column", "Spalte", "0", "zahl")], osc: [{ address: "/location/{page}/{row}/{column}/down" }] },
      { id: "up", label: "Taste loslassen", params: [P("page", "Seite", "1", "zahl"), P("row", "Reihe", "0", "zahl"), P("column", "Spalte", "0", "zahl")], osc: [{ address: "/location/{page}/{row}/{column}/up" }] },
      { id: "text", label: "Tastentext setzen", params: [P("page", "Seite", "1", "zahl"), P("row", "Reihe", "0", "zahl"), P("column", "Spalte", "0", "zahl"), P("text", "Text", "{spieler}")], osc: [{ address: "/location/{page}/{row}/{column}/style/text", args: [{ type: "s", value: "{text}" }] }] },
      { id: "variable", label: "Variable setzen", params: [P("name", "Variable", "lan_event"), P("wert", "Wert", "{event}")], osc: [{ address: "/custom-variable/{name}/value", args: [{ type: "s", value: "{wert}" }] }] },
    ],
  },
  {
    id: "ableton", name: "Ableton Live (AbletonOSC)", hersteller: "Ableton", kategorie: "audio", port: 11000, protokoll: "UDP",
    doku: "https://github.com/ideoforms/AbletonOSC",
    einrichten: "AbletonOSC als Control Surface installieren und in Preferences → Link/Tempo/MIDI auswählen. Lauscht auf Port 11000.",
    befehle: [
      { id: "clip", label: "Clip starten", params: [P("track", "Spur (ab 0)", "0", "zahl"), P("clip", "Clip-Slot (ab 0)", "0", "zahl")], osc: [{ address: "/live/clip/fire", args: [{ type: "i", value: "{track}" }, { type: "i", value: "{clip}" }] }] },
      { id: "scene", label: "Szene starten", params: [P("scene", "Szene (ab 0)", "0", "zahl")], osc: [{ address: "/live/scene/fire", args: [{ type: "i", value: "{scene}" }] }] },
      { id: "play", label: "Play", params: [], osc: [{ address: "/live/song/start_playing" }] },
      { id: "stop", label: "Stop", params: [], osc: [{ address: "/live/song/stop_playing" }] },
    ],
  },
  {
    id: "x32", name: "X32 / M32", hersteller: "Behringer / Midas", kategorie: "audio", port: 10023, protokoll: "UDP",
    doku: "https://wiki.munichmakerlab.de/images/1/17/UNOFFICIAL_X32_OSC_REMOTE_PROTOCOL_%281%29.pdf",
    einrichten: "Keine Einrichtung nötig: das Pult hört immer auf Port 10023 (XR-Serie: 10024).",
    befehle: [
      { id: "mute", label: "Kanal stumm", params: [P("ch", "Kanal (01–32)", "01"), P("an", "Stumm (1/0)", "1", "zahl")], osc: [{ address: "/ch/{ch}/mix/on", args: [{ type: "i", value: "{an}" }] }] },
      { id: "fader", label: "Kanal-Fader", params: [P("ch", "Kanal (01–32)", "01"), P("wert", "Fader 0.0–1.0", "0.75", "zahl")], osc: [{ address: "/ch/{ch}/mix/fader", args: [{ type: "f", value: "{wert}" }] }] },
      { id: "scene", label: "Szene laden", params: [P("scene", "Szene", "1", "zahl")], osc: [{ address: "/-action/goscene", args: [{ type: "i", value: "{scene}" }] }] },
    ],
  },
  {
    id: "touchdesigner", name: "TouchDesigner", hersteller: "Derivative", kategorie: "video", port: 10000, protokoll: "UDP",
    doku: "https://docs.derivative.ca/OSC_In_CHOP",
    einrichten: "Einen „OSC In DAT“ oder „OSC In CHOP“ mit dem Port anlegen. Adressen frei wählbar.",
    befehle: [
      { id: "event", label: "Ereignis senden", params: [P("adresse", "OSC-Adresse", "/lan/{event}")], osc: [{ address: "{adresse}", args: [{ type: "s", value: "{team}" }, { type: "s", value: "{spieler}" }, { type: "s", value: "{pc}" }] }] },
    ],
  },
  {
    id: "osc", name: "Allgemeines OSC-Gerät", hersteller: "", kategorie: "allgemein", port: 8000, protokoll: "UDP",
    doku: "https://opensoundcontrol.stanford.edu/spec-1_0.html",
    einrichten: "Für alles, was OSC per UDP empfängt. Adresse und Argumente frei eintragen.",
    befehle: [],
  },
];

const BY_ID = Object.fromEntries(ZIEL_TYPEN.map((t) => [t.id, t]));
const zielTyp = (id) => BY_ID[id] || BY_ID.osc;
const befehleVon = (typId) => [...zielTyp(typId).befehle, EIGENE];
const befehlVon = (typId, befehlId) => befehleVon(typId).find((b) => b.id === befehlId) || null;

module.exports = { ZIEL_TYPEN, KATEGORIEN, zielTyp, befehleVon, befehlVon, EIGENE };
