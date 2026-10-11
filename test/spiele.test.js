const test = require("node:test");
const assert = require("node:assert/strict");
const { Regie } = require("../src/core/regie");
const { SIM_SPIELE, fuer } = require("../src/core/regie-sim");
const { standardRegie } = require("../src/core/defaults");
const { SPIELE, QUELLEN } = require("../src/core/spiele");
const { BildQuelle } = require("../src/core/bild-spiele");
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
  assert.deepEqual(QUELLEN, ["cs2", "rl", "dota2", "valorant", "finals"]);
  for (const s of SPIELE.filter((x) => x.quelle)) {
    assert.ok(s.events.length >= 5, s.id);
    if (s.id !== "finals") assert.ok(SIM_SPIELE[s.id], `Simulator für ${s.id}`);
    for (const e of s.events.filter((e) => e.fest)) assert.ok(s.teams.includes(e.fest), `${s.id}/${e.id}`);
  }
  assert.ok(SPIELE.filter((s) => s.bild).every((s) => s.quelle === "Bilderkennung"));
});

for (const spiel of ["dota2", "valorant"]) {
  test(`Simulator ${spiel}: Match läuft bis zum Ende, jedes Spielende genau einmal`, () => {
    const { ev, regie, m } = spiele(spiel);
    assert.ok(m.vorbei());
    assert.ok(ev.kill > 0 && ev.death > 0, JSON.stringify(ev));
    const ende = spiel === "dota2" ? "match_end" : "match_won";
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

test("Bilderkennung: Runden, Spike und Sieger aus Sicht eines PCs", () => {
  const q = new BildQuelle("valorant", { team: "TEAM B", name: "Momo" });
  const typen = (m, t) => q.ingest({ bild: true, ...m }, t).events.map((e) => `${e.type}${e.team ? ":" + e.team : ""}`);
  assert.deepEqual(typen({ event: "round_start" }, 0), ["match_start", "round_start"]);
  const k = q.ingest({ bild: true, event: "kill", seite: "eigen" }, 1000).events[0];
  assert.deepEqual([k.type, k.team, k.player, k.round], ["kill", "TEAM B", "Momo", 1]);
  assert.deepEqual(typen({ event: "spike_planted" }, 2000), ["spike_planted"]);
  assert.deepEqual(typen({ event: "round_end", seite: "gegner" }, 3000), ["round_end:TEAM A"]);
  assert.deepEqual(typen({ event: "round_end", seite: "eigen" }, 3500), [], "Rundenende flackert: zählt einmal");
  // Ohne erkannte Kaufphase zählt das nächste Rundenende als neue Runde
  assert.deepEqual(typen({ event: "round_end", seite: "eigen" }, 30000), ["round_end:TEAM B"]);
  assert.deepEqual(q.stand(), { runde: 2, score: { "TEAM A": 1, "TEAM B": 1 }, laeuft: true });
  assert.deepEqual(typen({ event: "match_won", seite: "gegner" }, 40000), ["match_won:TEAM A"]);
  assert.deepEqual(typen({ event: "match_won", seite: "gegner" }, 60000), [], "Sieg nur einmal");
  // Nächste Runde: neues Match, Zähler von vorn
  assert.deepEqual(typen({ event: "round_start" }, 90000), ["match_start", "round_start"]);
  assert.equal(q.status().kills, 0);
  // Unbekanntes stoppt nichts
  assert.deepEqual(q.ingest({ bild: true, event: "gibtsnicht" }).events, []);
  assert.deepEqual(q.ingest(null).events, []);
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

test("Overlay: Dota 2 und Bilderkennung zählen als Spieldaten", () => {
  const s = overlayStatus({ client: { zustand: "verbunden", session: "LAN", gesendet: 3 }, weitere: { "Dota 2": 99000, Valorant: 1 }, jetzt: 100000 });
  assert.equal(s.farbe, "ok");
  assert.match(s.text, /^Dota 2 → Session/);
});
