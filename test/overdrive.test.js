const test = require("node:test");
const assert = require("node:assert/strict");
const WebSocket = require("ws");
const { overdriveEvent } = require("../src/core/overdrive");
const { OverdriveServer } = require("../src/main/overdrive-server");
const { BildQuelle } = require("../src/core/bild-spiele");

const tp = (value, id = "overwolfEvent") => JSON.stringify({ type: "stateUpdate", id, value });

test("Automation Overdrive: Touch-Portal-Nachrichten werden zu Valorant-Events", () => {
  assert.equal(overdriveEvent(tp("kill")), "kill");
  assert.equal(overdriveEvent(tp("headshot")), "headshot");
  assert.equal(overdriveEvent(tp("match_end")), "match_end");
  assert.equal(overdriveEvent("assist"), "assist", "auch als reiner Text");
  assert.equal(overdriveEvent(tp("")), null, "Zurücksetzen des Werts ist kein Event");
  assert.equal(overdriveEvent(tp("goal")), null, "Events anderer Spiele werden ignoriert");
  assert.equal(overdriveEvent(tp("kill", "anderer")), null);
  assert.equal(overdriveEvent("{kaputt"), null);
});

test("Automation Overdrive: Events laufen durch die Valorant-Quelle", () => {
  const q = new BildQuelle("valorant", { team: "TEAM B", name: "Momo" });
  const typen = (event, t) => q.ingest({ bild: true, event, seite: "eigen" }, t).events.map((e) => `${e.type}${e.team ? ":" + e.team : ""}`);
  assert.deepEqual(typen("match_start", 0), ["match_start"]);
  assert.deepEqual(typen("kill", 1000), ["kill:TEAM B"]);
  assert.deepEqual(typen("headshot", 1000), ["headshot:TEAM B"]);
  assert.deepEqual(typen("assist", 2000), ["assist:TEAM B"]);
  assert.deepEqual(typen("death", 3000), ["death:TEAM B"]);
  assert.deepEqual(typen("match_end", 4000), ["match_end"], "Match vorbei ohne Sieger");
  assert.deepEqual(typen("match_end", 5000), [], "nur einmal");
});

test("Automation Overdrive: Empfang per WebSocket wie das Touch-Portal-Plugin", async () => {
  const events = [];
  const s = new OverdriveServer({ onEvent: (e) => events.push(e) });
  const port = 44206 + 1000 + Math.floor(Math.random() * 1000);
  await s.start(port);
  assert.equal(s.status().laeuft, true, s.status().fehler);
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((r, f) => { ws.once("open", r); ws.once("error", f); });
  const antwort = new Promise((r) => ws.once("message", (d) => r(String(d))));
  ws.send(tp("kill"));
  assert.equal(await antwort, `v1 received: ${tp("kill")}`);
  ws.send(tp(""));
  ws.send(tp("death"));
  await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(events, ["kill", "death"]);
  assert.equal(s.status().verbunden, 1);
  // Zweiter Empfang auf demselben Port: belegt, mit Hinweis
  const b = new OverdriveServer({ onEvent: () => {} });
  await b.start(port);
  assert.equal(b.status().laeuft, false);
  assert.match(b.status().fehler, /belegt/);
  ws.close();
  await s.stop();
  await b.stop();
});
