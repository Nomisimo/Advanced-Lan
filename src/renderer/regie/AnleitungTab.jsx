import React from "react";
import { S, ACCENT, SUB } from "../theme.js";
import { Section, Kbd } from "../ui.jsx";

const Schritt = ({ n, titel, children, onGo, goLabel }) => (
  <div style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: "1px solid #2f2c3a" }}>
    <div style={{ width: 30, height: 30, borderRadius: "50%", background: ACCENT, color: "#fff", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 12px rgba(157,92,255,.6)" }}>{n}</div>
    <div style={{ flex: 1, fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{titel}</div>
      {children}
    </div>
    {onGo && <button style={{ ...S.smallBtn, alignSelf: "center" }} onClick={onGo}>{goLabel}</button>}
  </div>
);

export default function AnleitungTab({ goTab }) {
  return (
    <>
      <Section title="So funktioniert es" subtitle="Game-PCs → Regie → OSC-Signal an alle Ziele">
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d0de", margin: 0 }}>
          Es gibt eine App mit zwei Modi. Auf jedem PC, auf dem gespielt wird, läuft sie als <b>Game-PC</b>, auf dem Regie-PC (ohne Spiel) als <b>Regie</b>.
          Die Regie öffnet im LAN eine Session mit Name und Passwort. Die Game-PCs treten bei und schicken jedes erkannte Ereignis mit ihrer PC-ID und
          dem Spiel, und zwar für jedes Spiel, das sie kennen. In der Regie ist immer genau ein Spiel aktiv: nur dessen Ereignisse werden als Signal gesendet, alle anderen verworfen.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d0de" }}>
          CS2 liefert seine Daten über Valves offizielle <b>Game State Integration</b>: eine cfg-Datei im CS2-Ordner, dann schickt das Spiel den Spielstand an die
          App auf demselben PC. Das braucht keine Freigabe und läuft ohne Overwolf-Spielereignisse.
        </p>
      </Section>
      <Section title="Einrichten">
        <Schritt n={1} titel="Session öffnen" onGo={() => goTab("session")} goLabel="Zu „Session“">Name und Passwort festlegen, „Session öffnen“.</Schritt>
        <Schritt n={2} titel="Game-PCs verbinden">
          Auf jedem Game-PC die App im Modus „Game-PC“ starten, PC-ID (z. B. <Kbd>PC 01</Kbd>) einstellen, die Session aus der Liste wählen und das Passwort eingeben.
          Für CS2 dort einmal „cfg installieren“ drücken und CS2 neu starten.
        </Schritt>
        <Schritt n={3} titel="Ziele eintragen" onGo={() => goTab("ziele")} goLabel="Zu „Ziele“">IP und Port von jedem Gerät eintragen, das die Signale empfangen soll, mit „Test“ prüfen. Jedes Signal geht an alle Ziele.</Schritt>
        <Schritt n={4} titel="Signale prüfen" onGo={() => goTab("signale")} goLabel="Zu „Signale“">
          Die App meldet nur, was passiert ist, z. B. <Kbd>/lan/cs2/round_end</Kbd> oder <Kbd>/lan/cs2/pc03/kill</Kbd> mit Team, Spieler, PC und Runde.
          Was daraus wird, legt das empfangende Gerät fest. Einzelne Ereignisse lassen sich hier sperren.
        </Schritt>
        <Schritt n={5} titel="Proben" onGo={() => goTab("sim")} goLabel="Zum Simulator">Mit dem Simulator ein CS2-Match abspielen. Solange die Ausgabe aus ist, zeigt der Live-Tab nur, was gesendet würde.</Schritt>
        <Schritt n={6} titel="Spiel wählen und scharf schalten">Oben das aktive Spiel wählen und „Ausgabe“ einschalten. Nach jedem Neustart der App ist die Ausgabe wieder aus.</Schritt>
      </Section>
      <Section title="Gut zu wissen">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, fontSize: 13, color: "#d4d0de" }}>
          <li>Jeder Game-PC meldet seinen eigenen Spieler. Runde, Bombe und Matchende melden alle PCs, die Regie wertet jedes Ereignis nur einmal aus.</li>
          <li>Spieler-Ereignisse (Kill, Tod, MVP …) tragen die PC-ID in der Adresse, Runde, Bombe und Matchende nicht.</li>
          <li>Ein Observer- oder GOTV-PC als Game-PC meldet alle Spieler auf einmal.</li>
          <li>Bricht die Verbindung ab, verbindet sich der Game-PC selbst neu. Ereignisse aus der Pause werden nicht nachgeschickt, damit kein Effekt zur falschen Zeit kommt.</li>
          <li>Auf Windows warnt die Regie, wenn auf ihrem PC CS2, Valorant oder Rocket League läuft.</li>
          <li style={{ color: SUB }}>Valorant und Rocket League sind als Spiele schon wählbar. Ihre Datenquellen kommen später.</li>
        </ul>
      </Section>
    </>
  );
}
