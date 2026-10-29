const test = require('node:test');
const assert = require('node:assert');
const { parseLockfile, parseGlz, valorantVersion, eigeneTeamId, appTeam } = require('../src/core/riot-team');
const { standardBild, migrateBild } = require('../src/core/bild-spiele');

test('lockfile lesen', () => {
  assert.deepStrictEqual(parseLockfile('Riot Client:1234:54321:abcDEF:https\n'), { port: 54321, passwort: 'abcDEF', protokoll: 'https' });
  assert.strictEqual(parseLockfile(''), null);
  assert.strictEqual(parseLockfile('Riot Client:1:x:pw:https'), null);
});

test('Region und Shard aus ShooterGame.log, die letzte zählt', () => {
  const log = 'x https://glz-na-1.na.a.pvp.net/session y\n... https://glz-eu-1.eu.a.pvp.net/parties/v1/players';
  assert.deepStrictEqual(parseGlz(log), { region: 'eu', shard: 'eu' });
  assert.strictEqual(parseGlz('nichts'), null);
});

test('Valorant-Version aus den Sitzungen', () => {
  assert.strictEqual(valorantVersion({ a: { productId: 'riot_client', version: '1' }, b: { productId: 'valorant', version: 'release-09.08-shipping-15-2734597' } }), 'release-09.08-shipping-15-2734597');
  assert.strictEqual(valorantVersion({}), '');
});

test('Team des Spielers im Match und in der Agentenwahl', () => {
  const core = { Players: [{ Subject: 'a', TeamID: 'Blue' }, { Subject: 'b', TeamID: 'Red' }] };
  assert.strictEqual(eigeneTeamId(core, 'b'), 'Red');
  assert.strictEqual(eigeneTeamId({ AllyTeam: { TeamID: 'Blue', Players: [{ Subject: 'a' }] } }, 'a'), 'Blue');
  assert.strictEqual(eigeneTeamId({ Teams: [{ TeamID: 'Red', Players: [{ Subject: 'x' }] }, { TeamID: 'Blue', Players: [{ Subject: 'y' }] }] }, 'y'), 'Blue');
  assert.strictEqual(eigeneTeamId(core, 'fremd'), '');
  assert.strictEqual(appTeam('Red'), 'TEAM A');
  assert.strictEqual(appTeam('Blue'), 'TEAM B');
  assert.strictEqual(appTeam('Neutral'), '');
});

test('Valorant: Team automatisch ist Standard, abschaltbar, nur für Riot-Spiele', () => {
  const d = standardBild();
  assert.strictEqual(d.spiele.valorant.teamAuto, true);
  assert.strictEqual(d.spiele.finals.teamAuto, false);
  assert.strictEqual(migrateBild({ spiele: { valorant: { team: 'TEAM B', teamAuto: false } } }).spiele.valorant.teamAuto, false);
  assert.strictEqual(migrateBild({ spiele: { valorant: { team: 'TEAM B' } } }).spiele.valorant.teamAuto, true);
});
