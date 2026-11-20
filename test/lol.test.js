const test = require("node:test");
const assert = require("node:assert/strict");
const { lolAuswerten, lolZustand } = require("../src/core/lol");
const { QuellenVorrang } = require("../src/core/quellen-vorrang");
const { BildQuelle } = require("../src/core/bild-spiele");

const spieler = [
  { riotId: "Momo#EUW", riotIdGameName: "Momo", team: "ORDER" }, { riotId: "Ally#EUW", riotIdGameName: "Ally", team: "ORDER" },
  { riotId: "Feind#EUW", riotIdGameName: "Feind", team: "CHAOS" },
];
const daten = (events, gameTime = 10) => ({ activePlayer: { riotId: "Momo#EUW", riotIdGameName: "Momo" }, allPlayers: spieler, events: { Events: events }, gameData: { gameTime } });
const kurz = (r) => r.nachrichten.map((n) => n.event + (n.seite !== "eigen" ? "/" + n.seite : ""));

test("LoL: Live Client Data API, Team, Objekte und eigene Kills", () => {
  const z = lolZustand();
  const ev = [{ EventID: 0, EventName: "GameStart", EventTime: 0 }];
  let r = lolAuswerten(daten(ev, 1), z);
  assert.equal(r.team, "BLUE");
  assert.deepEqual(kurz(r), ["match_start"]);
  ev.push({ EventID: 1, EventName: "ChampionKill", KillerName: "Momo", VictimName: "Feind", Assisters: [] },
    { EventID: 2, EventName: "FirstBlood", Recipient: "Momo" },
    { EventID: 3, EventName: "ChampionKill", KillerName: "Feind", VictimName: "Ally", Assisters: ["Momo"] },
    { EventID: 4, EventName: "TurretKilled", KillerName: "Minion_T200L0S01N0001", TurretKilled: "Turret_T1_L_03_A" },
    { EventID: 5, EventName: "DragonKill", KillerName: "Feind", DragonType: "Fire", Stolen: "True" },
    { EventID: 6, EventName: "Multikill", KillerName: "Momo", KillStreak: 2 },
    { EventID: 7, EventName: "BaronKill", KillerName: "Ally", Stolen: "False" });
  r = lolAuswerten(daten(ev, 900), z);
  assert.deepEqual(kurz(r), ["kill", "first_blood", "assist", "tower_destroyed/gegner", "dragon_killed/gegner", "objective_stolen/gegner", "double_kill", "baron_killed"]);
  assert.equal(r.nachrichten.find((n) => n.event === "baron_killed").einmal, "7", "Objekte zählt die Regie einmal");
  assert.deepEqual(kurz(lolAuswerten(daten(ev, 901), z)), [], "keine Wiederholung");
  ev.push({ EventID: 8, EventName: "GameEnd", Result: "Win" });
  assert.deepEqual(kurz(lolAuswerten(daten(ev, 1500), z)), ["match_won"]);
});

test("LoL: mitten im Spiel gestartet holt alte Ereignisse nicht nach, neues Spiel beginnt neu", () => {
  const z = lolZustand();
  const alt = [{ EventID: 0, EventName: "GameStart" }, { EventID: 1, EventName: "ChampionKill", KillerName: "Momo", VictimName: "Feind" }];
  assert.deepEqual(kurz(lolAuswerten(daten(alt, 600), z)), []);
  assert.deepEqual(kurz(lolAuswerten(daten([{ EventID: 0, EventName: "GameStart" }], 2), z)), ["match_start"]);
});

test("LoL: Events gehen durch die Quelle, Objekte mit Team und einmal-Schlüssel", () => {
  const q = new BildQuelle("lol", { team: "BLUE", name: "PC1" });
  q.ingest({ bild: true, event: "match_start", seite: "eigen" }, 0);
  const e = q.ingest({ bild: true, event: "dragon_killed", seite: "gegner", einmal: "5" }, 1000).events[0];
  assert.deepEqual([e.type, e.team, e.einmal], ["dragon_killed", "RED", "lol:5"]);
  const w = q.ingest({ bild: true, event: "match_won", seite: "eigen" }, 2000).events[0];
  assert.deepEqual([w.type, w.team], ["match_won", "BLUE"]);
});

test("Quellen-Vorrang: Shots Fired vor Overdrive vor Bilderkennung, je Event", () => {
  const v = new QuellenVorrang(60000);
  assert.equal(v.erlaubt("valorant", "bild", "kill", 0), true, "allein: Bilderkennung zählt");
  assert.equal(v.erlaubt("valorant", "shotsfired", "kill", 1000), true);
  assert.equal(v.erlaubt("valorant", "bild", "kill", 2000), false, "Shots Fired liefert Kills: Bilderkennung fällt weg");
  assert.equal(v.erlaubt("valorant", "overdrive", "kill", 2500), false);
  assert.equal(v.erlaubt("valorant", "bild", "thrifty", 3000), true, "nur die Bilderkennung kennt Thrifty");
  assert.equal(v.erlaubt("valorant", "bild", "kill", 70000), true, "Shots Fired schweigt länger als das Fenster");
  assert.equal(v.erlaubt("lol", "shotsfired", "kill", 0), true);
  assert.equal(v.erlaubt("lol", "api", "kill", 100), true);
  assert.equal(v.erlaubt("lol", "shotsfired", "kill", 200), false, "LoL: API vor Shots Fired");
  assert.equal(v.erlaubt("lol", undefined, "kill", 300), true, "Simulator ohne Quelle");
  assert.equal(v.aktiv("lol", 400), "api");
});
