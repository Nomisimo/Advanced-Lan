// Oberflächentest: optionale Elemente des Game-Stats-Screens mit Beispieldaten (Valorant).
// Prüft: Anzeige „Teams und Spieler“ einblenden (Namen beider Teams wie aus ui_team_order), Spieler-Karte (Platz 1, dann fester PC),
// Wert-Block (Punkte links, dann Kills eines Spielers), alles landet in den Einstellungen.
// Aufruf: npm run build:dev && node test/e2e/stats-elemente.e2e.js [dist-app/index.html] [Ordner für Screenshots]
// Braucht Playwright mit Chromium (nicht in den Abhängigkeiten), z. B. global: npm i -g playwright, dann mit NODE_PATH=$(npm root -g)
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
const URL = 'file://' + path.resolve(process.argv[2] || 'dist-app/index.html');
const BILDER = process.argv[3] || require('os').tmpdir();
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1480, height: 1100 } });
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
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('advancedlan_konfig'));
    c.regie.stats.an = true; c.regie.aktivesSpiel = 'valorant'; c.regie.spiele.valorant = true;
    localStorage.setItem('advancedlan_konfig', JSON.stringify(c));
    localStorage.setItem('advancedlan_regie_tab', 'screen');
  });
  await page.reload();
  await page.getByRole('button', { name: 'Stats-Screen', exact: true }).click();
  await page.getByTestId('screen-flaeche').waitFor();
  const layout = () => page.evaluate(() => JSON.parse(localStorage.getItem('advancedlan_konfig')).regie.stats.screens[0].layout);
  const flaeche = page.getByTestId('screen-flaeche');

  // 1) Teams einblenden: Beispiel-Spieler beider Teams
  await page.getByTestId('liste-events').locator('button').click();
  await page.getByTestId('liste-bestenliste').locator('button').click();
  await page.getByTestId('liste-teams').locator('button').click();
  await page.waitForTimeout(300);
  assert.ok((await layout()).elemente.find((e) => e.typ === 'teams').sichtbar);
  const txt = await flaeche.textContent();
  for (const n of ['Momo', 'Kira', 'Flux', 'Nova']) assert.ok(txt.includes(n), `Teams zeigen ${n}`);

  // 2) Spieler-Karte, Platz 1
  await page.getByTestId('spieler-neu').click();
  await page.waitForTimeout(300);
  let sp = (await layout()).elemente.find((e) => e.typ === 'spieler');
  assert.deepStrictEqual([sp.quelle, sp.rang], ['rang', 1]);
  // Fester PC
  await page.getByTestId('spieler-quelle').selectOption('PC 03');
  await page.waitForTimeout(300);
  sp = (await layout()).elemente.find((e) => e.typ === 'spieler');
  assert.strictEqual(sp.quelle, 'PC 03');
  assert.ok((await page.getByTestId(`el-${sp.id}`).getAttribute('title')).includes('PC 03'));
  assert.ok((await flaeche.textContent()).includes('Flux'), 'Karte zeigt den Spielernamen von PC 03');

  // 3) Wert: Kills eines Spielers
  await page.getByTestId('wert-neu').click();
  await page.waitForTimeout(200);
  await page.getByTestId('wert-wahl').selectOption('sp.kills');
  await page.waitForTimeout(200);
  await page.getByTestId('spieler-quelle').selectOption('PC 01');
  await page.waitForTimeout(300);
  const w = (await layout()).elemente.find((e) => e.typ === 'wert');
  assert.deepStrictEqual([w.wert, w.quelle], ['sp.kills', 'PC 01']);
  await page.screenshot({ path: BILDER + '/elemente-1.png' });

  // 4) MVP-Endscreen einblenden: bester Spieler oben, darunter das Ranking
  await page.getByTestId('liste-mvp').locator('button').click();
  await page.getByTestId('liste-mvp').click();
  await page.getByTestId('fuellen').click();
  await page.waitForTimeout(300);
  const mvp = (await layout()).elemente.find((e) => e.typ === 'mvp');
  assert.ok(mvp.sichtbar && mvp.b === 1920 && mvp.h === 1080);
  const t2 = await flaeche.textContent();
  assert.ok(t2.includes('MVP des Matches') && t2.includes('Punkte'), 'MVP und Ranking sichtbar');
  await page.screenshot({ path: BILDER + '/elemente-2-mvp.png' });

  assert.deepStrictEqual(fehler, [], 'keine Fehler auf der Seite');
  await browser.close();
  console.log('Stats-Elemente ok');
})().catch((e) => { console.error(e); process.exit(1); });
