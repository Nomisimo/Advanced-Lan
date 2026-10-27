// Oberflächentest des Planers in der Browser-Vorschau: Plätze anlegen, Regel je Ziel, eigene Zelle, {plan} in den Signalen,
// Allgemein-Bereich mit „Nur Abweichungen“, verbundene PCs im Plan, Vorlage verteilen.
// Aufruf: npm run build:dev && node test/e2e/plan.e2e.js [dist-app/index.html] [Ordner für Screenshots]
// Braucht Playwright mit Chromium (nicht in den Abhängigkeiten), z. B. global: npm i -g playwright, dann mit NODE_PATH=$(npm root -g)
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
const URL = 'file://' + path.resolve(process.argv[2] || 'dist-app/index.html');
const BILDER = process.argv[3] || require('os').tmpdir();
const konfig = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('advancedlan_konfig')));
const tab = (page, name) => page.locator('nav').getByRole('button', { name: new RegExp(`^${name}`) }).click();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1480, height: 940 } });
  page.on('pageerror', (e) => { console.log('PAGEERROR', e.message); process.exitCode = 1; });
  await page.goto(URL);
  await page.getByRole('button', { name: 'Überspringen' }).click();
  await page.locator('input[type=checkbox]').last().check();
  await page.getByRole('button', { name: "Los geht's" }).click();
  await page.getByRole('button', { name: /^Regie/ }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('advancedlan_konfig') || '{}').modus === 'regie');
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('advancedlan_konfig'));
    c.regie.targets = [{ id: 'z1', typ: 'ma3', name: 'MA3 Bühne', host: '10.0.0.5', port: 8000, optionen: {} }, { id: 'z2', typ: 'qlab', name: 'QLab Ton', host: '10.0.0.6', port: 53000, optionen: {} }];
    c.regie.session.passwort = 'lan';
    localStorage.setItem('advancedlan_konfig', JSON.stringify(c));
  });
  await page.reload();

  // Plan: 10 Plätze, Regel für MA3, PC 07 eigener Wert
  await tab(page, 'Plan');
  await page.getByRole('button', { name: 'Plätze anlegen' }).click();
  await page.locator('tbody tr').nth(9).waitFor();
  assert.equal((await konfig(page)).regie.plan.pcs.length, 10);
  const regeln = page.locator('thead input');
  await regeln.nth(0).fill('{100+nr}');
  await regeln.nth(1).fill('Kill {nr2}');
  const zeile7 = page.locator('tbody tr').nth(6);
  await zeile7.locator('input').nth(2).fill('150');
  assert.equal(await page.locator('tbody tr').nth(2).locator('input').nth(2).getAttribute('placeholder'), '103');
  assert.equal(await page.locator('tbody tr').nth(2).locator('input').nth(3).getAttribute('placeholder'), 'Kill 03');
  const c1 = await konfig(page);
  assert.equal(c1.regie.plan.regeln.z1, '{100+nr}');
  assert.equal(c1.regie.plan.pcs[6].werte.z1, '150');
  await page.screenshot({ path: path.join(BILDER, 'plan-1-plaetze.png'), fullPage: true });

  // Signale: Allgemein „Kill“ mit {plan}, Vorschau rechnet je Platz
  await tab(page, 'Signale');
  await page.getByText('gilt für jedes Spiel').waitFor();
  const kill = page.getByText('Kill', { exact: true }).first().locator('xpath=../..');
  await kill.getByRole('button', { name: 'Befehl' }).click();
  await kill.locator('select').nth(1).selectOption('go');
  await kill.locator('input').first().fill('{plan}');
  await kill.getByText(/PC 01 → \/gma3\/cmd "Go\+ Sequence 101"/).waitFor();
  const c2 = await konfig(page);
  assert.equal(c2.regie.signale.allgemein.kill[0].werte.seq, '{plan}');
  // CS2 zeigt nur Abweichungen: noch keine
  await page.getByText('Keine Abweichungen: alles kommt aus „Allgemein“.').first().waitFor();
  await page.screenshot({ path: path.join(BILDER, 'plan-2-signale-allgemein.png'), fullPage: true });
  // Alle Events zeigen: CS2-Kill erbt, dann ersetzen
  await page.getByText('In den Spielen nur Abweichungen').click();
  const csKill = page.locator('div').filter({ has: page.getByText('kill', { exact: true }) }).filter({ hasText: 'erbt 1 von Allgemein' }).last();
  await csKill.waitFor();
  await csKill.getByRole('button', { name: 'Ersetzen' }).click();
  await page.getByText('ersetzt Allgemein').first().waitFor();
  assert.deepEqual((await konfig(page)).regie.ersetzt.cs2, ['kill']);
  await page.getByText('In den Spielen nur Abweichungen').click();
  await page.getByText('ersetzt Allgemein').first().waitFor();
  await page.screenshot({ path: path.join(BILDER, 'plan-3-signale-abweichung.png'), fullPage: true });

  // Session öffnen: Vorschau-PCs PC 01 und PC 02 verbinden, Plan zeigt sie
  await tab(page, 'Session');
  await page.getByRole('button', { name: 'Öffnen' }).click();
  await tab(page, 'Plan');
  await page.getByText('GAMER-01').first().waitFor();
  // Vorlage von PC holen und verteilen
  await page.locator('select').filter({ hasText: 'Von PC übernehmen' }).selectOption('PC 01');
  await page.getByRole('button', { name: 'Holen' }).click();
  await page.getByText('Vorlage „PC 01“').waitFor();
  await page.getByRole('button', { name: 'An alle verteilen' }).click();
  await page.getByText('Vorlage aktuell').first().waitFor();
  await page.screenshot({ path: path.join(BILDER, 'plan-4-verbunden.png'), fullPage: true });

  // Control: geplante Plätze erscheinen
  await tab(page, 'Control');
  await page.getByText('geplant').first().waitFor();
  await browser.close();
  console.log('Plan OK');
})().catch((e) => { console.error(e); process.exit(1); });
