"use strict";
// Versionen und Änderungen wie im Netzwerkplaner. Die Versionsnummer steht in package.json
// (SemVer, Betas als 0.x.y-beta.n). Hier stehen die Änderungen je Version für „Was ist neu?“ in der App.

const REPO = "Nomisimo/Advanced-Lan";
const RELEASES_URL = `https://github.com/${REPO}/releases`;

const CHANGELOG = {
  "0.1.0-beta.12": [
    "Ohne Overwolf: die App läuft jetzt auf normalem Electron und wird mit electron-builder gebaut. Keine Overwolf-Laufzeit, keine Nutzungsdaten an Overwolf",
    "Alle Spiele und Events bleiben: CS2 und Dota 2 über Valve GSI, Rocket League über die Stats API, Valorant und The Finals über Bilderkennung, Mini-Overlay, Namens-Popup, Simulator und Netzwerk wie bisher",
    "Setup → App: der Knopf „Datenschutz-Einstellungen“ (Overwolf) entfällt",
    "Valorant über Automation Overdrive geht weiter, braucht aber wie bisher den Overwolf-Client auf dem Game-PC",
  ],
  "0.1.0-beta.11": [
    "Plan: „10{nr}“ zählt jetzt 101, 102 … 110, 111 (wie {100+nr}) statt 109, 1010. „10{nr2}“ zählt 1001, 1002 …. Gilt auch für Werte in den Signalen",
    "Plan: unter jeder Regel steht, was sie ergibt, z. B. „101, 102 … 110“",
  ],
  "0.1.0-beta.10": [
    "Neuer Tab „Plan“ in der Regie: Game-PCs vorab als Plätze anlegen (PC 01 bis PC 10), auch ohne verbundenen Rechner. Geplante PCs stehen grau im Verbindungscheck",
    "Je Ziel eine Spalte im Plan: eine Regel für alle Plätze, z. B. {100+nr} für die MA3-Sequenz (PC 1 → 101, PC 2 → 102 …), einzelne Zellen überschreiben sie",
    "Neue Platzhalter in den Signalen: {plan} (Spalte des Ziels für den auslösenden PC), {nr}, {nr2} und Rechnen wie {100+nr} oder {nr*10}. Eine Zuweisung reicht für alle PCs",
    "Signale: Bereich „Allgemein“ für Kill, Tod, Headshot, Assist, Ace, MVP, Objective, Runde, Match-Start und Sieg. Gilt in jedem Spiel, im Spiel ergänzen oder ersetzen",
    "Signale zeigen je Spiel standardmäßig nur noch, was vom Allgemeinen abweicht",
    "Rechner im Plan (Hostname oder MAC): der Game-PC bekommt beim Beitreten die PC-ID seines Platzes, am Game-PC muss keiner sie eintippen. Unbekannte PCs lassen sich einem Platz zuweisen oder automatisch verteilen",
    "Game-PC-Vorlage: Spiele, Bilderkennung, Overlay und Namens-Popup aus einer Game-PC-Show oder von einem verbundenen PC an alle Game-PCs verteilen. PC-ID, Spielername, Session und Overlay-Position bleiben",
    "Einrichtungspaket: je Platz eine Game-PC-Show mit fertiger PC-ID in einen Ordner, z. B. für den USB-Stick",
    "Game-PC: Schalter „Einstellungen von der Regie übernehmen“ im Tab „Session“",
  ],
  "0.1.0-beta.9": [
    "Shows: die ganze Einrichtung als Show speichern, laden, exportieren und importieren. Knopf „Show“ oben im Kopf",
    "Regie und Game-PC haben getrennte Shows. Standalone nutzt beide und importiert Regie- und Game-PC-Shows",
    "„Leere Show laden“ setzt die Einstellungen des Modus auf Standard zurück",
    "Game-PC-Shows passen auf alle Game-PCs: PC-ID, Spielername, GSI-Token und Overlay-Position bleiben von jedem PC",
    "Nach dem Laden einer Regie-Show ist die Ausgabe immer aus. Ungespeicherte Änderungen zeigt ein Punkt am Knopf, vor dem Verwerfen fragt die App nach",
    "Valorant über Automation Overdrive (Overwolf): Kill, Tod, Assist, Headshot, Match-Start und Match-Ende kommen direkt als Events dieses PCs an. Anleitung mit Prüfliste im Setup",
    "Namens-Popup auf dem Game-PC: bei Spielstart und nach langem Leerlauf fragt ein kleines Popup, wer spielt. Der Name steht auf dem Game-Stats-Screen und in der Regie",
    "Mac: NDI-Quelle ist im Netz sichtbar. Die App meldet den Bonjour-Dienst _ndi._tcp jetzt bei macOS an, ohne den macOS die NDI-Ankündigung blockiert hat",
    "Setup auf dem Mac: Hinweis auf die Freigabe „Lokales Netzwerk“, solange kein NDI-Empfänger verbunden ist",
  ],
  "0.1.0-beta.8": [
    "NDI-Stream sendet immer in 1920×1080, auch wenn der Regie-PC einen kleineren Bildschirm hat",
    "NDI startet zuverlässig: das NDI SDK wird vor dem ersten Sender gestartet. Kommt nach 4 Sekunden kein Bild, steht das als Fehler im Setup",
    "Setup zeigt die gesendeten Bilder, die NDI-Version und einen Firewall-Hinweis, solange kein Empfänger verbunden ist",
    "Neuer Tab „Screen“ in der Regie: Anzeigen des Stats-Screens verschieben, Größe ändern, ein- und ausblenden, eigene Texte mit Platzhaltern wie {spiel}, {team1} oder {score1}",
    "Screen-Editor: Raster und Einrasten an Kanten und Mitten (Alt = frei), Pfeiltasten, Strg+Z/Y, Strg+D, Hintergrund Verlauf, Schwarz oder Grün. Beispieldaten des aktiven Spiels füllen die Vorschau",
    "Pop-out-Fenster und NDI-Stream übernehmen ein geändertes Layout sofort beim Speichern",
  ],
  "0.1.0-beta.7": [
    "Textfelder bleiben nach Rückfragen bedienbar: eigene Dialoge statt der Windows-Dialoge, die den Tastatur-Fokus verloren haben",
    "Release-Ablauf wie im Netzwerkplaner: Release-Text aus „Was ist neu?“, Tag muss zur Version passen",
    "Bilderkennung: Live-Quelle je Spiel oben im Tab: Spielfenster automatisch erkennen, ein beliebiges offenes Fenster oder Programm manuell wählen oder der Bildschirm. Gilt für die Erkennung im Betrieb und für die Editor-Aufnahme",
    "Bildquelle über einen Teil des Fenstertitels („Fenstertitel eingeben …“), z. B. „OBS“: passt auch, wenn das Programm seinen Titel ändert",
    "Editor nimmt das gewählte Fenster auch auf, bevor das Spiel Aktionen hat",
    "Eine Aktion kann mehrere Bereiche als Auslöser haben (bis zu 6), jeder mit eigenen Frames und/oder eigenem Text. Wählbar: ein Bereich reicht oder alle müssen gleichzeitig passen",
    "Bestehende Aktionen und Exportdateien mit einem Bereich werden übernommen",
    "Editor-Aufnahme bis zu 2 Stunden statt 10 Minuten (30 Bilder/s, höchstens 1080p, 4 Mbit/s, etwa 1,8 GB pro Stunde). Der Knopf zeigt Dauer und Größe",
  ],
  "0.1.0-beta.6": [
    "Texterkennung stürzt im gepackten Build nicht mehr ab (fehlender Tesseract-Kern „relaxedsimd“, Mac und Windows)",
    "Bilderkennung erkennt geöffnete Spiele selbst und nimmt ihr Fenster als Bildquelle, statt den ganzen Bildschirm",
    "Mehrere Spiele gleichzeitig: Sind Valorant und The Finals offen, läuft für jedes eine eigene Erkennung",
    "Bildquelle je Spiel wählbar: automatisch (Spielfenster), ein bestimmtes Fenster oder der Bildschirm. Der Editor nimmt dieselbe Quelle auf",
  ],
  "0.1.0-beta.5": [
    "Valorant und The Finals über Bilderkennung: Der Game-PC schaut auf seinen Bildschirm und meldet Aktionen wie Runde gewonnen, Spike gelegt, Kill oder Cashout an die Regie",
    "Neuer Tab „Bilderkennung“ mit Editor: Gameplay in der App aufzeichnen, Bereich aufziehen, Frames wählen, Event zuordnen, Schwelle und Pause einstellen, „Erkennung testen“ auf der Aufnahme",
    "Texterkennung (Englisch und Deutsch, offline): Eine Aktion kann zusätzlich verlangen, dass ein Wort im Bereich steht, z. B. „ROUND WON|RUNDE GEWONNEN“",
    "Spiel-Konfiguration exportieren und auf den anderen Game-PCs importieren. Bei anderem Seitenverhältnis rechnet die App die Bereiche um",
    "Die Aufnahme bleibt nur im Arbeitsspeicher; gespeichert werden nur die kleinen Frames der Aktionen",
    "Warnung bei schwarzem Bild (exklusives Vollbild): im Spiel „Randloses Fenster“ einstellen",
    "Valorant: nur ein Signal beim Legen des Spikes, kein Spike-Timer (Riot-Regel)",
    "Simulator für Valorant (10 PCs, bis 13 Runden), Statistik mit Aces und Spikes",
    "Overwolf-Spiele entfernt: Overwatch 2, Rainbow Six Siege, Marvel Rivals, Fortnite, Apex Legends und PUBG. Die App nutzt keine Overwolf-Spielereignisse (GEP) mehr",
  ],
  "0.1.0-beta.4": [
    "Windows: erster Installer für Windows (x64), noch unsigniert. Windows SmartScreen warnt deshalb: Weitere Informationen → Trotzdem ausführen",
    "Einführung beim ersten Start: was die App macht, die drei Modi, das Tastenkürzel und Datenschutz mit Zustimmung zu Nutzungsbedingungen und Datenschutzerklärung",
    "Tastenkürzel Strg+Umschalt+A (Mac: ⌘⇧A) blendet die App ein und aus, auch mitten im Spiel; änderbar unter Setup → App",
    "Setup → App: Tastenkürzel, Einführung erneut zeigen, Overwolf-Datenschutz-Einstellungen, Nutzungsbedingungen, Datenschutzerklärung und „Fehler melden“ (öffnet GitHub mit Version und System)",
    "Standalone: Regie und Spiel auf einem PC (Knopf unten in der Modus-Wahl). Die Spiele hier melden direkt an die Regie, ohne Session; Tab „Spiele“ richtet sie ein wie auf einem Game-PC",
    "Game-Stats-Screen für Publikum und Stream: Spielstand, Zahlen des Matches, beste Spieler und letzte Events des aktiven Spiels. Als Pop-out-Fenster (Knopf „Stats“ oben) oder als NDI-Quelle in 1920×1080, einzuschalten in Regie → Setup",
    "Sieben neue Spiele: Dota 2, Overwatch 2, Rainbow Six Siege, Marvel Rivals, Fortnite, Apex Legends und PUBG, jedes mit eigenen Events in „Signale“, Simulator, Statistik und Match-Check",
    "Dota 2 über Valves Game State Integration wie CS2: cfg per Knopfdruck, Check der Startoption -gamestateintegration, läuft auch auf dem Mac. Events u. a. Horn, Tag/Nacht, Roshan, Turm, Double Kill bis Rampage",
    "Overwatch 2, R6, Marvel Rivals, Fortnite, Apex und PUBG über Overwolf Game Events (GEP). Echte Daten erst mit Overwolf-Freigabe und signierter Windows-App, der Simulator geht schon",
    "Battle Royales im Simulator: LAN-Squads in einer vollen Lobby, eine Runde ist eine Zone, am Ende gewinnt ein Squad",
    "Update-Knopf wie im Netzwerkplaner: Die App sucht beim Start nach einer neuen Version und zeigt sie oben neben der Versionsnummer. Auf dem Mac lädt ein Klick das DMG und öffnet es, unter Windows installiert sich das Update selbst",
    "„Was ist neu?“: Klick auf die Versionsnummer zeigt die Änderungen je Version und sucht nach Updates",
    "Control: Die Zähler zeigen dieselben Zahlen wie die Filter im Event-Log; „Verworfen“ zählt nur verworfene Events. Die Liste zeigt die letzten 300 und sagt das",
    "Control: Knopf „Zurücksetzen“ setzt die Zähler auf null und leert das Event-Log",
    "Verbindungscheck: Spalte „Match“ zeigt, ob alle PCs im selben Match sind (Rocket League über die Match-ID, CS2 über Map und Spielstand)",
    "Event-Log: Jede Zeile zeigt das Spiel (CS2/RL) mit Farbstreifen",
    "Mini-Overlay: Glow kleiner und nicht mehr abgeschnitten, Statuspunkt ohne Glow",
  ],
  "0.1.0-beta.3": [
    "Game-PC: Simulator-Tab, spielt mit verbundener Session das aktive Spiel und schickt die Events wirklich an die Regie",
    "Ausgabe: „AUSGABE AN“ grün und pulsierend, „AUSGABE AUS“ rot",
    "Session-Übersicht der Regie: PC-ID, Hostname, IP, MAC, Ping, App-Version und Netzwerkkarte je PC",
    "Netzwerkkarten: getrennt für Empfang und Senden, je Ziel eine eigene Karte, Game-PC wählt seine Karte",
    "Anleitung: Netzwerk-Anforderungen (Subnetz/VLAN, IGMP Snooping, EEE, QoS, PortFast, Firewall …)",
    "Setup: Links zur Dokumentation von CS2 GSI und der Rocket League Stats API",
    "Mini-Overlay für Game-PCs, Startanimation, Event-Log mit Filtern",
  ],
  "0.1.0-beta.2": [
    "OSC-Befehle statt neutraler Signale: Ziel-Datenbank (grandMA3, QLab, Eos, Resolume, Companion …) und Signale-Matrix",
    "Ziel-Info-Pop-up mit Einrichtung und Doku je Gerät",
    "Neues App-Icon, Mac-Installer wie im Netzwerkplaner",
  ],
  "0.1.0-beta.1": [
    "Erste Beta: Regie und Game-PC in einer App, Sessions per mDNS, CS2 über Game State Integration, Rocket League über die Stats API",
  ],
};

// SemVer-Vergleich inkl. Vorabversionen: 0.2.0-beta.1 < 0.2.0-beta.2 < 0.2.0
const parseVersion = (v) => {
  const m = String(v || "").trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!m) return null;
  return { nums: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split(".") : [] };
};
const compareVersions = (a, b) => {
  const A = parseVersion(a), B = parseVersion(b);
  if (!A || !B) return 0;
  for (let i = 0; i < 3; i++) if (A.nums[i] !== B.nums[i]) return A.nums[i] - B.nums[i];
  if (!A.pre.length || !B.pre.length) return (A.pre.length ? -1 : 0) - (B.pre.length ? -1 : 0);
  for (let i = 0; i < Math.max(A.pre.length, B.pre.length); i++) {
    const x = A.pre[i], y = B.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
    if (nx && ny && +x !== +y) return +x - +y;
    if (nx !== ny) return nx ? -1 : 1;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
};
const istBeta = (v) => /-(alpha|beta|rc)/i.test(String(v || ""));

// Neueste Version aus der GitHub-Releases-Liste (ohne Entwürfe)
const neuesteVersion = (releases = []) => releases
  .filter((r) => !r.draft && parseVersion(r.tag_name))
  .sort((a, b) => compareVersions(b.tag_name, a.tag_name))[0] || null;

// Passendes Mac-DMG eines Releases (bisher nur Intel, x64)
const macDmg = (release, arch = "x64") => (release?.assets || []).find((a) => a.name.endsWith(`-mac-${arch}.dmg`)) || null;

module.exports = { REPO, RELEASES_URL, CHANGELOG, parseVersion, compareVersions, istBeta, neuesteVersion, macDmg };
