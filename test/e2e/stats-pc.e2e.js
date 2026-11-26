// Oberflächentest: Stats-Screen-PCs in der Browser-Vorschau (ohne UDP).
// Prüft: Regie → Setup zeigt „Stats-Screen-PCs“ (Senden an/aus, Port), Modus „Stats-Screen“ in der Moduswahl,
// die Oberfläche des Stats-PCs mit den Screens und gespeicherten Einstellungen.
// Aufruf: npm run build:dev && node test/e2e/stats-pc.e2e.js [dist-app/index.html] [Ordner für Screenshots]
// Braucht Playwright mit Chromium (nicht in den Abhängigkeiten), z. B. global: npm i -g playwright, dann mit NODE_PATH=$(npm root -g)
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
const URL = 'file://' + path.resolve(process.argv[2] || 'dist-app/index.html');
const BILDER = process.argv[3] || require('os').tmpdir();
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  const konfig = () => page.evaluate(() => JSON.parse(localStorage.getItem('advancedlan_konfig')));
  await page.goto(URL);
  await page.getByRole('button', { name: 'Überspringen' }).click();
  await page.locator('input[type=checkbox]').last().check();
  await page.getByRole('button', { name: "Los geht's" }).click();
  // Moduswahl: Stats-Screen ist da
  assert.ok(await page.getByTestId('modus-stats').isVisible());
  await page.getByRole('button', { name: /^Regie/ }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('advancedlan_konfig') || '{}').modus === 'regie');
  await page.evaluate(() => localStorage.setItem('advancedlan_regie_tab', 'setup'));
  await page.reload();
  await page.getByRole('button', { name: 'Setup', exact: true }).click();
  await page.getByTestId('statssync').waitFor();
  assert.ok((await page.getByTestId('statssync').textContent()).includes('Noch kein Stats-PC angemeldet'));
  await page.getByText('Senden', { exact: true }).click();
  await page.waitForTimeout(300);
  assert.strictEqual((await konfig()).regie.statsSync.an, false, 'Senden aus');
  await page.screenshot({ path: BILDER + '/statspc-1-regie-setup.png', fullPage: true });

  // Stats-PC
  await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('advancedlan_konfig')); c.modus = 'stats'; localStorage.setItem('advancedlan_konfig', JSON.stringify(c)); });
  await page.reload();
  await page.getByTestId('statspc-status').waitFor();
  assert.ok(await page.getByTestId('statspc-screen-haupt').isVisible(), 'Screen der Regie in der Liste');
  await page.getByTestId('statspc-regie').fill('192.168.1.5');
  await page.getByTestId('statspc-regie').press('Enter');
  await page.waitForTimeout(300);
  assert.strictEqual((await konfig()).statspc.regie, '192.168.1.5');
  assert.strictEqual((await konfig()).statspc.vollbildStart, false, 'Fenster normal, nicht gleich Vollbild');
  await page.screenshot({ path: BILDER + '/statspc-2-app.png', fullPage: true });

  // Screen der Regie als eigenen kopieren: landet im Editor, die Regie-Screens bleiben
  await page.getByTestId('statspc-kopie-haupt').click();
  await page.getByTestId('screen-flaeche').waitFor();
  let k = await konfig();
  assert.strictEqual(k.statspc.eigene.screens.length, 1, 'eigener Screen angelegt');
  const eigen = k.statspc.eigene.screens[0];
  assert.ok(eigen.name.includes('(eigen)') && eigen.id !== 'haupt');
  assert.strictEqual(k.regie.stats.screens.length, 1, 'Screens der Regie unverändert');
  // Im Editor ändern: Text hinzufügen
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await page.waitForTimeout(500);
  k = await konfig();
  assert.ok(k.statspc.eigene.screens[0].layout.elemente.some((e) => e.typ === 'text'), 'Text im eigenen Screen gespeichert');
  await page.getByTestId('screen-name').fill('Mein Beamer');
  await page.getByTestId('screen-name').press('Enter');
  await page.waitForTimeout(300);
  assert.strictEqual((await konfig()).statspc.eigene.screens[0].name, 'Mein Beamer');
  await page.screenshot({ path: BILDER + '/statspc-3-eigene.png', fullPage: true });
  // In der Liste: Regie-Screen und eigener
  await page.getByRole('button', { name: /^Screens/ }).click();
  assert.ok(await page.getByTestId(`statspc-screen-${eigen.id}`).isVisible(), 'eigener Screen in der Liste');
  assert.ok((await page.getByTestId(`statspc-screen-${eigen.id}`).textContent()).includes('eigen'));

  // Daten: alles, was ankommt
  await page.getByRole('button', { name: 'Daten', exact: true }).click();
  await page.getByTestId('daten-empfang').waitFor();
  assert.ok((await page.locator('main').textContent()).includes('Rohdaten'));
  await page.screenshot({ path: BILDER + '/statspc-4-daten.png', fullPage: true });

  // Letzten eigenen Screen löschen geht
  await page.getByRole('button', { name: /^Eigene Screens/ }).click();
  await page.getByTestId('screen-loeschen').click();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.getByTestId('eigen-neu').waitFor();
  assert.strictEqual((await konfig()).statspc.eigene.screens.length, 0);

  assert.deepStrictEqual(fehler, [], 'keine Fehler auf der Seite');
  await browser.close();
  console.log('Stats-PC ok');
})().catch((e) => { console.error(e); process.exit(1); });
