"use strict";
// Ziel-Datenbank: Software und Geräte, die OSC empfangen, mit ihren wichtigsten Befehlen.
// Grundlage ist die Recherche in docs/osc-ziele.md (Hersteller-Dokumentation, Stand Oktober 2026).
// vorab: Nachrichten vor jedem Befehl, nur wenn die Ziel-Option „nurWenn“ gesetzt ist (QLab-Passcode).
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
    id: "qlab", name: "QLab 5", hersteller: "Figure 53", kategorie: "show", port: 53000, protokoll: "UDP",
    doku: "https://qlab.app/docs/v5/scripting/osc-dictionary-v5/",
    einrichten: "Workspace Settings → Network: OSC-Zugriff erlauben. Hat jeder offene Workspace einen Passcode, den Passcode hier beim Ziel eintragen; die App sendet dann vor jedem Befehl /connect.",
    optionen: [P("passcode", "Passcode", "")],
    vorab: [{ address: "/connect", args: [{ type: "s", value: "{passcode}" }], nurWenn: "passcode" }],
    test: { address: "/thump" },
    befehle: [
      { id: "start", label: "Cue starten", params: [P("cue", "Cue-Nummer", "1")], osc: [{ address: "/cue/{cue}/start" }] },
      { id: "stop", label: "Cue stoppen", params: [P("cue", "Cue-Nummer", "1")], osc: [{ address: "/cue/{cue}/stop" }] },
      { id: "go", label: "GO (nächster Cue)", params: [], osc: [{ address: "/go" }] },
      { id: "go_cue", label: "GO ab Cue", params: [P("cue", "Cue-Nummer", "1")], osc: [{ address: "/go", args: [{ type: "s", value: "{cue}" }] }] },
      { id: "goto", label: "Playhead auf Cue", params: [P("cue", "Cue-Nummer", "1")], osc: [{ address: "/playhead/{cue}" }] },
      { id: "load", label: "Cue laden", params: [P("cue", "Cue-Nummer", "1")], osc: [{ address: "/cue/{cue}/load" }] },
      { id: "pause", label: "Alles pausieren", params: [], osc: [{ address: "/pause" }] },
      { id: "resume", label: "Alles fortsetzen", params: [], osc: [{ address: "/resume" }] },
      { id: "stopall", label: "Alles stoppen", params: [], osc: [{ address: "/stop" }] },
      { id: "panic", label: "Panic (ausblenden)", params: [], osc: [{ address: "/panic" }] },
    ],
  },
  {
    id: "ma3", name: "grandMA3", hersteller: "MA Lighting", kategorie: "licht", port: 8000, protokoll: "UDP",
    doku: "https://help.malighting.com/grandMA3/2.3/HTML/remote_inputs_osc.html",
    einrichten: "Menu → In & Out → OSC: Zeile anlegen, Mode UDP, Port 8000, Prefix wie hier beim Ziel (ohne /). „Enable Input“, „Receive“ und „Receive Command“ auf Yes.",
    optionen: [P("prefix", "Prefix", "gma3")],
    test: { address: "/{prefix}/cmd", args: [{ type: "s", value: "Echo \"Advanced LAN\"" }] },
    befehle: [
      { id: "goto_cue", label: "Sequenz: Cue anfahren", params: [P("seq", "Sequenz", "101", "zahl"), P("cue", "Cue", "1", "zahl")], osc: [{ address: "/{prefix}/cmd", args: [{ type: "s", value: "Goto Sequence {seq} Cue {cue}" }] }] },
      { id: "go", label: "Sequenz: Go+", params: [P("seq", "Sequenz", "101", "zahl")], osc: [{ address: "/{prefix}/cmd", args: [{ type: "s", value: "Go+ Sequence {seq}" }] }] },
      { id: "off", label: "Sequenz: Off", params: [P("seq", "Sequenz", "101", "zahl")], osc: [{ address: "/{prefix}/cmd", args: [{ type: "s", value: "Off Sequence {seq}" }] }] },
      { id: "flash", label: "Sequenz: Flash", params: [P("seq", "Sequenz", "101", "zahl")], osc: [{ address: "/{prefix}/cmd", args: [{ type: "s", value: "Flash Sequence {seq}" }] }] },
      { id: "macro", label: "Makro starten", params: [P("macro", "Makro", "1", "zahl")], osc: [{ address: "/{prefix}/cmd", args: [{ type: "s", value: "Go+ Macro {macro}" }] }] },
      { id: "fader", label: "Executor-Fader", params: [P("page", "Seite", "1", "zahl"), P("exec", "Executor", "201", "zahl"), P("wert", "Wert 0–100", "100", "zahl")], osc: [{ address: "/{prefix}/Page{page}/Fader{exec}", args: [{ type: "i", value: "{wert}" }] }] },
      { id: "cmd", label: "Befehlszeile", params: [P("cmd", "Befehl", "Go+ Exec 201")], osc: [{ address: "/{prefix}/cmd", args: [{ type: "s", value: "{cmd}" }] }] },
    ],
  },
  {
    id: "eos", name: "Eos", hersteller: "ETC (Eos, Ion, Element, Nomad)", kategorie: "licht", port: 8000, protokoll: "UDP",
    doku: "https://support.etcconnect.com/ETC/Consoles/Eos_Family/Software_and_Programming/Triggering_Eos_from_QLab_using_OSC",
    einrichten: "Setup → System Settings → Show Control → OSC: „OSC RX“ an, „OSC UDP RX Port“ 8000. Setup → Device Settings → Network: „UDP Strings & OSC“ einschalten.",
    befehle: [
      { id: "fire", label: "Cue auslösen", params: [P("liste", "Cue-Liste", "1", "zahl"), P("cue", "Cue", "1", "zahl")], osc: [{ address: "/eos/cue/{liste}/{cue}/fire" }] },
      { id: "go", label: "GO", params: [], osc: [{ address: "/eos/key/go_0" }] },
      { id: "sub", label: "Submaster voll", params: [P("sub", "Submaster", "1", "zahl")], osc: [{ address: "/eos/sub/{sub}/full" }] },
      { id: "macro", label: "Makro auslösen", params: [P("macro", "Makro", "1", "zahl")], osc: [{ address: "/eos/macro/{macro}/fire" }] },
      { id: "cmd", label: "Befehlszeile", params: [P("cmd", "Befehl", "Go_To_Cue 1/3#")], osc: [{ address: "/eos/newcmd", args: [{ type: "s", value: "{cmd}" }] }] },
    ],
  },
  {
    id: "magicq", name: "MagicQ", hersteller: "ChamSys", kategorie: "licht", port: 8000, protokoll: "UDP",
    doku: "https://docs.chamsys.co.uk/magicq/manual/OSC.html",
    einrichten: "Setup → View Settings → Network: OSC-Modus einschalten, „OSC rx port“ 8000. Per OSC erreichbar sind die Playbacks 1 bis 10.",
    befehle: [
      { id: "go", label: "Playback: Go", params: [P("pb", "Playback 1–10", "1", "zahl")], osc: [{ address: "/pb/{pb}/go" }] },
      { id: "cue", label: "Playback: Cue anfahren", params: [P("pb", "Playback 1–10", "1", "zahl"), P("cue", "Cue", "1", "zahl")], osc: [{ address: "/pb/{pb}/{cue}" }] },
      { id: "release", label: "Playback: Release", params: [P("pb", "Playback 1–10", "1", "zahl")], osc: [{ address: "/pb/{pb}/release" }] },
      { id: "flash", label: "Playback: Flash", params: [P("pb", "Playback 1–10", "1", "zahl"), P("an", "An (1/0)", "1", "zahl")], osc: [{ address: "/pb/{pb}/flash", args: [{ type: "i", value: "{an}" }] }] },
      { id: "level", label: "Playback: Level", params: [P("pb", "Playback 1–10", "1", "zahl"), P("level", "Level 0–100", "100", "zahl")], osc: [{ address: "/pb/{pb}", args: [{ type: "i", value: "{level}" }] }] },
    ],
  },
  {
    id: "hog4", name: "Hog 4", hersteller: "ETC / High End", kategorie: "licht", port: 7001, protokoll: "UDP",
    doku: "https://www.etcconnect.com/webdocs/Controls/HOG/HTML/en/sect-osc_mappings.htm",
    einrichten: "Setup → Network, Rechtsklick auf die Konsole → Settings → Open Sound Control: „OSC In“ an und den Port eintragen. Einen Standard-Port gibt es nicht; hier 7001 voreingestellt.",
    befehle: [
      { id: "go", label: "Cueliste: Go", params: [P("liste", "Cueliste", "1", "zahl")], osc: [{ address: "/hog/playback/go/0", args: [{ type: "i", value: "{liste}" }] }] },
      { id: "go_cue", label: "Cueliste: Cue anfahren", params: [P("liste", "Cueliste", "1", "zahl"), P("cue", "Cue", "1", "zahl")], osc: [{ address: "/hog/playback/go/0", args: [{ type: "f", value: "{liste}.{cue}" }] }] },
      { id: "halt", label: "Cueliste: Halt", params: [P("liste", "Cueliste", "1", "zahl")], osc: [{ address: "/hog/playback/halt/0", args: [{ type: "i", value: "{liste}" }] }] },
      { id: "release", label: "Cueliste: Release", params: [P("liste", "Cueliste", "1", "zahl")], osc: [{ address: "/hog/playback/release/0", args: [{ type: "i", value: "{liste}" }] }] },
      { id: "scene", label: "Szene: Go", params: [P("scene", "Szene", "1", "zahl")], osc: [{ address: "/hog/playback/go/1", args: [{ type: "i", value: "{scene}" }] }] },
    ],
  },
  {
    id: "lightkey", name: "Lightkey", hersteller: "Lightkey (macOS)", kategorie: "licht", port: 21600, protokoll: "UDP",
    doku: "https://lightkeyapp.com/en/help",
    einrichten: "Im Live-View Rechtsklick auf einen Cue → External Control → Copy OSC Address. Panel- und Cue-Name aus dieser Adresse übernehmen.",
    befehle: [
      { id: "toggle", label: "Cue umschalten", params: [P("panel", "Panel", "Panel"), P("cue", "Cue", "Cue")], osc: [{ address: "/live/{panel}/cue/{cue}/toggle" }] },
    ],
  },
  {
    id: "reaper", name: "REAPER", hersteller: "Cockos", kategorie: "audio", port: 8000, protokoll: "UDP",
    doku: "https://www.reaper.fm/sdk/osc/osc.php",
    einrichten: "Preferences → Control/OSC/web → Add → OSC: Pattern „Default“, Mode „Local port“, Local listen port 8000. Jeden Sound auf einen Marker oder eine Region legen.",
    befehle: [
      { id: "marker_play", label: "Audio ab Marker abspielen", params: [P("marker", "Marker", "1", "zahl")], osc: [{ address: "/marker/{marker}" }, { address: "/play" }] },
      { id: "region_play", label: "Region abspielen", params: [P("region", "Region", "1", "zahl")], osc: [{ address: "/region/{region}" }, { address: "/play" }] },
      { id: "play", label: "Play", params: [], osc: [{ address: "/play" }] },
      { id: "pause", label: "Pause", params: [], osc: [{ address: "/pause" }] },
      { id: "stop", label: "Stop", params: [], osc: [{ address: "/stop" }] },
      { id: "action", label: "Aktion (Action-ID)", params: [P("action", "Action-ID", "40044", "zahl")], osc: [{ address: "/action/{action}" }] },
      { id: "action_str", label: "Skript/Aktion (Command-ID)", params: [P("id", "Command-ID", "_RS…")], osc: [{ address: "/action/str", args: [{ type: "s", value: "{id}" }] }] },
      { id: "mute", label: "Spur stumm", params: [P("track", "Spur", "1", "zahl"), P("an", "Stumm (1/0)", "1", "zahl")], osc: [{ address: "/track/{track}/mute", args: [{ type: "i", value: "{an}" }] }] },
    ],
  },
  {
    id: "ableton", name: "Ableton Live", hersteller: "Ableton, mit AbletonOSC", kategorie: "audio", port: 11000, protokoll: "UDP",
    doku: "https://github.com/ideoforms/AbletonOSC",
    einrichten: "AbletonOSC in User Library/Remote Scripts kopieren, dann Preferences → Link/Tempo/MIDI → Control Surface „AbletonOSC“. Spuren, Clips und Szenen zählen ab 0.",
    befehle: [
      { id: "clip", label: "Clip starten", params: [P("track", "Spur (ab 0)", "0", "zahl"), P("clip", "Clip-Slot (ab 0)", "0", "zahl")], osc: [{ address: "/live/clip/fire", args: [{ type: "i", value: "{track}" }, { type: "i", value: "{clip}" }] }] },
      { id: "scene", label: "Szene starten", params: [P("scene", "Szene (ab 0)", "0", "zahl")], osc: [{ address: "/live/scene/fire", args: [{ type: "i", value: "{scene}" }] }] },
      { id: "play", label: "Play", params: [], osc: [{ address: "/live/song/start_playing" }] },
      { id: "stop", label: "Stop", params: [], osc: [{ address: "/live/song/stop_playing" }] },
      { id: "stopclips", label: "Alle Clips stoppen", params: [], osc: [{ address: "/live/song/stop_all_clips" }] },
      { id: "mute", label: "Spur stumm", params: [P("track", "Spur (ab 0)", "0", "zahl"), P("an", "Stumm (1/0)", "1", "zahl")], osc: [{ address: "/live/track/set/mute", args: [{ type: "i", value: "{track}" }, { type: "i", value: "{an}" }] }] },
    ],
  },
  {
    id: "x32", name: "X32 / M32", hersteller: "Behringer / Midas", kategorie: "audio", port: 10023, protokoll: "UDP",
    doku: "https://sites.google.com/site/patrickmaillot/x32",
    einrichten: "Keine Einrichtung nötig, das Pult hört immer auf Port 10023 (X Air: 10024). Kanäle zweistellig (01–32). Ohne offizielle Doku von Behringer.",
    befehle: [
      { id: "on", label: "Kanal an/aus", params: [P("ch", "Kanal 01–32", "01"), P("an", "An (1) / Stumm (0)", "0", "zahl")], osc: [{ address: "/ch/{ch}/mix/on", args: [{ type: "i", value: "{an}" }] }] },
      { id: "fader", label: "Kanal-Fader", params: [P("ch", "Kanal 01–32", "01"), P("wert", "Fader 0.0–1.0", "0.75", "zahl")], osc: [{ address: "/ch/{ch}/mix/fader", args: [{ type: "f", value: "{wert}" }] }] },
      { id: "main", label: "Main-Fader", params: [P("wert", "Fader 0.0–1.0", "0.75", "zahl")], osc: [{ address: "/main/st/mix/fader", args: [{ type: "f", value: "{wert}" }] }] },
      { id: "scene", label: "Szene laden", params: [P("scene", "Szene", "1", "zahl")], osc: [{ address: "/-action/goscene", args: [{ type: "i", value: "{scene}" }] }] },
      { id: "mutegroup", label: "Mute-Gruppe", params: [P("n", "Gruppe 1–6", "1", "zahl"), P("an", "Stumm (1/0)", "1", "zahl")], osc: [{ address: "/config/mute/{n}", args: [{ type: "i", value: "{an}" }] }] },
    ],
  },
  {
    id: "resolume", name: "Resolume", hersteller: "Resolume (Arena, Avenue)", kategorie: "video", port: 7000, protokoll: "UDP",
    doku: "https://resolume.com/support/en/osc",
    einrichten: "Preferences → OSC: „OSC Input“ an, Port 7000. Shortcuts → Edit OSC zeigt die Adresse jedes Reglers (für „Eigene OSC-Nachricht“).",
    befehle: [
      { id: "clip", label: "Clip starten", params: [P("layer", "Layer", "1", "zahl"), P("clip", "Clip", "1", "zahl")], osc: [{ address: "/composition/layers/{layer}/clips/{clip}/connect", args: [{ type: "i", value: "1" }] }] },
      { id: "column", label: "Spalte starten", params: [P("column", "Spalte", "1", "zahl")], osc: [{ address: "/composition/columns/{column}/connect", args: [{ type: "i", value: "1" }] }] },
      { id: "clear", label: "Layer leeren", params: [P("layer", "Layer", "1", "zahl")], osc: [{ address: "/composition/layers/{layer}/clear", args: [{ type: "i", value: "1" }] }] },
      { id: "opacity", label: "Layer-Deckkraft", params: [P("layer", "Layer", "1", "zahl"), P("wert", "0.0–1.0", "1", "zahl")], osc: [{ address: "/composition/layers/{layer}/video/opacity", args: [{ type: "f", value: "{wert}" }] }] },
    ],
  },
  {
    id: "millumin", name: "Millumin", hersteller: "Anomes", kategorie: "video", port: 5000, protokoll: "UDP",
    doku: "https://github.com/anome/millumin-dev-kit/wiki/OSC-documentation",
    einrichten: "Device Manager (Interactions): OSC-Eingang an, Port 5000. Ein- und Ausgangsport müssen verschieden sein.",
    befehle: [
      { id: "column", label: "Spalte starten", params: [P("column", "Spalte (Nr. oder Name)", "1")], osc: [{ address: "/millumin/action/launchColumn", argsFrei: "{column}" }] },
      { id: "next", label: "Nächste Spalte", params: [], osc: [{ address: "/millumin/action/launchNextColumn" }] },
      { id: "stop", label: "Spalte stoppen", params: [], osc: [{ address: "/millumin/action/stopColumn" }] },
      { id: "media", label: "Medium in Layer starten", params: [P("layer", "Layer-Name", "Layer 1"), P("media", "Medium (Nr. oder Name)", "1")], osc: [{ address: "/millumin/layer:{layer}/startMedia", argsFrei: "{media}" }] },
    ],
  },
  {
    id: "watchout", name: "WATCHOUT 7", hersteller: "Dataton", kategorie: "video", port: 8000, protokoll: "UDP",
    doku: "https://docs.dataton.com/watchout-7-new/watchout/external-control/osc-protocol.html",
    einrichten: "Producer → Network-Fenster: „OSC“ einschalten. Der Port 8000 ist fest. Timeline- und Cue-ID stehen im Producer.",
    befehle: [
      { id: "play", label: "Timeline abspielen", params: [P("tl", "Timeline-ID", "1")], osc: [{ address: "/wo/play/{tl}" }] },
      { id: "cue", label: "Timeline ab Cue", params: [P("tl", "Timeline-ID", "1"), P("cue", "Cue-ID", "1")], osc: [{ address: "/wo/play/{tl}/{cue}" }] },
      { id: "pause", label: "Timeline pausieren", params: [P("tl", "Timeline-ID", "1")], osc: [{ address: "/wo/pause/{tl}" }] },
      { id: "stop", label: "Timeline stoppen", params: [P("tl", "Timeline-ID", "1")], osc: [{ address: "/wo/stop/{tl}" }] },
    ],
  },
  {
    id: "disguise", name: "disguise", hersteller: "disguise (d3, Designer)", kategorie: "video", port: 7401, protokoll: "UDP",
    doku: "https://help.disguise.one/designer/timeline-tracks-transports/osc/controlling",
    einrichten: "Ein OSC Device mit Port anlegen und einem OSC Transport zuweisen. Einen Standard-Port gibt es nicht; hier 7401 voreingestellt.",
    befehle: [
      { id: "play", label: "Play", params: [], osc: [{ address: "/d3/showcontrol/play" }] },
      { id: "stop", label: "Stop", params: [], osc: [{ address: "/d3/showcontrol/stop" }] },
      { id: "cue", label: "Cue anfahren", params: [P("cue", "Cue", "1", "zahl")], osc: [{ address: "/d3/showcontrol/cue", args: [{ type: "i", value: "{cue}" }] }] },
      { id: "next", label: "Nächste Section", params: [], osc: [{ address: "/d3/showcontrol/nextsection" }] },
    ],
  },
  {
    id: "madmapper", name: "MadMapper", hersteller: "GarageCube", kategorie: "video", port: 8010, protokoll: "UDP",
    doku: "https://docs.madmapper.com/madmapper/6/11.-live-performance-and-control",
    einrichten: "Preferences → OSC: Eingangsport 8010. Rechtsklick auf einen Regler → „Copy OSC Address“ für eigene Nachrichten.",
    befehle: [
      { id: "scene", label: "Szene starten", params: [P("name", "Szenen-Name", "Szene 1")], osc: [{ address: "/cues/selected/scenes/by_name/{name}", args: [{ type: "i", value: "1" }] }] },
      { id: "opacity", label: "Surface-Deckkraft", params: [P("name", "Surface", "Quad 1"), P("wert", "0.0–1.0", "1", "zahl")], osc: [{ address: "/surfaces/{name}/opacity", args: [{ type: "f", value: "{wert}" }] }] },
    ],
  },
  {
    id: "touchdesigner", name: "TouchDesigner", hersteller: "Derivative", kategorie: "video", port: 10000, protokoll: "UDP",
    doku: "https://docs.derivative.ca/OSC_In_DAT",
    einrichten: "Einen „OSC In DAT“ oder „OSC In CHOP“ mit dem Port anlegen. Adressen sind frei.",
    befehle: [
      { id: "event", label: "Ereignis mit Daten", params: [P("adresse", "OSC-Adresse", "/lan/{spiel}/{event}")], osc: [{ address: "{adresse}", args: [{ type: "s", value: "{team}" }, { type: "s", value: "{spieler}" }, { type: "s", value: "{pc}" }] }] },
    ],
  },
  {
    id: "companion", name: "Companion", hersteller: "Bitfocus", kategorie: "steuerung", port: 12321, protokoll: "UDP",
    doku: "https://companion.free/user-guide/v4.2/remote-control/osc-control",
    einrichten: "Settings → Protocols → OSC: Listener an, Port 12321. Über Companion lassen sich auch Geräte ohne OSC steuern: vMix, OBS, ATEM, grandMA2, Avolites, Allen & Heath.",
    befehle: [
      { id: "press", label: "Taste drücken", params: [P("page", "Seite", "1", "zahl"), P("row", "Reihe", "0", "zahl"), P("column", "Spalte", "0", "zahl")], osc: [{ address: "/location/{page}/{row}/{column}/press" }] },
      { id: "down", label: "Taste halten", params: [P("page", "Seite", "1", "zahl"), P("row", "Reihe", "0", "zahl"), P("column", "Spalte", "0", "zahl")], osc: [{ address: "/location/{page}/{row}/{column}/down" }] },
      { id: "up", label: "Taste loslassen", params: [P("page", "Seite", "1", "zahl"), P("row", "Reihe", "0", "zahl"), P("column", "Spalte", "0", "zahl")], osc: [{ address: "/location/{page}/{row}/{column}/up" }] },
      { id: "text", label: "Tastentext setzen", params: [P("page", "Seite", "1", "zahl"), P("row", "Reihe", "0", "zahl"), P("column", "Spalte", "0", "zahl"), P("text", "Text", "{spieler}")], osc: [{ address: "/location/{page}/{row}/{column}/style/text", args: [{ type: "s", value: "{text}" }] }] },
      { id: "variable", label: "Variable setzen", params: [P("name", "Variable", "lan_event"), P("wert", "Wert", "{event}")], osc: [{ address: "/custom-variable/{name}/value", args: [{ type: "s", value: "{wert}" }] }] },
    ],
  },
  {
    id: "osc", name: "Allgemeines OSC-Gerät", hersteller: "", kategorie: "allgemein", port: 8000, protokoll: "UDP",
    doku: "https://opensoundcontrol.stanford.edu/spec-1_0.html",
    einrichten: "Für alles, was OSC per UDP empfängt. Adresse und Argumente frei eintragen.",
    befehle: [],
  },
];

// Ohne OSC-Eingang (Recherche): über Bitfocus Companion steuern
const OHNE_OSC = [
  { name: "grandMA2", weg: "Telnet (TCP 30000) oder MSC" },
  { name: "Avolites Titan", weg: "HTTP WebAPI (Port 4430)" },
  { name: "vMix", weg: "HTTP-API (8088) oder TCP-API (8099)" },
  { name: "OBS Studio", weg: "obs-websocket (4455)" },
  { name: "Allen & Heath SQ, dLive, Avantis, Qu", weg: "MIDI über TCP (51325 / 51326)" },
];

const BY_ID = Object.fromEntries(ZIEL_TYPEN.map((t) => [t.id, t]));
const zielTyp = (id) => BY_ID[id] || BY_ID.osc;
const befehleVon = (typId) => [...zielTyp(typId).befehle, EIGENE];
const befehlVon = (typId, befehlId) => befehleVon(typId).find((b) => b.id === befehlId) || null;

module.exports = { ZIEL_TYPEN, KATEGORIEN, OHNE_OSC, zielTyp, befehleVon, befehlVon, EIGENE };
