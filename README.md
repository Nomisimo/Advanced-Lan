# Advanced LAN

Eine App für die LAN-Party: Die Game-PCs melden Spielereignisse, die Regie sendet daraus neutrale OSC-Signale ins Netz. Was ein Empfänger (Lichtpult, Playout, …) damit macht, entscheidet er selbst. Design und Aufbau wie [Netzwerkplaner](https://github.com/Nomisimo/Netzwerkplaner) und Stromplaner, Akzentfarbe Lila.

Gebaut mit **Overwolf Electron** (`@overwolf/ow-electron`), React 18 und esbuild. Die Oberfläche wird zu einer einzelnen Datei `dist-app/index.html` gebündelt.

## Zwei Modi, eine App

| Modus | Läuft auf | Tabs |
|---|---|---|
| **Game-PC** | jedem PC, auf dem gespielt wird | Session (PC-ID, Sessions im Netz, beitreten), Setup (CS2 einrichten, „Ist korrekt aufgesetzt?“-Check), Events, Anleitung |
| **Regie** | dem Regie-PC (ohne Spiel) | Control (aktives Spiel, Ausgabe, Verbindungscheck, Statistik, Events), Signale, Ziele, Session, Setup (genutzte Spiele, Check), Simulator, Anleitung |

Der Modus wird beim ersten Start gewählt und lässt sich oben rechts wechseln. Alle Erklärungen stehen im Tab „Anleitung“.

- Die Regie öffnet eine **Session mit Name und Passwort**. Game-PCs sehen alle Sessions im Netz automatisch per mDNS (Multicast, Dienst `_advancedlan._tcp`), auch mehrere Regien. Keine IP- oder Port-Eingabe.
- Verbindung per WebSocket (Port 47801, falls belegt ein freier, per mDNS angekündigt). Passwort per Challenge-Response mit HMAC-SHA256.
- Die PC-ID lässt sich nur ändern, solange der PC in keiner Session ist.
- Game-PCs melden immer alle Spiele, die die App kennt. Nur die Regie entscheidet: Im Tab „Setup“ werden die genutzten Spiele gewählt, im Tab „Control“ (und nur dort) das aktive Spiel. Events anderer Spiele werden verworfen.
- Mehrere PCs melden dieselbe Runde oder Bombe: die Regie wertet jedes Event nur einmal aus.
- Die Ausgabe ist nach jedem Start **aus**. Erst „Ausgabe scharf“ schickt OSC.

## CS2

CS2 liefert seine Daten über Valves offizielle [Game State Integration](https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive_Game_State_Integration): Eine cfg-Datei im CS2-Ordner (`…\game\csgo\cfg\gamestate_integration_advancedlan.cfg`) lässt das Spiel seinen Zustand per HTTP an die App auf demselben PC schicken (`127.0.0.1:3000`). Der Game-PC installiert die Datei per Knopfdruck im Tab „Setup“ und prüft dort, ob alles stimmt. Dafür braucht es keine Overwolf-Spielereignisse (GEP) und keine Freigabe.

Erkannte Ereignisse: Match startet/vorbei, Freezetime, Runde läuft, Runde gewonnen (mit Team), Bombe gelegt/entschärft/explodiert, Kill, Headshot, 3 und 4 Kills, Ace, Tod, geblendet, Runden-MVP.

## Rocket League

Rocket League liefert seine Daten über die offizielle [Stats API](https://www.rocketleague.com/developer/stats-api) von Psyonix: `TAGame\Config\TAStatsAPI.ini` im Spielordner (Epic Games oder Steam) schaltet sie ein (`PacketSendRate=10`), dann schickt das Spiel `{ Event, Data }`-Nachrichten per WebSocket an die App auf demselben PC (`127.0.0.1:49124`). Der Game-PC schreibt die ini per Knopfdruck im Tab „Setup“.

Erkannte Ereignisse: Match startet/vorbei, Anstoß, Verlängerung, Siegerehrung, Tor, Vorlage, Hattrick, Tor-Wiederholung, Torschuss, Parade, Glanzparade, Demolition, Latte, MVP. Teams heißen `BLUE` und `ORANGE`. Die Stats API meldet alle Spieler des Matches, deshalb tragen Rocket-League-Signale den Spieler als Argument, aber keine PC-ID in der Adresse (`/lan/rl/goal`).

Valorant ist als Spiel schon wählbar, seine Datenquelle fehlt noch.

## OSC

Die App sagt nur, **was passiert ist**, nicht was ein Empfänger tun soll. Jedes Signal geht an alle eingetragenen Ziele (IP und Port, beliebig viele).

| Adresse | Wann |
|---|---|
| `/lan/<spiel>/<event>` | Ereignisse des ganzen Spiels, z. B. `/lan/cs2/round_end`, `/lan/cs2/bomb_planted` |
| `/lan/<spiel>/<pc>/<event>` | Ereignisse eines Spielers, z. B. `/lan/cs2/pc03/kill` (PC-ID klein, ohne Leer- und Sonderzeichen) |

Argumente immer in dieser Reihenfolge: `team` (s), `spieler` (s), `pc` (s), `runde` (i). Bei Ereignissen des ganzen Spiels bleiben `spieler` und `pc` leer. Einzelne Ereignisse lassen sich im Tab „Signale“ sperren. „Test“ in „Ziele“ schickt `/lan/test`.

## Entwickeln

```bash
npm install
npm test           # Erkennung, Regie, Netzwerk (WebSocket, UDP, OSC)
npm start          # baut die Oberfläche und startet ow-electron
npm run dist:win   # Windows-Installer mit ow-electron-builder
npm run dist:mac   # macOS Intel (dmg und zip), nur auf einem Mac
```

**Beta-Releases:** Ein Tag `v*` (z. B. `v0.1.0-beta.1`) startet `.github/workflows/release.yml`: Build für macOS Intel auf einem GitHub-Mac, Ergebnis als Vorabversion unter Releases. Unsigniert, deshalb beim ersten Start Rechtsklick → Öffnen. Apple Silicon und Windows folgen.

`dist-app/index.html` lässt sich auch direkt im Browser öffnen: Dann läuft eine Vorschau ohne Netzwerk, mit derselben Regie-Logik und dem Simulator.

| Ordner | Inhalt |
|---|---|
| `src/core` | Logik ohne Electron: Ereigniserkennung CS2, Regie, Signale, Statistik, Simulator, Protokoll |
| `src/main` | Hauptprozess: Session-Server, Game-PC-Verbindung, GSI-Empfang, OSC |
| `src/renderer` | Oberfläche (React): Modus-Wahl, `regie/`, `gamepc/` |
