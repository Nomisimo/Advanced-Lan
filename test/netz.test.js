// Ganzer Weg über das Netzwerk: Game-PC (WebSocket, Passwort) → Regie → OSC per UDP
const test = require("node:test");
const assert = require("node:assert/strict");
const dgram = require("node:dgram");
const { SessionServer } = require("../src/main/session-server");
const { SessionClient, Discovery } = require("../src/main/session-client");
const { GsiServer } = require("../src/main/gsi-server");
const { OscSender } = require("../src/main/osc-out");
const { Regie } = require("../src/core/regie");
const { CsQuelle } = require("../src/core/cs-quelle");
const { standardRegie } = require("../src/core/defaults");

const warte = (bed, ms = 3000) => new Promise((res, rej) => {
  const t0 = Date.now();
  const i = setInterval(() => { if (bed()) { clearInterval(i); res(); } else if (Date.now() - t0 > ms) { clearInterval(i); rej(new Error("Zeitüberschreitung")); } }, 20);
});

test("Game-PC meldet sich mit Passwort an, Ereignisse werden zu OSC", async () => {
  const empfang = dgram.createSocket("udp4");
  const pakete = [];
  empfang.on("message", (m) => pakete.push(m.toString("latin1")));
  await new Promise((r) => empfang.bind(0, "127.0.0.1", r));
  const oscPort = empfang.address().port;

  const cfg = { ...standardRegie(), armed: true, session: { name: "Test-LAN", passwort: "geheim", port: 47911, offen: true } };
  cfg.targets = [{ id: "ma3", name: "MA3", host: "127.0.0.1", port: oscPort }, { id: "playout", name: "Playout", host: "127.0.0.1", port: oscPort }];
  const osc = new OscSender();
  const regie = new Regie({ getConfig: () => cfg, send: (s) => osc.send(s) });
  const server = new SessionServer({ regie, getConfig: () => cfg });
  const disco = new Discovery({});
  disco.start();
  assert.equal(await server.oeffnen(), true);

  // Discovery: Session wird per mDNS gefunden
  await warte(() => disco.liste().some((s) => s.port === 47911), 5000);
  const gefunden = disco.liste().find((s) => s.port === 47911);
  assert.equal(gefunden.session, "Test-LAN");
  assert.equal(gefunden.aktivesSpiel, "cs2");

  // Falsches Passwort
  const falsch = new SessionClient({});
  falsch.verbinden({ host: "127.0.0.1", port: 47911, passwort: "nein", pcId: "PC 99", spiel: "cs2" });
  await warte(() => falsch.zustand === "abgelehnt");
  assert.equal(falsch.grund, "Falsches Passwort");
  falsch.trennen();

  // Richtig angemeldet
  const pc = new SessionClient({});
  pc.verbinden({ host: "127.0.0.1", port: 47911, passwort: "geheim", pcId: "PC 01", spiel: "cs2" });
  await warte(() => pc.zustand === "verbunden");
  assert.equal(pc.aktivesSpiel, "cs2");
  assert.equal(regie.snapshot().pcs[0].pcId, "PC 01");

  // CS2 auf dem Game-PC: GSI per HTTP an 127.0.0.1 → CsQuelle → WebSocket → Regie → OSC
  const quelle = new CsQuelle();
  const gsi = new GsiServer({ onPayload: (b) => { for (const ev of quelle.ingest(b).events) pc.event("cs2", ev); } });
  await gsi.start(47912);
  const zustand = (phase, extra = {}) => ({ provider: { steamid: "1" }, map: { name: "de_inferno", phase: "live", round: 4 }, round: { phase, ...extra }, player: { steamid: "1", name: "Blitz", team: "T", state: { health: 100 } } });
  for (const body of [zustand("live"), zustand("live", { bomb: "planted" }), zustand("over", { bomb: "exploded", win_team: "T" })])
    await fetch("http://127.0.0.1:47912/gsi", { method: "POST", body: JSON.stringify(body) });
  await warte(() => pakete.some((p) => p.includes("Go+ Sequence 102")));
  assert.ok(pakete.some((p) => p.startsWith("/gma3/cmd\0") && p.includes("Go+ Sequence 110")), "Bombe gelegt");
  assert.ok(pakete.some((p) => p.startsWith("/lanparty/cs2/round_end")), "Playout bekommt Rundenende");

  // Regie wechselt das Spiel: CS2-Ereignisse werden verworfen, der PC erfährt es
  const vorher = pakete.length;
  cfg.aktivesSpiel = "rl";
  server.spielGewechselt();
  await warte(() => pc.aktivesSpiel === "rl");
  await warte(() => disco.liste().find((s) => s.port === 47911)?.aktivesSpiel === "rl", 5000); // mDNS veröffentlicht neu
  pc.event("cs2", { type: "round_end", team: "CT" });
  await warte(() => regie.snapshot().zaehler.verworfen === 1);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(pakete.length, vorher);

  pc.trennen();
  await warte(() => regie.snapshot().pcs[0].verbunden === false);
  await gsi.stop();
  await server.schliessen();
  disco.stop();
  osc.close();
  empfang.close();
});
