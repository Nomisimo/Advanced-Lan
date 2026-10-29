// Oberflächentest des Screen-Editors (Game-Stats-Screen) in der Browser-Vorschau der gebauten App.
// Prüft: Anzeige ziehen und an der Mitte einrasten, Größe am Griff ändern, Text hinzufügen und schreiben,
// Pfeiltasten, Rückgängig, das Layout landet in den Einstellungen und der Stats-Screen (#stats) zeigt es.
// Aufruf: npm run build:dev && node test/e2e/screen-editor.e2e.js [dist-app/index.html] [Ordner für Screenshots]
// Braucht Playwright mit Chromium (nicht in den Abhängigkeiten), z. B. global: npm i -g playwright, dann mit NODE_PATH=$(npm root -g)
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
const URL = 'file://' + path.resolve(process.argv[2] || 'dist-app/index.html');
const BILDER = process.argv[3] || require('os').tmpdir();
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1480, height: 940 } });
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
    c.regie.stats.an = true; c.regie.aktivesSpiel = 'cs2'; c.regie.session.name = 'LAN-Party';
    localStorage.setItem('advancedlan_konfig', JSON.stringify(c));
    localStorage.setItem('advancedlan_regie_tab', 'screen');
  });
  await page.reload();
  // Ohne Session springt die Regie zuerst zum Tab „Session“
  await page.getByRole('button', { name: 'Stats-Screen', exact: true }).click();
  const flaeche = page.getByTestId('screen-flaeche');
  await flaeche.waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: BILDER + '/editor-1-standard.png' });
  const layout = () => page.evaluate(() => JSON.parse(localStorage.getItem('advancedlan_konfig')).regie.stats.layout);
  const box = await flaeche.boundingBox();
  const s = box.width / 1920;

  // 1) „Letzte Events“ nach links unten ziehen
  const ev = page.getByTestId('el-events');
  let b = await ev.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 300 * s, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  let e = (await layout()).elemente.find((x) => x.id === 'events');
  assert.ok(e.x < 1116 - 250 && e.x > 1116 - 350, `Events verschoben: x=${e.x}`);
  assert.strictEqual(e.y, 636, 'y bleibt');

  // 2) Größe am Griff unten rechts ändern
  b = await ev.boundingBox();
  const griff = page.getByTestId('griff-ur');
  const g = await griff.boundingBox();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + g.width / 2 - 200 * s, g.y + g.height / 2 - 100 * s, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const e2 = (await layout()).elemente.find((x) => x.id === 'events');
  assert.ok(e2.b < e.b - 150 && e2.h < e.h - 60, `Events kleiner: ${e.b}×${e.h} → ${e2.b}×${e2.h}`);
  assert.strictEqual(e2.x, e.x, 'links bleibt beim Ziehen rechts unten');

  // 3) Pfeiltaste: 10 px nach rechts
  await flaeche.focus();
  await page.keyboard.press('Shift+ArrowRight');
  await page.waitForTimeout(400);
  assert.strictEqual((await layout()).elemente.find((x) => x.id === 'events').x, e2.x + 10);

  // 4) Rückgängig
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  assert.strictEqual((await layout()).elemente.find((x) => x.id === 'events').x, e2.x);

  // 5) Text hinzufügen, schreiben, Platzhalter, in die Mitte ziehen (rastet an der Mitte ein)
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  const ta = page.getByTestId('text-eingabe');
  await ta.fill('Finale · ');
  await page.getByRole('button', { name: '{session}' }).click();
  await page.waitForTimeout(400);
  let t = (await layout()).elemente.find((x) => x.typ === 'text');
  assert.strictEqual(t.text, 'Finale · {session}');
  const tb = await page.getByTestId(`el-${t.id}`).boundingBox();
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
  await page.mouse.down();
  await page.mouse.move(tb.x + tb.width / 2 + 3 * s, tb.y + tb.height / 2 + 400 * s, { steps: 8 });
  await page.screenshot({ path: BILDER + '/editor-2-ziehen.png' });
  await page.mouse.up();
  await page.waitForTimeout(150);
  t = (await layout()).elemente.find((x) => x.typ === 'text');
  assert.strictEqual(t.x + t.b / 2, 960, `Text rastet an der Mitte ein: ${t.x}`);
  await page.screenshot({ path: BILDER + '/editor-3-text.png' });

  // 6) Anzeige ausblenden über die Liste
  await page.getByTestId('liste-zahlen').getByRole('button').click();
  await page.waitForTimeout(400);
  assert.strictEqual((await layout()).elemente.find((x) => x.id === 'zahlen').sichtbar, false);

  // 7) Stats-Screen zeigt das gespeicherte Layout mit dem Text
  const stats = await ctx.newPage();
  await stats.setViewportSize({ width: 1920, height: 1080 });
  await stats.goto(URL + '#stats');
  await stats.waitForTimeout(800);
  const inhalt = await stats.textContent('body');
  assert.ok(inhalt.includes('Finale · LAN-Party'), 'Text mit ersetztem Platzhalter auf dem Stats-Screen');
  await stats.screenshot({ path: BILDER + '/editor-4-stats.png' });

  assert.deepStrictEqual(fehler, [], 'keine Fehler auf der Seite');
  console.log('Screen-Editor ok');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
