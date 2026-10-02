# LAN-Regie (Advanced LAN-Party)

Eine App für die LAN-Party: Die Game-PCs melden Spielereignisse, die Regie sendet daraus neutrale OSC-Signale ins Netz. Was ein Empfänger (Lichtpult, Playout, …) damit macht, entscheidet er selbst. Design und Aufbau wie [Netzwerkplaner](https://github.com/Nomisimo/Netzwerkplaner) und Stromplaner, Akzentfarbe Lila.

Gebaut mit **Overwolf Electron** (`@overwolf/ow-electron`), React 18 und esbuild. Die Oberfläche wird zu einer einzelnen Datei `dist-app/index.html` gebündelt.

## Zwei Modi, eine App

| Modus | Läuft auf | Aufgabe |
|---|---|---|
| **Game-PC** | jedem PC, auf dem gespielt wird | liest jedes Spiel mit, das die App kennt, und schickt alle Ereignisse mit PC-ID und Spiel an die Regie. Keine Spielauswahl. |
| **Regie** | dem Regie-PC (ohne Spiel) | öffnet die Session, wählt das aktive Spiel und entscheidet allein, was mit den Daten passiert |

Der Modus wird beim ersten Start gewählt und lässt sich oben rechts wechseln.

- Die Regie öffnet eine **Session mit Name und Passwort**. Game-PCs finden sie automatisch per mDNS (Multicast, Dienst `_lanregie._tcp`) und verbinden sich per WebSocket (Port 47801).
- Das Passwort geht nicht im Klartext übers Netz: Challenge-Response mit HMAC-SHA256.
- In der Regie ist **genau ein Spiel aktiv** (CS2, Valorant, Rocket League). Ereignisse anderer Spiele werden verworfen, nur das aktive Spiel erzeugt OSC.
- Mehrere PCs melden dieselbe Runde oder Bombe: die Regie wertet jedes Ereignis nur einmal aus.
- Die Ausgabe ist nach jedem Start **aus**. Erst „Ausgabe scharf“ schickt OSC.

## CS2

CS2 liefert seine Daten über Valves offizielle [Game State Integration](https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive_Game_State_Integration): Eine cfg-Datei im CS2-Ordner (`…\game\csgo\cfg\gamestate_integration_lanregie.cfg`) lässt das Spiel seinen Zustand per HTTP an die App auf demselben PC schicken (`127.0.0.1:3000`). Der Game-PC installiert die Datei per Knopfdruck. Dafür braucht es keine Overwolf-Spielereignisse (GEP) und keine Freigabe.

Erkannte Ereignisse: Match startet/vorbei, Freezetime, Runde läuft, Runde gewonnen (mit Team), Bombe gelegt/entschärft/explodiert, Kill, Headshot, 3 und 4 Kills, Ace, Tod, geblendet, Runden-MVP.

Valorant und Rocket League sind als Spiele schon wählbar, ihre Datenquellen fehlen noch.

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
```

`dist-app/index.html` lässt sich auch direkt im Browser öffnen: Dann läuft eine Vorschau ohne Netzwerk, mit derselben Regie-Logik und dem Simulator.

| Ordner | Inhalt |
|---|---|
| `src/core` | Logik ohne Electron: Ereigniserkennung CS2, Regie, Signale, Simulator, Protokoll |
| `src/main` | Hauptprozess: Session-Server, Game-PC-Verbindung, GSI-Empfang, OSC |
| `src/renderer` | Oberfläche (React): Modus-Wahl, `regie/`, `gamepc/` |
