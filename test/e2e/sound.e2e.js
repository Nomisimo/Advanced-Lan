// Oberflächentest: Sound-Player in der Browser-Vorschau der gebauten App.
// Prüft: Abschnitt „Sound“ im Tab Stats-Screen zeigt die Sounds nach Event, einzeln an/aus, ein ausgelöstes Event (Simulator)
// spielt bei scharfer Ausgabe genau die eingeschaltete Datei, und im Tab Signale spielt der Test-Knopf den Sound mit (Checkbox).
// Aufruf: npm run build:dev && node test/e2e/sound.e2e.js [dist-app/index.html] [Ordner für Screenshots]
// Braucht Playwright mit Chromium (nicht in den Abhängigkeiten), z. B. global: npm i -g playwright, dann mit NODE_PATH=$(npm root -g)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');
const URL = 'file://' + path.resolve(process.argv[2] || 'dist-app/index.html');
const BILDER = process.argv[3] || os.tmpdir();

// Kurze WAV-Datei (0,2 s Stille) für die Wiedergabe
function wav(datei) {
  const n = 9600, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(48000, 24); b.writeUInt32LE(96000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  fs.writeFileSync(datei, b);
  return 'file://' + datei;
}

(async () => {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'sound-'));
  const url = (name) => wav(path.join(ordner, name));
  const dateien = [
    { id: 'k1', spiel: 'valorant', event: 'kill', pfad: '/kill/k1.wav', url: url('k1.wav'), name: 'k1.wav', an: false },
    { id: 'k2', spiel: 'valorant', event: 'kill', pfad: '/kill/k2.wav', url: url('k2.wav'), name: 'k2.wav', an: false },
    { id: 'a1', spiel: 'valorant', event: 'ace', pfad: '/ace/a1.wav', url: url('a1.wav'), name: 'a1.wav', an: true },
    { id: 'r1', spiel: 'valorant', event: '', pfad: '/round_info/r1.wav', url: url('r1.wav'), name: 'r1.wav', an: false },
  ];
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1480, height: 1100 } });
  await ctx.addInitScript(() => {
    window.__gespielt = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__gespielt.push(this.src.split('/').pop()); return play.call(this); };
  });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  await page.goto(URL);
  await page.getByRole('button', { name: 'Überspringen' }).click();
  await page.locator('input[type=checkbox]').last().check();
  await page.getByRole('button', { name: "Los geht's" }).click();
  await page.getByRole('button', { name: /^Regie/ }).click();
  await page.waitForFunction(() => { const c = JSON.parse(localStorage.getItem('advancedlan_konfig') || '{}'); return c.modus === 'regie' && c.app?.einfuehrung; });
  await page.waitForTimeout(400);
  await page.evaluate((dateien) => {
    const c = JSON.parse(localStorage.getItem('advancedlan_konfig'));
    c.regie.aktivesSpiel = 'valorant'; c.regie.spiele.valorant = true;
    c.regie.sound = { an: true, nurScharf: true, dateien };
    c.regie.targets = [{ id: 'z1', typ: 'reaper', name: 'REAPER', host: '127.0.0.1', port: 8000, optionen: {} }];
    c.regie.signale = { valorant: { kill: [{ id: 's1', ziel: 'z1', befehl: 'marker_play', werte: { marker: '1' }, pc: '', team: '' }] } };
    localStorage.setItem('advancedlan_konfig', JSON.stringify(c));
  }, dateien);
  await page.reload();
  await page.getByRole('button', { name: 'Stats-Screen', exact: true }).click();
  await page.getByTestId('sound-event-kill').waitFor();
  const gruppen = await page.locator('[data-testid^=sound-event-]').evaluateAll((els) => els.map((e) => e.dataset.testid));
  assert.deepStrictEqual(gruppen, ['sound-event-kill', 'sound-event-ace', 'sound-event-ohne'], 'nach Event sortiert, ohne Zuordnung am Ende');
  // k2 einschalten
  await page.getByTestId('sound-event-kill').locator('input[type=checkbox]').nth(1).check();
  const sound = () => page.evaluate(() => JSON.parse(localStorage.getItem('advancedlan_konfig')).regie.sound);
  assert.deepStrictEqual((await sound()).dateien.filter((d) => d.an).map((d) => d.id).sort(), ['a1', 'k2']);
  await page.getByTestId('sound-event-kill').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(BILDER, 'sound-einstellungen.png') });

  // Nicht scharf: kein Sound
  await page.getByRole('button', { name: 'Simulator', exact: true }).click();
  await page.getByRole('button', { name: /^Kill/ }).first().click();
  await page.waitForTimeout(300);
  assert.deepStrictEqual(await page.evaluate(() => window.__gespielt), [], 'Ausgabe aus: still');
  // Scharf: k2 spielt, Ace spielt a1, Event ohne Sound bleibt still
  await page.getByRole('button', { name: /AUSGABE AUS/ }).click();
  await page.getByRole('button', { name: /^Kill/ }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Ace/ }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Assist/ }).first().click();
  await page.waitForTimeout(300);
  assert.deepStrictEqual(await page.evaluate(() => window.__gespielt), ['k2.wav', 'a1.wav']);

  // Tab Signale: Test-Knopf spielt den Sound des Events mit (Checkbox an), auch bei Ausgabe aus
  await page.getByRole('button', { name: /AUSGABE AN/ }).click();
  await page.evaluate(() => { window.__gespielt = []; });
  await page.getByRole('button', { name: 'Signale', exact: true }).click();
  await page.getByTestId('signal-sound-kill').waitFor();
  await page.getByTestId('signal-sound-kill').scrollIntoViewIfNeeded();
  const testKnopf = page.locator('button', { hasText: /^\s*Test$/ }).last();
  await testKnopf.click();
  await page.waitForTimeout(300);
  assert.deepStrictEqual(await page.evaluate(() => window.__gespielt), ['k2.wav'], 'Test spielt den Sound');
  await page.screenshot({ path: path.join(BILDER, 'signale-sound.png') });
  // Checkbox aus: Test bleibt still
  await page.getByText('Beim Test auch den Sound spielen').click();
  assert.strictEqual((await sound()).beimTest, false);
  await testKnopf.click();
  await page.waitForTimeout(300);
  assert.deepStrictEqual(await page.evaluate(() => window.__gespielt), ['k2.wav'], 'Checkbox aus: kein Sound');
  // Lautsprecher-Knopf am Event spielt immer
  await page.getByTestId('signal-sound-kill').click();
  await page.waitForTimeout(300);
  assert.deepStrictEqual(await page.evaluate(() => window.__gespielt), ['k2.wav', 'k2.wav']);
  assert.deepStrictEqual(fehler, []);
  console.log('Sound-Player: OK');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
