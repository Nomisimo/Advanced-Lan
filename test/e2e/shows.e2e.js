// Oberflächentest der Shows in der Browser-Vorschau der gebauten App: speichern, ändern, leere Show, wieder laden,
// Export und Import. Standalone zeigt Regie- und Game-PC-Shows.
// Aufruf: npm run build:dev && node test/e2e/shows.e2e.js [dist-app/index.html] [Ordner für Screenshots]
// Braucht Playwright mit Chromium (nicht in den Abhängigkeiten), z. B. global: npm i -g playwright, dann mit NODE_PATH=$(npm root -g)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const URL = 'file://' + path.resolve(process.argv[2] || 'dist-app/index.html');
const BILDER = process.argv[3] || require('os').tmpdir();
const konfig = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('advancedlan_konfig')));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1480, height: 940 }, acceptDownloads: true });
  let native = 0;
  page.on('dialog', (d) => { native++; d.dismiss(); });
  page.on('pageerror', (e) => { console.log('PAGEERROR', e.message); process.exitCode = 1; });
  await page.goto(URL);
  await page.getByRole('button', { name: 'Überspringen' }).click();
  await page.locator('input[type=checkbox]').last().check();
  await page.getByRole('button', { name: "Los geht's" }).click();
  await page.getByRole('button', { name: /^Regie/ }).click();
  await page.getByTestId('show-knopf').waitFor();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('advancedlan_konfig') || '{}').modus === 'regie');
  // Ein Ziel anlegen (wie aus der Oberfläche), dann als Show speichern
  await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('advancedlan_konfig')); c.regie.targets = [{ id: 'z1', typ: 'ma3', name: 'MA3 Bühne', host: '10.0.0.5', port: 8000, optionen: {} }]; localStorage.setItem('advancedlan_konfig', JSON.stringify(c)); });
  await page.reload();
  await page.getByTestId('show-knopf').click();
  const dlg = page.getByTestId('show-dialog');
  await dlg.getByLabel('Name der Show').fill('LAN Herbst');
  await dlg.getByRole('button', { name: 'Speichern' }).click();
  await dlg.getByText('„LAN Herbst“ geladen, alles gespeichert').waitFor();
  await page.screenshot({ path: path.join(BILDER, 'show-1-gespeichert.png') });
  // Exportieren
  const [dl] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: /Exportieren/ }).click()]);
  const exportPfad = path.join(BILDER, 'LAN Herbst.alshow');
  await dl.saveAs(exportPfad);
  const datei = JSON.parse(fs.readFileSync(exportPfad, 'utf8'));
  assert.equal(datei.art, 'regie');
  assert.equal(datei.daten.targets[0].name, 'MA3 Bühne');
  // Leere Show: Ziel weg, Knopf ohne Namen
  await dlg.getByRole('button', { name: 'Leere Show laden' }).click();
  await dlg.getByText('Keine Show geladen').waitFor();
  assert.equal((await konfig(page)).regie.targets.length, 0);
  // Gespeicherte Show wieder laden
  await dlg.getByRole('button', { name: 'Laden', exact: true }).click();
  await dlg.getByText('„LAN Herbst“ geladen, alles gespeichert').waitFor();
  assert.equal((await konfig(page)).regie.targets.length, 1);
  await page.keyboard.press('Escape');
  assert.match(await page.getByTestId('show-knopf').innerText(), /LAN Herbst/);
  // Geänderte Show: Punkt am Knopf, Rückfrage vor „Leere Show laden“, Abbrechen behält alles
  await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('advancedlan_konfig')); c.regie.targets[0].port = 9000; localStorage.setItem('advancedlan_konfig', JSON.stringify(c)); });
  await page.reload();
  await page.getByTestId('show-knopf').getByTitle('Ungespeicherte Änderungen').waitFor();
  await page.getByTestId('show-knopf').click();
  await dlg.getByRole('button', { name: 'Leere Show laden' }).click();
  await page.getByTestId('ui-dialog').getByText(/nicht als Show gespeichert/).waitFor();
  await page.screenshot({ path: path.join(BILDER, 'show-3-rueckfrage.png') });
  await page.getByTestId('ui-dialog').getByRole('button', { name: 'Abbrechen' }).click();
  assert.equal((await konfig(page)).regie.targets[0].port, 9000);
  await page.keyboard.press('Escape');
  // Standalone: beide Shows, Import einer Regie-Show
  await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('advancedlan_konfig')); c.modus = 'standalone'; c.regie.targets = []; c.shows.regie = { name: '', stand: '' }; localStorage.setItem('advancedlan_konfig', JSON.stringify(c)); });
  await page.reload();
  await page.getByTestId('show-knopf').click();
  await dlg.getByRole('button', { name: /^Game-PC-Show/ }).click();
  await dlg.getByText('Gespeicherte Game-PC-Shows').waitFor();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), dlg.getByRole('button', { name: /Importieren/ }).click()]);
  await chooser.setFiles(exportPfad);
  await dlg.getByText('„LAN Herbst“ geladen, alles gespeichert').waitFor();
  assert.equal((await konfig(page)).regie.targets.length, 1, 'Regie-Show in Standalone importiert');
  assert.equal((await konfig(page)).regie.armed, false);
  await page.screenshot({ path: path.join(BILDER, 'show-2-standalone.png') });
  assert.equal(native, 0, 'kein nativer Dialog');
  await browser.close();
  console.log('Shows OK');
})().catch((e) => { console.error(e); process.exit(1); });
