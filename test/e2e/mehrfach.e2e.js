// Oberflächentest: Regie → Setup → „Mehrfach gemeldete Events“ in der Browser-Vorschau.
// Prüft: Standard ist „Einmal“, Umstellen speichert nur die Ausnahme, „alle auf Standard“ räumt wieder auf.
// Aufruf: npm run build:dev && node test/e2e/mehrfach.e2e.js [dist-app/index.html] [Ordner für Screenshots]
// Braucht Playwright mit Chromium (nicht in den Abhängigkeiten), z. B. global: npm i -g playwright, dann mit NODE_PATH=$(npm root -g)
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
const URL = 'file://' + path.resolve(process.argv[2] || 'dist-app/index.html');
const BILDER = process.argv[3] || require('os').tmpdir();
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  const konfig = () => page.evaluate(() => JSON.parse(localStorage.getItem('advancedlan_konfig')));
  await page.goto(URL);
  await page.getByRole('button', { name: 'Überspringen' }).click();
  await page.locator('input[type=checkbox]').last().check();
  await page.getByRole('button', { name: "Los geht's" }).click();
  await page.getByRole('button', { name: /^Regie/ }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('advancedlan_konfig') || '{}').modus === 'regie');
  await page.evaluate(() => localStorage.setItem('advancedlan_regie_tab', 'setup'));
  await page.reload();
  await page.getByRole('button', { name: 'Setup', exact: true }).click();
  await page.getByTestId('mehrfach').waitFor();
  assert.strictEqual(await page.getByTestId('mehrfach-cs2-kill').inputValue(), 'standard');
  await page.getByTestId('mehrfach-cs2-kill').selectOption('alle');
  await page.getByTestId('mehrfach-cs2-round_end').selectOption('pc');
  await page.waitForTimeout(300);
  assert.deepStrictEqual((await konfig()).regie.mehrfach, { cs2: { kill: 'alle', round_end: 'pc' } });
  await page.getByTestId('mehrfach').scrollIntoViewIfNeeded();
  await page.screenshot({ path: BILDER + '/mehrfach-setup.png', fullPage: true });
  await page.getByRole('button', { name: 'CS2: alle auf Standard' }).click();
  await page.waitForTimeout(300);
  assert.deepStrictEqual((await konfig()).regie.mehrfach, {});
  assert.deepStrictEqual(fehler, []);
  await browser.close();
  console.log('ok: Mehrfach gemeldete Events');
})().catch((e) => { console.error(e); process.exit(1); });
