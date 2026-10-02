import React from "react";
import { S, ACCENT, LINE, SUB } from "./theme.js";
import { Section, Kbd, th, td } from "./ui.jsx";
import { CFG_DATEI, CFG_ORDNER } from "../core/cfg.js";

// Alle Erklärungen der App stehen hier, für beide Modi. Der eigene Modus steht oben.
const P = ({ children }) => <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d0de", margin: "0 0 10px" }}>{children}</p>;
const L = ({ children }) => <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, fontSize: 13, color: "#d4d0de" }}>{children}</ul>;

const Schritt = ({ n, titel, children, onGo, goLabel }) => (
  <div style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: `1px solid ${LINE}` }}>
    <div style={{ width: 30, height: 30, borderRadius: "50%", background: ACCENT, color: "#fff", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 12px rgba(157,92,255,.6)" }}>{n}</div>
    <div style={{ flex: 1, fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{titel}</div>
      {children}
    </div>
    {onGo && <button style={{ ...S.smallBtn, alignSelf: "center" }} onClick={onGo}>{goLabel}</button>}
  </div>
);

const Ueberblick = () => (
  <Section title="So funktioniert Advanced LAN">
    <P>
      Eine App, zwei Modi. Auf jedem PC, auf dem gespielt wird, läuft sie als <b>Game-PC</b>. Auf dem Regie-PC läuft sie als <b>Regie</b>; dort darf kein Spiel laufen.
      Im selben Netz braucht es also mindestens zwei PCs. Es kann mehrere Regien mit je einer eigenen Session geben.
    </P>
    <P>
      Die Regie öffnet eine Session mit Name und Passwort. Game-PCs sehen alle Sessions im Netz automatisch und treten mit ihrer PC-ID bei.
      Ein Game-PC meldet immer jedes Spiel, das die App kennt. Was mit den Daten passiert, entscheidet nur die Regie: Genau ein Spiel ist dort aktiv,
      Events aller anderen Spiele werden verworfen.
    </P>
    <P>
      Die Regie sagt nur, <b>was passiert ist</b>, zum Beispiel „Runde gewonnen“. Was ein Lichtpult, Playout oder anderes Gerät daraus macht, wird dort eingestellt.
    </P>
  </Section>
);

const Regie = ({ goTab }) => (
  <Section title="Regie">
    <Schritt n={1} titel="Spiele auswählen" onGo={goTab && (() => goTab("setup"))} goLabel="Setup">
      Im Tab <b>Setup</b> die Spiele anhaken, die heute gespielt werden. Nur diese erscheinen in Control und Signale. Rechts zeigt der Check, ob die Regie bereit ist,
      unter anderem ob auf diesem PC ein Spiel läuft (Windows).
    </Schritt>
    <Schritt n={2} titel="Session öffnen" onGo={goTab && (() => goTab("session"))} goLabel="Session">
      Name und Passwort festlegen, <b>Öffnen</b>. Die Session wird per mDNS im Netz angekündigt. Ändert man das Passwort, müssen alle PCs neu beitreten.
    </Schritt>
    <Schritt n={3} titel="Ziele eintragen" onGo={goTab && (() => goTab("ziele"))} goLabel="Ziele">
      IP und UDP-Port jedes Geräts, das die Signale empfangen soll. Jedes Signal geht an alle Ziele. <b>Test</b> schickt <Kbd>/lan/test</Kbd>.
    </Schritt>
    <Schritt n={4} titel="Signale prüfen" onGo={goTab && (() => goTab("signale"))} goLabel="Signale">
      Ein Abschnitt je genutztem Spiel. Einzelne Events lassen sich abschalten, <b>Test</b> schickt das Signal sofort an alle Ziele, auch bei Ausgabe aus.
    </Schritt>
    <Schritt n={5} titel="Proben" onGo={goTab && (() => goTab("sim"))} goLabel="Simulator">
      Der Simulator lässt 10 virtuelle Game-PCs (5 gegen 5) ein CS2-Match spielen, mit derselben Erkennung wie echte PCs. Einzelne Events lassen sich direkt auslösen.
    </Schritt>
    <Schritt n={6} titel="Live gehen" onGo={goTab && (() => goTab("control"))} goLabel="Control">
      Im Tab <b>Control</b> das aktive Spiel wählen (nur dort) und oben <b>Ausgabe</b> scharf schalten. Nach jedem Start der App ist die Ausgabe aus.
    </Schritt>
    <div style={{ marginTop: 14 }}>
      <div className="sp-section-label">Control</div>
      <L>
        <li><b>Aktives Spiel</b>: nur dessen Events werden gesendet. Die Game-PCs erfahren den Wechsel sofort.</li>
        <li><b>Ausgabe</b>: Events, verworfene Events (anderes Spiel), gesendete OSC-Pakete, Fehler.</li>
        <li><b>Verbindungscheck</b> je PC: Verbindung steht, Daten kommen (in den letzten 15 s), Spiel passt zum aktiven Spiel, Ping. Ein PC ist ok, wenn alle drei grün sind.</li>
        <li><b>Statistik</b>: Spielstand, aktuelle Runde (Kills, Headshots, Bombe, Sieger, MVP) und Match (Runden, Kills, Headshot-Quote, Multikills, Aces, Top-Spieler). Beginnt bei jedem Matchstart neu.</li>
        <li><b>Events</b>: neueste oben, darunter die OSC-Adresse. „nicht gesendet“ heißt Ausgabe aus, „gesperrt“ heißt im Tab Signale abgeschaltet, „→ 2“ heißt an 2 Ziele gesendet.</li>
      </L>
    </div>
  </Section>
);

const GamePc = ({ goTab }) => (
  <Section title="Game-PC">
    <Schritt n={1} titel="PC-ID eintragen" onGo={goTab && (() => goTab("session"))} goLabel="Session">
      Am besten wie das Schild am Platz, z. B. <Kbd>PC 01</Kbd>. Die PC-ID lässt sich nur ändern, solange der PC in keiner Session ist.
    </Schritt>
    <Schritt n={2} titel="Session beitreten">
      Alle Sessions im Netz erscheinen von selbst, auch wenn es mehrere Regien gibt. Session antippen, Passwort eingeben, <b>Beitreten</b>.
      Adresse und Port kommen automatisch per mDNS, es gibt nichts einzutippen. Mit „Beim Start automatisch beitreten“ verbindet sich der PC nach einem Neustart selbst,
      sobald die Session wieder im Netz ist.
    </Schritt>
    <Schritt n={3} titel="CS2 einrichten" onGo={goTab && (() => goTab("setup"))} goLabel="Setup">
      Im Tab <b>Setup</b> einmal <b>cfg installieren</b> und CS2 neu starten. Der Check zeigt, ob alles stimmt: CS2 gefunden, cfg-Datei da und aktuell, Empfang bereit, CS2 sendet.
      Findet die App CS2 nicht, mit „Speichern unter …“ die Datei <Kbd>{CFG_DATEI}</Kbd> nach <Kbd>{CFG_ORDNER}</Kbd> legen.
    </Schritt>
    <Schritt n={4} titel="Spielen" onGo={goTab && (() => goTab("events"))} goLabel="Events">
      Der PC schickt alle erkannten Events an die Regie. Im Tab <b>Events</b> steht, was rausging. Die Test-Knöpfe schicken ein CS2-Event, ohne zu spielen.
    </Schritt>
  </Section>
);

const Cs2 = () => (
  <Section title="CS2">
    <P>
      CS2 liefert seine Daten über Valves offizielle <b>Game State Integration</b>: Die cfg-Datei im CS2-Ordner lässt das Spiel seinen Zustand per HTTP an die App
      auf demselben PC schicken (<Kbd>127.0.0.1:3000</Kbd>, mit eigenem Token je PC). Das braucht keine Freigabe und keine Overwolf-Spielereignisse.
    </P>
    <P>
      Erkannt werden: Match startet und vorbei, Freezetime, Runde läuft, Runde gewonnen, Bombe gelegt, entschärft und explodiert, Kill, Headshot, 3 und 4 Kills, Ace,
      Spieler stirbt, geblendet, Runden-MVP. Runde, Bombe und Match melden alle PCs; die Regie wertet jedes Event nur einmal aus.
      Ein Observer- oder GOTV-PC als Game-PC meldet alle Spieler auf einmal.
    </P>
    <P>Valorant und Rocket League lassen sich in der Regie schon auswählen, ihre Datenquellen kommen später.</P>
  </Section>
);

const Osc = () => (
  <Section title="OSC-Signale">
    <table style={{ ...S.table, marginTop: 0 }}>
      <thead><tr><th style={th()}>Adresse</th><th style={th()}>Wann</th></tr></thead>
      <tbody>
        <tr><td style={td(S.mono)}>/lan/&lt;spiel&gt;/&lt;event&gt;</td><td style={td()}>Events des ganzen Spiels, z. B. <Kbd>/lan/cs2/round_end</Kbd></td></tr>
        <tr><td style={td(S.mono)}>/lan/&lt;spiel&gt;/&lt;pc&gt;/&lt;event&gt;</td><td style={td()}>Events eines Spielers, z. B. <Kbd>/lan/cs2/pc03/kill</Kbd> (PC-ID klein, ohne Leer- und Sonderzeichen)</td></tr>
        <tr><td style={td(S.mono)}>/lan/test</td><td style={td()}>Test-Knopf im Tab Ziele</td></tr>
      </tbody>
    </table>
    <P><br />Argumente immer in dieser Reihenfolge: Team <Kbd>s</Kbd>, Spieler <Kbd>s</Kbd>, PC-ID <Kbd>s</Kbd>, Runde <Kbd>i</Kbd>. Bei Events des ganzen Spiels bleiben Spieler und PC-ID leer.</P>
  </Section>
);

const Netz = () => (
  <Section title="Netzwerk">
    <L>
      <li>Sessions finden: mDNS (Multicast <Kbd>224.0.0.251:5353</Kbd>, Dienst <Kbd>_advancedlan._tcp</Kbd>). Alle PCs müssen im selben Netz sein, Multicast darf im Switch nicht gesperrt sein.</li>
      <li>Verbindung: WebSocket auf Port <Kbd>47801</Kbd>. Ist er belegt, nimmt die Regie einen freien Port und kündigt ihn per mDNS an.</li>
      <li>Das Passwort geht nicht im Klartext übers Netz (Challenge-Response mit HMAC-SHA256).</li>
      <li>Bricht die Verbindung ab, verbindet sich der Game-PC selbst neu. Events aus der Pause werden nicht nachgeschickt, damit nichts zur falschen Zeit kommt.</li>
      <li>Windows-Firewall: auf der Regie eingehend TCP 47801 erlauben, auf allen PCs UDP 5353. Beim ersten Start fragt Windows meist selbst.</li>
      <li style={{ color: SUB }}>Der Modus (Regie oder Game-PC) lässt sich oben rechts wechseln.</li>
    </L>
  </Section>
);

export default function AnleitungTab({ modus, goTab }) {
  return (
    <>
      <Ueberblick />
      {modus === "gamepc" ? <><GamePc goTab={goTab} /><Regie /></> : <><Regie goTab={goTab} /><GamePc /></>}
      <Cs2 />
      <Osc />
      <Netz />
    </>
  );
}
