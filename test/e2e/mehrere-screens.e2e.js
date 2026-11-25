// Oberflächentest: mehrere Game-Stats-Screens in der Browser-Vorschau der gebauten App.
// Prüft: neuen kleinen Screen (800×200, nur Spielstand) anlegen, er bekommt eine eigene NDI-Quelle, die Arbeitsfläche hat sein Format,
// Größe ändern hält die Elemente in der Fläche, „Ganzen Screen füllen“, Screens wechseln, löschen, und #stats=<id> zeigt genau diesen Screen.
// Aufruf: npm run build:dev && node test/e2e/mehrere-screens.e2e.js [dist-app/index.html] [Ordner für Screenshots]
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
    c.regie.stats.an = true; c.regie.aktivesSpiel = 'cs2';
    localStorage.setItem('advancedlan_konfig', JSON.stringify(c));
    localStorage.setItem('advancedlan_regie_tab', 'screen');
  });
  await page.reload();
  // Ohne Session springt die Regie zuerst zum Tab „Session“
  await page.getByRole('button', { name: 'Stats-Screen', exact: true }).click();
  await page.getByTestId('screen-flaeche').waitFor();
  const stats = () => page.evaluate(() => JSON.parse(localStorage.getItem('advancedlan_konfig')).regie.stats);

  // 1) Neuer Screen 800×200 nur mit dem Spielstand
  await page.getByTestId('screen-neu').click();
  await page.getByTestId('neu-name').fill('Score-Leiste');
  await page.getByTestId('neu-b').fill('800');
  await page.getByTestId('neu-h').fill('200');
  await page.getByTestId('neu-vorlage').selectOption('spielstand');
  await page.getByTestId('neu-anlegen').click();
  await page.waitForTimeout(300);
  let st = await stats();
  assert.strictEqual(st.screens.length, 2);
  const neu = st.screens[1];
  assert.strictEqual(st.aktiv, neu.id, 'neuer Screen ist gewählt');
  assert.deepStrictEqual([neu.name, neu.b, neu.h, neu.layout.hintergrund], ['Score-Leiste', 800, 200, 'transparent']);
  assert.notStrictEqual(neu.ndiName, st.screens[0].ndiName, 'eigener NDI-Name');
  const sp = neu.layout.elemente.find((e) => e.typ === 'spielstand');
  assert.deepStrictEqual([sp.x, sp.y, sp.b, sp.h, sp.sichtbar], [0, 0, 800, 200, true]);
  assert.strictEqual(neu.layout.elemente.filter((e) => e.sichtbar).length, 1, 'nur der Spielstand ist sichtbar');
  // Arbeitsfläche im Format 4:1
  const box = await page.getByTestId('screen-flaeche').boundingBox();
  assert.ok(Math.abs(box.width / box.height - 4) < 0.05, `Fläche 4:1: ${box.width}×${box.height}`);
  await page.screenshot({ path: BILDER + '/screens-1-klein.png' });

  // 2) Größe ändern: 400×100 mit „Inhalt mitskalieren“ → Spielstand füllt weiter den Screen
  await page.getByText('Inhalt mitskalieren').click();
  await page.getByTestId('screen-b').fill('400');
  await page.getByTestId('screen-h').fill('100');
  await page.getByTestId('screen-h').press('Enter');
  await page.waitForTimeout(300);
  st = await stats();
  let k = st.screens[1];
  assert.deepStrictEqual([k.b, k.h], [400, 100]);
  assert.ok(k.layout.elemente.every((e) => e.x + e.b <= 400 && e.y + e.h <= 100), 'alles in der Fläche');
  const sp2 = k.layout.elemente.find((e) => e.typ === 'spielstand');
  assert.deepStrictEqual([sp2.x, sp2.y, sp2.b, sp2.h], [0, 0, 400, 100]);

  // 3) Element verkleinern, dann „Ganzen Screen füllen“
  await page.getByTestId('liste-spielstand').click();
  await page.getByTestId('eigenschaften').getByRole('spinbutton').nth(2).fill('200');
  await page.waitForTimeout(300);
  assert.strictEqual((await stats()).screens[1].layout.elemente.find((e) => e.typ === 'spielstand').b, 200);
  await page.getByTestId('fuellen').click();
  await page.waitForTimeout(300);
  assert.strictEqual((await stats()).screens[1].layout.elemente.find((e) => e.typ === 'spielstand').b, 400);

  // 3b) Eigener Verlauf je Element: dahinter, dann davor
  await page.getByTestId('el-verlauf-lage-hinter').click();
  await page.waitForTimeout(300);
  let el = (await stats()).screens[1].layout.elemente.find((e) => e.typ === 'spielstand');
  assert.ok(el.verlaufLage === 'hinter' && el.verlauf?.stopps?.length >= 2, 'Verlauf hinter dem Spielstand');
  assert.ok(await page.getByTestId('verlauf-editor').isVisible(), 'Verlauf-Editor am Element');
  assert.strictEqual(await page.locator('[data-testid=screen-flaeche] [data-verlauf=hinter]').count(), 1, 'Ebene hinter dem Inhalt');
  await page.getByTestId('el-verlauf-lage-vor').click();
  await page.waitForTimeout(300);
  el = (await stats()).screens[1].layout.elemente.find((e) => e.typ === 'spielstand');
  assert.strictEqual(el.verlaufLage, 'vor');
  assert.strictEqual(await page.locator('[data-testid=screen-flaeche] [data-verlauf=vor]').count(), 1, 'Ebene vor dem Inhalt');
  await page.screenshot({ path: BILDER + '/screens-1b-verlauf-element.png' });

  // 4) Zurück zum Haupt-Screen: 1920×1080, Layout unverändert
  await page.getByTestId('screen-haupt').click();
  await page.waitForTimeout(300);
  const box2 = await page.getByTestId('screen-flaeche').boundingBox();
  assert.ok(Math.abs(box2.width / box2.height - 16 / 9) < 0.02, `Haupt-Screen 16:9: ${box2.width}×${box2.height}`);
  assert.strictEqual((await stats()).screens[0].layout.elemente.filter((e) => e.sichtbar).length, 8);
  // Ausgabe-Liste zeigt beide Screens
  assert.ok(await page.getByTestId('ausgabe-haupt').isVisible());
  assert.ok(await page.getByTestId(`ausgabe-${k.id}`).isVisible());

  // 4b) Netzwerkkarte für NDI wählen
  await page.locator('[data-testid=ndi-karte] select').selectOption('Ethernet 2 (Licht)');
  await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('advancedlan_konfig')).regie.netz.ndi), 'Ethernet 2 (Licht)');

  // 5) #stats=<id> zeigt genau den kleinen Screen
  const p2 = await ctx.newPage();
  await p2.setViewportSize({ width: 800, height: 200 });
  await p2.goto(URL + '#stats=' + k.id);
  await p2.waitForTimeout(800);
  const buehne = await p2.evaluate(() => { const d = [...document.querySelectorAll('div')].find((x) => x.style.width === '400px' && x.style.height === '100px' && x.style.position === 'relative'); return d ? d.style.background : null; });
  assert.strictEqual(buehne, 'transparent', 'Bühne 400×100, transparent');
  assert.strictEqual(await p2.title(), 'Advanced LAN · Score-Leiste');
  assert.strictEqual(await p2.locator('[data-verlauf=vor]').count(), 1, 'Verlauf vor dem Spielstand auch auf dem Stats-Screen');
  await p2.screenshot({ path: BILDER + '/screens-2-stats-klein.png' });
  await p2.close();

  // 6) Kleinen Screen löschen
  await page.getByTestId(`screen-${k.id}`).click();
  await page.getByRole('button', { name: 'Löschen' }).first().click();
  await page.getByRole('button', { name: 'OK' }).click();
  await page.waitForTimeout(300);
  st = await stats();
  assert.strictEqual(st.screens.length, 1);
  assert.strictEqual(st.aktiv, 'haupt');

  assert.deepStrictEqual(fehler, [], 'keine Fehler auf der Seite');
  await browser.close();
  console.log('Mehrere Screens ok');
})().catch((e) => { console.error(e); process.exit(1); });
