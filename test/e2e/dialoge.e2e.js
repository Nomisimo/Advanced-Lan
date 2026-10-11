// Oberflächentest der eigenen Dialoge (statt alert/confirm) in der Browser-Vorschau der gebauten App.
// Prüft: Dialog öffnet mit Fokus auf OK, Tab bleibt im Dialog, Escape bricht ab, Fokus kommt zurück,
// danach lassen sich Textfelder bedienen, und es erscheint nie ein nativer Dialog.
// Aufruf: npm run build:dev && node test/e2e/dialoge.e2e.js [dist-app/index.html] [Ordner für Screenshots]
// Braucht Playwright mit Chromium (nicht in den Abhängigkeiten), z. B. global: npm i -g playwright, dann mit NODE_PATH=$(npm root -g)
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
const URL = 'file://' + path.resolve(process.argv[2] || 'dist-app/index.html');
const BILDER = process.argv[3] || require('os').tmpdir();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1480, height: 940 } });
  let native = 0;
  page.on('dialog', (d) => { native++; d.dismiss(); });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.addInitScript(() => {
    localStorage.setItem('advancedlan_regie_tab', 'ziele');
  });
  await page.goto(URL);
  // Einführung überspringen, zustimmen, Regie wählen
  await page.getByRole('button', { name: 'Überspringen' }).click();
  await page.locator('input[type=checkbox]').last().check();
  await page.getByRole('button', { name: "Los geht's" }).click();
  await page.getByRole('button', { name: /^Regie/ }).click();
  await page.getByRole('button', { name: 'Ziele' }).waitFor();
  await page.waitForFunction(() => { const c = JSON.parse(localStorage.getItem('advancedlan_konfig') || '{}'); return c.modus === 'regie' && c.app?.einfuehrung; });
  await page.waitForTimeout(500);
  // Zwei Ziele, eines davon in einem Signal-Befehl benutzt
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('advancedlan_konfig'));
    c.regie.targets = [
      { id: 'z1', typ: c.regie.targets[0]?.typ || 'ma3', name: 'MA3 Bühne', host: '192.168.1.50', port: 8000, optionen: {} },
      { id: 'z2', typ: 'ma3', name: 'MA3 Backup', host: '192.168.1.51', port: 8000, optionen: {} },
    ];
    c.regie.signale = { cs2: { round_end: [{ id: 's1', ziel: 'z1', befehl: 'go', werte: {} }] } };
    localStorage.setItem('advancedlan_konfig', JSON.stringify(c));
  });
  await page.reload();
  const dlg = page.getByTestId('ui-dialog');
  const name = page.locator('table input').first();
  await page.getByRole('button', { name: 'Ziele' }).click(); await name.waitFor();
  await page.screenshot({ path: BILDER + '/0-ziele.png' });

  // 1) Ziel löschen, das in Signalen benutzt wird -> eigener Dialog, Escape bricht ab
  const zeilen = await page.locator('table tbody tr').count();
  let geloescht = false;
  for (let i = 0; i < zeilen && !geloescht; i++) {
    const row = page.locator('table tbody tr').nth(i);
    const btn = row.locator('button').last();
    if (!(await btn.count())) continue;
    await btn.click();
    if (await dlg.isVisible().catch(() => false)) {
      await page.screenshot({ path: BILDER + '/1-dialog.png' });
      assert.strictEqual(await page.evaluate(() => document.activeElement.textContent), 'OK', 'OK-Button hat den Fokus');
      // Tab bleibt im Dialog
      await page.keyboard.press('Tab');
      assert.strictEqual(await page.evaluate(() => document.activeElement.textContent), 'Abbrechen');
      await page.keyboard.press('Tab');
      assert.strictEqual(await page.evaluate(() => document.activeElement.textContent), 'OK');
      await page.keyboard.press('Escape');
      await dlg.waitFor({ state: 'detached' });
      assert.strictEqual(await page.locator('table tbody tr').count(), zeilen, 'Escape löscht nichts');
      assert.ok(await btn.evaluate((b) => document.activeElement === b), 'Fokus zurück auf dem Löschen-Knopf');
      geloescht = true;
    }
  }
  assert.ok(geloescht, 'kein Ziel mit Signal-Befehlen gefunden');

  // Danach in ein Textfeld tippen
  await name.click();
  await name.fill('');
  await page.keyboard.type('Bühne Links');
  assert.strictEqual(await name.inputValue(), 'Bühne Links');

  // 2) Modus wechseln -> Abbrechen per Klick, danach tippen
  await name.focus();
  await page.locator('button[title^="Modus wechseln"]').click();
  await dlg.waitFor();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await dlg.waitFor({ state: 'detached' });
  await name.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' 2');
  assert.strictEqual(await name.inputValue(), 'Bühne Links 2');

  // 3) Ziel wirklich löschen mit Enter (OK)
  const vorher = await page.locator('table tbody tr').count();
  for (let i = 0; i < vorher; i++) {
    const row = page.locator('table tbody tr').nth(i);
    const btn = row.locator('button').last();
    if (!(await btn.count())) continue;
    await btn.click();
    if (await dlg.isVisible().catch(() => false)) { await page.keyboard.press('Enter'); await dlg.waitFor({ state: 'detached' }); break; }
  }
  assert.ok(await page.locator('table tbody tr').count() < vorher, 'OK löscht das Ziel');
  const feld = page.locator('table input').first();
  await feld.click(); await feld.fill(''); await page.keyboard.type('Nach dem Löschen');
  assert.strictEqual(await feld.inputValue(), 'Nach dem Löschen');

  // 4) Control: Zähler zurücksetzen mit OK, mehrere Dialoge nacheinander (Warteschlange)
  await page.getByRole('button', { name: 'Control' }).click();
  await page.locator('button[title^="Zähler auf null"]').click();
  await dlg.waitFor();
  await page.getByRole('button', { name: 'OK' }).click();
  await dlg.waitFor({ state: 'detached' });
  await page.getByText('Zähler zurückgesetzt.').waitFor();

  // 5) Wechsel zum Modus bestätigen -> Moduswahl erscheint
  await page.locator('button[title^="Modus wechseln"]').click();
  await dlg.waitFor();
  await page.keyboard.press('Enter');
  await page.getByText('Game-PC').first().waitFor();
  await page.screenshot({ path: BILDER + '/2-modus.png' });

  assert.strictEqual(native, 0, 'kein nativer Dialog');
  console.log('OK: alle Schritte bestanden, native Dialoge:', native);
  await browser.close();
})().catch(async (e) => { console.error('FEHLER', e.message); process.exit(1); });
