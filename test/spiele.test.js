const test = require("node:test");
const assert = require("node:assert/strict");
const { Regie } = require("../src/core/regie");
const { SIM_SPIELE, fuer } = require("../src/core/regie-sim");
const { standardRegie } = require("../src/core/defaults");
const { SPIELE, QUELLEN } = require("../src/core/spiele");
const { GepQuelle } = require("../src/core/gep-spiele");
const { DotaQuelle, dotaStartoptionen, dotaCfg } = require("../src/core/dota");
const { matchCheck } = require("../src/core/match-check");
const { overlayStatus } = require("../src/core/overlay-status");

// Ganzes simuliertes Match eines Spiels durch Quellen und Regie
function spiele(spiel, seed = 7) {
  const cfg = { ...standardRegie(), aktivesSpiel: spiel };
  let t = 0;
  const ev = {};
  const regie = new Regie({ getConfig: () => cfg, send: () => {}, emit: (typ, d) => { if (typ === "event" && !d.verworfen) ev[d.ev.type] = (ev[d.ev.type] || 0) + 1; }, now: () => t });
  const def = SIM_SPIELE[spiel];
  const pcs = Array.from({ length: def.anzahl }, (_, i) => ({ pcId: `PC ${i + 1}`, token: `sim${i}`, quelle: def.quelle() }));
  pcs.forEach((p) => regie.pcVerbunden(p.pcId, { spiele: [spiel] }));
  const m = def.match(pcs, seed);
  for (let n = 0; !m.vorbei() && n < 60; n++) {
    for (const s of m.naechsteRunde()) {
      t += Math.max(1, s.dt);
      for (const p of s.payloads) for (const pc of fuer(pcs, p)) {
        const r = pc.quelle.ingest(p, t);
        if (r.status || r.stand) regie.pcStatus(pc.pcId, { spiel, status: r.status, stand: r.stand });
        for (const e of r.events) regie.pcEvent(pc.pcId, spiel, e);
      }
    }
    t += 1500;
  }
  return { ev, regie, m, pcs };
}

test("Spiele: alle mit Datenquelle haben Events, Teams und einen Simulator", () => {
  assert.deepEqual(QUELLEN, ["cs2", "rl", "dota2", "ow2", "r6", "mr", "fn", "apex", "pubg"]);
  for (const s of SPIELE.filter((x) => x.quelle)) {
    assert.ok(s.events.length >= 5, s.id);
    assert.ok(SIM_SPIELE[s.id], `Simulator für ${s.id}`);
    for (const e of s.events.filter((e) => e.fest)) assert.ok(s.teams.includes(e.fest), `${s.id}/${e.id}`);
  }
  assert.ok(!SPIELE.some((s) => /valorant|league|tft|2xko/i.test(s.id) && s.quelle), "keine Riot-Spiele mit Datenquelle");
});

for (const spiel of ["dota2", "ow2", "r6", "mr", "fn", "apex", "pubg"]) {
  test(`Simulator ${spiel}: Match läuft bis zum Ende, jedes Spielende genau einmal`, () => {
    const { ev, regie, m } = spiele(spiel);
    assert.ok(m.vorbei());
    assert.ok(ev.kill > 0 && ev.death > 0, JSON.stringify(ev));
    const ende = ["dota2", "ow2", "mr"].includes(spiel) ? (spiel === "dota2" ? "match_end" : "match_won") : spiel === "r6" ? "match_end" : "victory";
    assert.equal(ev[ende], 1, JSON.stringify(ev));
    assert.equal(ev.match_start, 1);
    const st = regie.statistik.json();
    assert.equal(st.match.kills, ev.kill);
    assert.ok(st.match.vorbei);
    // Alle PCs im selben Match
    const mc = matchCheck(regie.snapshot().pcs, spiel);
    assert.equal(mc.anzahl, mc.gesamt);
  });
}

test("Overwolf-Spiele: Sieger aus Sicht eines PCs, Werte als Text oder JSON", () => {
  const q = new GepQuelle("ow2");
  q.ingest({ gep: true, art: "info", key: "roster_03", value: JSON.stringify({ player_name: "Momo", is_local: true, team: 1 }) }, 0);
  q.ingest({ gep: true, art: "event", key: "match_start", value: null }, 1);
  const k = q.ingest({ gep: true, art: "event", feature: "kill", key: "elimination", value: "1" }, 2).events[0];
  assert.deepEqual([k.type, k.team, k.player], ["kill", "TEAM 2", "Momo"]);
  const w = q.ingest({ gep: true, art: "info", key: "match_outcome", value: "defeat" }, 3).events[0];
  assert.deepEqual([w.type, w.team], ["match_won", "TEAM 1"]);
  // Unbekanntes und Kaputtes stoppt nichts
  assert.deepEqual(q.ingest({ gep: true, art: "info", key: "roster_04", value: "{kaputt" }, 4).events, []);
  assert.deepEqual(q.ingest(null).events, []);

  const r6 = new GepQuelle("r6");
  r6.ingest({ gep: true, art: "info", key: "roster_00", value: JSON.stringify({ player: "Kira", is_local: true, role: "defender" }) }, 0);
  assert.equal(r6.ingest({ gep: true, art: "event", key: "roundOutcome", value: "defeat" }, 1).events[0].team, "ATK");
  assert.equal(r6.ingest({ gep: true, art: "event", key: "defuser_planted" }, 2).events[0].team, "ATK");

  const fn = new GepQuelle("fn");
  fn.ingest({ gep: true, art: "event", key: "matchStart" }, 0);
  assert.equal(fn.ingest({ gep: true, art: "event", key: "killer", value: "Rex" }, 10).events[0].type, "death");
  assert.equal(fn.ingest({ gep: true, art: "event", key: "death" }, 20).events.length, 0, "Tod nur einmal");
  assert.equal(fn.ingest({ gep: true, art: "info", key: "rank", value: "1" }, 30).events[0].type, "victory");
  assert.equal(fn.ingest({ gep: true, art: "event", key: "generic", value: "won" }, 40).events.length, 0, "Sieg nur einmal");

  const mr = new GepQuelle("mr");
  mr.ingest({ gep: true, art: "event", key: "match_start" }, 0);
  assert.equal(mr.ingest({ gep: true, art: "event", key: "kill", value: { name: "kill", data: 4 } }, 1).events[0].type, "kill");
});

test("Dota 2: Kill-Serie, Turm, Roshan, Tag und Nacht, Sieger", () => {
  const q = new DotaQuelle();
  const zustand = (x = {}) => ({
    provider: { appid: 570 }, map: { matchid: "1", clock_time: 100, daytime: true, game_state: "DOTA_GAMERULES_STATE_GAME_IN_PROGRESS", win_team: "none", roshan_state: "alive", ...x.map },
    player: { steamid: "7", name: "Momo", team_name: "radiant", kills: 0, deaths: 0, assists: 0, ...x.player },
    buildings: { radiant: { dota_goodguys_tower1_top: { health: 1800 } }, ...x.buildings }, events: x.events || [],
  });
  const typen = (b, t) => q.ingest(b, t).events.map((e) => `${e.type}${e.team ? ":" + e.team : ""}`);
  assert.deepEqual(typen(zustand(), 0), []);
  assert.deepEqual(typen(zustand({ player: { kills: 1 }, map: { clock_time: 110 } }), 1000), ["kill:RADIANT"]);
  assert.deepEqual(typen(zustand({ player: { kills: 2 }, map: { clock_time: 115 } }), 2000), ["kill:RADIANT", "double_kill:RADIANT"]);
  assert.deepEqual(typen(zustand({ player: { kills: 3 }, map: { clock_time: 200 } }), 3000), ["kill:RADIANT"]);
  assert.deepEqual(typen(zustand({ player: { kills: 3 }, map: { clock_time: 300, daytime: false }, buildings: { radiant: {} } }), 4000), ["night", "tower_destroyed:DIRE"]);
  assert.deepEqual(typen(zustand({ player: { kills: 3 }, map: { roshan_state: "respawn_base", daytime: false }, buildings: { radiant: {} }, events: [{ event_type: "roshan_killed", game_time: 900 }] }), 5000), ["roshan_killed"]);
  assert.deepEqual(typen(zustand({ player: { kills: 3 }, map: { win_team: "dire", daytime: false }, buildings: { radiant: {} } }), 6000), ["match_end:DIRE"]);
  assert.deepEqual(typen(zustand({ player: { kills: 3 }, map: { win_team: "dire", daytime: false, game_state: "DOTA_GAMERULES_STATE_POST_GAME" }, buildings: { radiant: {} } }), 7000), []);
});

test("Dota 2: cfg-Datei und Startoption aus Steams localconfig.vdf", () => {
  const c = dotaCfg({ port: 3000, token: "abc" });
  assert.match(c, /"uri"\t\t"http:\/\/127\.0\.0\.1:3000\/gsi"/);
  assert.match(c, /"token"\t"abc"/);
  assert.match(c, /"buildings"\t"1"/);
  const vdf = `"UserLocalConfigStore" { "Software" { "Valve" { "Steam" { "apps" {
    "730" { "LaunchOptions" "-novid" }
    "570" { "cloud" { "last_sync_state" "synchronized" } "LaunchOptions" "-novid -gamestateintegration" "Playtime" "12" }
  } } } } }`;
  assert.equal(dotaStartoptionen(vdf), "-novid -gamestateintegration");
  assert.equal(dotaStartoptionen(`"570" { "Playtime" "3" }`), null);
  assert.equal(dotaStartoptionen(""), null);
});

test("Overlay: Dota 2 und Overwolf-Spiele zählen als Spieldaten", () => {
  const s = overlayStatus({ client: { zustand: "verbunden", session: "LAN", gesendet: 3 }, weitere: { "Dota 2": 99000, Fortnite: 1 }, jetzt: 100000 });
  assert.equal(s.farbe, "ok");
  assert.match(s.text, /^Dota 2 → Session/);
});
