const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { shotsfiredEvents, sfZustand, eventName } = require("../src/core/shotsfired");
const { ShotsFiredServer } = require("../src/main/shotsfired-server");
const { BildQuelle } = require("../src/core/bild-spiele");

const ev = (body, z) => shotsfiredEvents(body, z).map((n) => `${n.event}${n.seite === "gegner" ? ":gegner" : ""}`);
const score = (won, lost) => ({ info: { match_info: { score: JSON.stringify({ won, lost }) } } });

test("Shots Fired: Overwolf-Events in verschiedenen Formen", () => {
  assert.deepEqual(ev({ events: [{ name: "spike_planted", data: "" }] }), ["spike_planted"]);
  assert.deepEqual(ev({ event: "spike_defused" }), ["spike_defused"]);
  assert.deepEqual(ev("Spike Detonated"), ["spike_detonated"]);
  assert.deepEqual(ev(JSON.stringify({ name: "kill", data: { count: 1 } })), ["kill"]);
  assert.deepEqual(ev({ game: "valorant", event: { name: "headshot" } }), ["headshot"]);
  assert.equal(eventName("valorant.match_start"), "match_start");
  assert.deepEqual(ev({ name: "goal" }), [], "Events anderer Spiele werden ignoriert");
  assert.deepEqual(ev("{kaputt"), []);
});

test("Shots Fired: Runden- und Matchgewinner aus dem Spielstand", () => {
  const z = sfZustand();
  assert.deepEqual(ev({ events: [{ name: "match_start" }] }, z), ["match_start"]);
  assert.deepEqual(ev(score(0, 0), z), []);
  assert.deepEqual(ev({ feature: "match_info", key: "round_phase", value: "shopping" }, z), ["round_start"]);
  assert.deepEqual(ev({ feature: "match_info", key: "round_phase", value: "shopping" }, z), [], "Kaufphase nur einmal");
  assert.deepEqual(ev({ key: "round_phase", value: "combat" }, z), []);
  assert.deepEqual(ev(score(1, 0), z), ["round_end"]);
  assert.deepEqual(ev(score(1, 0), z), [], "gleicher Stand zählt nicht");
  assert.deepEqual(ev({ key: "score", value: { won: 1, lost: 1 } }, z), ["round_end:gegner"]);
  z.score = { won: 12, lost: 12 };
  assert.deepEqual(ev(score(13, 12), z), ["round_end"], "Verlängerung: 13:12 entscheidet nicht");
  assert.deepEqual(ev(score(14, 12), z), ["round_end", "match_won"]);
  assert.deepEqual(ev({ events: [{ name: "match_end" }] }, z), [], "match_end nach entschiedenem Match nichts mehr");
});

test("Shots Fired: match_end liefert den Sieger aus dem letzten Stand, neues Match setzt zurück", () => {
  const z = sfZustand();
  ev(score(0, 0), z); ev(score(3, 5), z);
  assert.deepEqual(ev({ name: "match_end" }, z), ["match_won:gegner"]);
  assert.deepEqual(ev(score(0, 0), z), [], "neues Match");
  assert.deepEqual(ev(score(0, 1), z), ["round_end:gegner"]);
  const leer = sfZustand();
  assert.deepEqual(ev({ name: "match_end" }, leer), ["match_end"], "ohne Stand: Match vorbei ohne Sieger");
});

test("Shots Fired: Events laufen durch die Valorant-Quelle, Spike explodiert zählt", () => {
  const q = new BildQuelle("valorant", { team: "TEAM A", name: "Momo" });
  const z = sfZustand();
  const typen = (body, t) => shotsfiredEvents(body, z).flatMap((n) => q.ingest({ bild: true, ...n }, t).events).map((e) => `${e.type}${e.team ? ":" + e.team : ""}`);
  assert.deepEqual(typen({ name: "match_start" }, 0), ["match_start"]);
  assert.deepEqual(typen(score(0, 0), 100), []);
  assert.deepEqual(typen({ key: "round_phase", value: "shopping" }, 1000), ["round_start"]);
  assert.deepEqual(typen({ name: "spike_planted" }, 2000), ["spike_planted"]);
  assert.deepEqual(typen({ name: "spike_detonated" }, 3000), ["spike_detonated"]);
  assert.deepEqual(typen(score(1, 0), 4000), ["round_end:TEAM A"]);
  assert.deepEqual(typen({ key: "round_phase", value: "end" }, 4500), []);
  assert.deepEqual(typen({ key: "round_phase", value: "shopping" }, 30000), ["round_start"]);
  assert.deepEqual(typen(score(1, 1), 60000), ["round_end:TEAM B"]);
});

const senden = (port, { method = "POST", pfad = "/valorant", body = "" } = {}) => new Promise((resolve, reject) => {
  const req = http.request({ host: "127.0.0.1", port, method, path: pfad, headers: { "Content-Type": "application/json" } }, (res) => { res.resume(); res.on("end", () => resolve(res)); });
  req.on("error", reject);
  req.end(body);
});

test("Shots Fired: Webhook per HTTP, schreibt Anfragen mit", async () => {
  const events = [];
  const s = new ShotsFiredServer({ onEvent: (e) => events.push(e) });
  const port = 44207 + 1000 + Math.floor(Math.random() * 1000);
  await s.start(port);
  assert.equal(s.status().laeuft, true, s.status().fehler);
  const opt = await senden(port, { method: "OPTIONS" });
  assert.equal(opt.statusCode, 204);
  assert.equal(opt.headers["access-control-allow-origin"], "*");
  assert.equal((await senden(port, { body: JSON.stringify({ events: [{ name: "spike_planted" }] }) })).statusCode, 200);
  await senden(port, { method: "GET", pfad: "/valorant?event=spike_defused" });
  await senden(port, { body: "irgendwas" });
  assert.deepEqual(events.map((e) => e.event), ["spike_planted", "spike_defused"]);
  const st = s.status();
  assert.equal(st.anfragen, 3);
  assert.deepEqual(st.roh[0].events, [], "unbekanntes Format wird trotzdem mitgeschrieben");
  assert.equal(st.roh[0].body, "irgendwas");
  await s.stop();
  assert.equal(s.status().laeuft, false);
});
