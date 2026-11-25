const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { shotsfiredEvents, sfZustand, eventName, sfInfo, spielerVon, seiteVon, teamAusSeite } = require("../src/core/shotsfired");
const { ShotsFiredServer } = require("../src/main/shotsfired-server");
const { BildQuelle } = require("../src/core/bild-spiele");

const ev = (body, z) => shotsfiredEvents(body, z).map((n) => `${n.event}${n.seite !== "eigen" ? ":" + n.seite : ""}`);
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

test("Shots Fired: Rundenstart und Rundenende, auch ohne Spielstand", () => {
  const z = sfZustand();
  assert.deepEqual(ev({ name: "match_start" }, z), ["match_start"]);
  assert.deepEqual(ev({ key: "round_phase", value: "shopping" }, z), ["round_start"]);
  assert.deepEqual(ev({ key: "round_phase", value: "combat" }, z), []);
  assert.deepEqual(ev({ key: "round_phase", value: "end" }, z), ["round_end:keins"], "ohne score: Ende ohne Sieger");
  assert.deepEqual(ev({ key: "round_phase", value: "end" }, z), [], "nur einmal");
  assert.deepEqual(ev({ name: "round_start" }, z), ["round_start"], "falls als Event: übernommen");
  assert.deepEqual(ev({ name: "round_end" }, z), ["round_end:keins"]);
  ev(score(0, 0), z);
  ev({ key: "round_phase", value: "shopping" }, z);
  assert.deepEqual(ev({ key: "round_phase", value: "end" }, z), [], "mit score: Ende kommt mit Sieger");
  assert.deepEqual(ev(score(0, 1), z), ["round_end:gegner"]);
  const q = new BildQuelle("valorant", { team: "TEAM A" });
  q.ingest({ bild: true, event: "round_start", seite: "eigen" }, 0);
  assert.deepEqual(q.ingest({ bild: true, event: "round_end", seite: "keins" }, 1000).events.map((e) => [e.type, e.team]), [["round_end", ""]]);
});

test("Shots Fired: Ace aus 5 Kills einer Runde, Clutch als letzter Überlebender", () => {
  const z = sfZustand();
  const feed = (mitspieler) => ({ events: [{ name: "kill_feed", data: JSON.stringify({ attacker: "a", victim: "v", is_victim_teammate: mitspieler, is_attacker_teammate: !mitspieler }) }] });
  ev({ name: "match_start" }, z); ev(score(0, 0), z); ev({ key: "round_phase", value: "shopping" }, z);
  for (let i = 0; i < 4; i++) assert.deepEqual(ev({ name: "kill" }, z), ["kill"]);
  assert.deepEqual(ev({ name: "kill" }, z), ["kill", "ace"]);
  assert.deepEqual(ev({ name: "kill" }, z), ["kill"], "Ace nur einmal pro Runde");
  assert.deepEqual(ev(score(1, 0), z), ["round_end"], "ohne tote Mitspieler kein Clutch");
  // Nächste Runde: 4 Mitspieler fallen, dieser Spieler gewinnt allein
  ev({ key: "round_phase", value: "shopping" }, z);
  assert.deepEqual(ev({ name: "kill" }, z), ["kill"], "Kills zählen pro Runde neu");
  for (let i = 0; i < 4; i++) assert.deepEqual(ev(feed(true), z), []);
  ev(feed(false), z);
  assert.deepEqual(ev(score(2, 0), z), ["round_end", "clutch"]);
  // Runde 3: 4 Mitspieler tot, aber dieser Spieler stirbt auch
  ev({ key: "round_phase", value: "shopping" }, z);
  for (let i = 0; i < 4; i++) ev(feed(true), z);
  assert.deepEqual(ev({ name: "death" }, z), ["death"]);
  assert.deepEqual(ev(score(3, 0), z), ["round_end"], "tot: kein Clutch");
  // Runde 4: Clutch-Lage, aber das Team verliert
  ev({ key: "round_phase", value: "shopping" }, z);
  for (let i = 0; i < 4; i++) ev(feed(true), z);
  assert.deepEqual(ev(score(3, 1), z), ["round_end:gegner"]);
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

test("Shots Fired: echtes Format { gameId, event: feature.name, data } für alle Spiele", () => {
  const { shotsfiredNachrichten, sfZustaende, sfSpiel } = require("../src/core/shotsfired");
  const z = sfZustaende();
  const n = (pfad, body) => { const r = shotsfiredNachrichten(body, pfad, z); return `${r.spiel}:${r.nachrichten.map((x) => x.event + (x.seite !== "eigen" ? "/" + x.seite : "")).join(",")}`; };
  assert.equal(sfSpiel("/", { gameId: 21216 }), "fortnite");
  assert.equal(sfSpiel("/", { gameId: 216401 }), "valorant", "Overwolf-ID mit Klassen-Ziffer");
  assert.equal(sfSpiel("/the-finals", {}), "finals");
  assert.equal(sfSpiel("/irgendwas", {}), null);
  // Valorant
  assert.equal(n("/valorant", { gameId: 21640, event: "match_info.spike_planted", data: "" }), "valorant:spike_planted");
  assert.equal(n("/", { gameId: 21640, event: "kill.kill", data: "1" }), "valorant:kill");
  n("/valorant", { gameId: 21640, event: "match_info.score", data: '{"won":0,"lost":0}' });
  assert.equal(n("/valorant", { gameId: 21640, event: "match_info.score", data: '{"won":0,"lost":1}' }), "valorant:round_end/gegner");
  // Fortnite: Bus, Landung, Eliminierung, Platzierung bis zum Sieg
  assert.equal(n("/fortnite", { gameId: 21216, event: "match.matchStart", data: "" }), "fortnite:match_start");
  assert.equal(n("/fortnite", { gameId: 21216, event: "game_info.phase", data: "aircraft" }), "fortnite:bus");
  assert.equal(n("/fortnite", { gameId: 21216, event: "game_info.phase", data: "landed" }), "fortnite:landed");
  assert.equal(n("/fortnite", { gameId: 21216, event: "kill.kill", data: 1 }), "fortnite:kill");
  assert.equal(n("/fortnite", { gameId: 21216, event: "kill.knockout", data: 1 }), "fortnite:knockout");
  assert.equal(n("/fortnite", { gameId: 21216, event: "death.knockedout", data: "" }), "fortnite:knocked");
  assert.equal(n("/fortnite", { gameId: 21216, event: "revived.revived", data: "" }), "fortnite:revived");
  assert.equal(n("/fortnite", { gameId: 21216, event: "kill.hit", data: 1 }), "fortnite:", "Treffer ignoriert");
  assert.equal(n("/fortnite", { gameId: 21216, event: "rank.rank", data: 8 }), "fortnite:top10");
  assert.equal(n("/fortnite", { gameId: 21216, event: "rank.rank", data: 1 }), "fortnite:top5,match_won");
  assert.equal(n("/fortnite", { gameId: 21216, event: "match.matchEnd", data: "" }), "fortnite:", "nach dem Sieg kein zweites Matchende");
  assert.equal(n("/fortnite", { gameId: 21216, event: "match.matchStart", data: "" }), "fortnite:match_start");
  assert.equal(n("/fortnite", { gameId: 21216, event: "death.death", data: "" }), "fortnite:death");
  assert.equal(n("/fortnite", { gameId: 21216, event: "match.matchEnd", data: "" }), "fortnite:match_end");
  // The Finals und LoL
  assert.equal(n("/finals", { event: "match_info.elimination", data: "" }), "finals:kill");
  assert.equal(n("/finals", { event: "match_info.match_end", data: "" }), "finals:match_end");
  assert.equal(n("/lol", { gameId: 5426, event: "kill.kill", data: "" }), "lol:kill");
  assert.equal(n("/lol", { gameId: 5426, event: "announcer.penta_kill", data: "" }), "lol:penta_kill");
});

test("Shots Fired: Zähler kills, deaths und round_number (wenn es keine Einzel-Events gibt)", () => {
  const z = sfZustand();
  const sf = (event, data) => ev({ gameId: 21640, event, data }, z);
  assert.deepEqual(sf("match_info.round_number", 1), ["round_start"]);
  assert.deepEqual(sf("round_number", 1), [], "gleiche Runde löst nichts aus");
  assert.deepEqual(sf("kills", 1), ["kill"]);
  assert.deepEqual(sf("kills", "3"), ["kill", "kill"]);
  assert.deepEqual(sf("deaths", 0), []);
  assert.deepEqual(sf("deaths", 1), ["death"]);
  assert.deepEqual(sf("round_number", "2"), ["round_start"]);
  // Ace: 5 Kills in Runde 2
  assert.deepEqual(sf("kills", 7), ["kill", "kill", "kill", "kill"]);
  assert.deepEqual(sf("kills", 8), ["kill", "ace"]);
  // Stand fällt zurück: neues Match, nur neuer Ausgangswert
  assert.deepEqual(sf("kills", 0), []);
  assert.deepEqual(sf("kills", 1), ["kill"]);
});

test("Shots Fired: Zähler mitten im Match und neben echten Events", () => {
  const z = sfZustand();
  // App startet mitten im Match: hoher Stand ist nur der Ausgangswert
  assert.deepEqual(ev({ event: "kills", data: 9 }, z), []);
  assert.deepEqual(ev({ event: "kills", data: 10 }, z), ["kill"]);
  // Kommen echte kill-Events, zählt der Zähler nicht doppelt
  assert.deepEqual(ev({ event: "kill.kill", data: 11 }, z), ["kill"]);
  assert.deepEqual(ev({ event: "kills", data: 11 }, z), []);
  // Rundennummer nach der Kaufphase aus round_phase: kein zweiter Rundenstart
  const z2 = sfZustand();
  assert.deepEqual(ev({ info: { match_info: { round_phase: "shopping" } } }, z2), ["round_start"]);
  assert.deepEqual(ev({ event: "round_number", data: 4 }, z2), []);
  // Unsinn wird ignoriert
  assert.deepEqual(ev({ event: "kills", data: "abc" }, sfZustand()), []);
});

test("Shots Fired: round_number vor der Kaufphase startet die Runde nur einmal", () => {
  const z = sfZustand();
  const phase = (p) => ({ info: { match_info: { round_phase: p } } });
  assert.deepEqual(ev({ event: "round_number", data: 1 }, z), ["round_start"]);
  assert.deepEqual(ev(phase("shopping"), z), []);
  assert.deepEqual(ev(phase("combat"), z), []);
  assert.deepEqual(ev(phase("shopping"), z), ["round_start"]);
  assert.deepEqual(ev({ event: "round_number", data: 2 }, z), []);
  assert.deepEqual(ev({ event: "round_number", data: 3 }, z), ["round_start"]);
});

test("Shots Fired: headshots-Zähler, team und ui_team_order", () => {
  const z = sfZustand();
  assert.deepEqual(ev({ event: "headshots", data: 1 }, z), ["headshot"]);
  assert.deepEqual(ev({ event: "match_info.headshots", data: 3 }, z), ["headshot", "headshot"]);
  assert.deepEqual(ev({ event: "team", data: "attack" }, z), []);
  assert.deepEqual(ev({ event: "round_number", data: 3 }, z), ["round_start"]);
  assert.deepEqual(ev({ event: "ui_team_order_allies", data: JSON.stringify([{ name: "Momo" }, { name: "Ben" }]) }, z), []);
  assert.deepEqual(ev({ event: "ui team order enemies", data: "Ana, Tom" }, z), []);
  assert.deepEqual(sfInfo(z), { seite: "Angriff", team: "TEAM A", verbuendete: ["Momo", "Ben"], gegner: ["Ana", "Tom"] });
  ev({ event: "round_number", data: 13 }, z);
  assert.equal(sfInfo(z).team, "TEAM B", "Seitenwechsel nach Runde 12: im Angriff ist jetzt Blau");
  ev({ event: "team", data: "defense" }, z);
  assert.equal(sfInfo(z).team, "TEAM A");
  ev({ event: "round_number", data: 25 }, z);
  assert.equal(sfInfo(z).team, "", "Verlängerung: zu unsicher");
  // match_start setzt alles zurück
  ev({ event: "match_start" }, z);
  assert.deepEqual(sfInfo(z), { seite: "", team: "", verbuendete: [], gegner: [] });
});

test("Shots Fired: Formen von team und ui_team_order", () => {
  assert.equal(seiteVon("Attacker"), "Angriff");
  assert.equal(seiteVon({ team: "defender" }), "Verteidigung");
  assert.equal(seiteVon("blau"), "");
  assert.deepEqual(spielerVon(["A", { player_name: "B" }, { agent: "Sage" }, null, ""]), ["A", "B", "Sage"]);
  assert.deepEqual(spielerVon({ players: ["X", "Y"] }), ["X", "Y"]);
  assert.deepEqual(spielerVon('{"0":"P1","1":"P2"}'), ["P1", "P2"]);
  assert.deepEqual(spielerVon(42), []);
  assert.equal(teamAusSeite("Verteidigung", 1), "TEAM B");
  assert.equal(teamAusSeite("Angriff", null), "");
});

test("Shots Fired: Server meldet das Team aus der Seite und hält es in der Verlängerung", () => {
  const teams = [];
  const sf = new ShotsFiredServer({ onEvent: () => {}, onTeam: (t) => teams.push(t) });
  sf.verarbeiten({ event: "team", data: "attack" }, { pfad: "/valorant" });
  sf.verarbeiten({ event: "round_number", data: 1 }, { pfad: "/valorant" });
  sf.verarbeiten({ event: "round_number", data: 25 }, { pfad: "/valorant" });
  assert.deepEqual(teams, ["TEAM A"]);
  assert.equal(sf.team(), "TEAM A");
  assert.equal(sf.status().valorant.seite, "Angriff");
});
