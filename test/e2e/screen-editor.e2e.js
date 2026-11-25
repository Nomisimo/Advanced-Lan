// Oberflächentest des Screen-Editors (Game-Stats-Screen) in der Browser-Vorschau der gebauten App.
// Prüft: Anzeige ziehen und an der Mitte einrasten, Größe am Griff ändern, Text hinzufügen und schreiben,
// Pfeiltasten, Rückgängig, Inhalt skaliert mit dem Block, Schrift wächst an den Ecken, Bild als Block (Seitenverhältnis bleibt),
// eigener Verlauf als Hintergrund, das Layout landet in den Einstellungen und der Stats-Screen (#stats) zeigt es.
// Aufruf: npm run build:dev && node test/e2e/screen-editor.e2e.js [dist-app/index.html] [Ordner für Screenshots]
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
  const layout = () => page.evaluate(() => JSON.parse(localStorage.getItem('advancedlan_konfig')).regie.stats.screens[0].layout);
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

  const ziehe = async (loc, dx, dy) => {
    const r = await loc.boundingBox();
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width / 2 + dx * s, r.y + r.height / 2 + dy * s, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(150);
  };

  // 7) Schrift wächst mit dem Block, wenn man an der Ecke zieht
  await page.getByTestId(`el-${t.id}`).click();
  await ziehe(page.getByTestId('griff-ur'), 300, 60);
  const t2 = (await layout()).elemente.find((x) => x.id === t.id);
  assert.ok(t2.groesse > t.groesse + 10, `Schrift größer: ${t.groesse} → ${t2.groesse}`);

  // 8) Inhalt einer Anzeige skaliert mit: Bestenliste kleiner ziehen
  await page.getByTestId('liste-bestenliste').click();
  await ziehe(page.getByTestId('griff-ur'), -420, -160);
  const bl = (await layout()).elemente.find((x) => x.id === 'bestenliste');
  assert.ok(bl.b < 700, `Bestenliste schmaler: ${bl.b}`);
  const skala = await flaeche.evaluate(() => [...document.querySelectorAll('[data-leer] div')].map((d) => d.style.transform).find((tr) => /^scale\(0\./.test(tr)));
  assert.ok(skala, 'Inhalt der Bestenliste ist skaliert');
  await page.getByTestId('zoom').fill('130');
  await page.waitForTimeout(400);
  assert.strictEqual((await layout()).elemente.find((x) => x.id === 'bestenliste').zoom, 130);
  await page.screenshot({ path: BILDER + '/editor-5-skaliert.png' });

  // 9) Bild als Block: Dateiauswahl, landet verkleinert als WebP im Layout
  const [wahl] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Bild hinzufügen' }).click()]);
  await wahl.setFiles(path.resolve(__dirname, '../../assets/app-icon/icon.png'));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('advancedlan_konfig')).regie.stats.screens[0].layout.elemente.some((e) => e.typ === 'bild'));
  let lay = await layout();
  const bild = lay.elemente.find((x) => x.typ === 'bild');
  assert.ok(lay.bilder[bild.bild].startsWith('data:image/webp;base64,'), 'Bild als WebP gespeichert');
  assert.strictEqual(bild.b, bild.h, 'quadratisches Icon: Block quadratisch');
  // An der Ecke größer ziehen: Seitenverhältnis bleibt
  await ziehe(page.getByTestId('griff-ul'), -120, -40);
  const bild2 = (await layout()).elemente.find((x) => x.id === bild.id);
  assert.ok(bild2.b > bild.b && Math.abs(bild2.b - bild2.h) <= 1, `Bild größer, quadratisch: ${bild2.b}×${bild2.h}`);
  assert.strictEqual(bild2.x + bild2.b, bild.x + bild.b, 'rechte Kante bleibt');
  await page.screenshot({ path: BILDER + '/editor-6-bild.png' });

  // 10) Eigener Verlauf als Hintergrund: Vorlage, Farbstopp hinzufügen und ziehen
  await page.mouse.click(box.x + 6, box.y + 6);
  await page.getByTestId('hg-eigen').click();
  await page.getByTitle('Neon').click();
  await page.getByTestId('verlauf-leiste').scrollIntoViewIfNeeded();
  const leiste = await page.getByTestId('verlauf-leiste').boundingBox();
  await page.mouse.click(leiste.x + leiste.width * 0.25, leiste.y + leiste.height / 2);
  await page.waitForTimeout(150);
  const st = await page.getByTestId('stopp-0').boundingBox();
  await page.mouse.move(st.x + st.width / 2, st.y + st.height / 2);
  await page.mouse.down();
  await page.mouse.move(st.x + st.width / 2 + leiste.width * 0.1, st.y + st.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.getByTestId('verlauf-winkel').fill('160');
  await page.waitForTimeout(400);
  lay = await layout();
  assert.strictEqual(lay.hintergrund, 'eigen');
  assert.strictEqual(lay.hg.verlauf.stopps.length, 4, 'Neon hat 3 Stopps, einer dazu');
  assert.ok(lay.hg.verlauf.stopps[0].pos >= 8, `erster Stopp gezogen: ${lay.hg.verlauf.stopps[0].pos}`);
  assert.strictEqual(lay.hg.verlauf.winkel, 160);
  await page.screenshot({ path: BILDER + '/editor-7-verlauf.png' });
  await page.evaluate(() => window.scrollTo(0, 0));
  // Rückgängig nimmt den Winkel als einen Schritt zurück
  await flaeche.focus();
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  assert.notStrictEqual((await layout()).hg.verlauf.winkel, 160);
  await page.keyboard.press('Control+y');
  await page.waitForTimeout(150);

  // 11) Darstellung: Letzte Events halb durchsichtig, Kachel ohne Hintergrund
  await page.getByTestId('liste-events').click();
  await page.getByTestId('stil-deckkraft').fill('60');
  await page.getByTestId('stil-kachel').fill('0');
  await page.waitForTimeout(400);
  const evS = (await layout()).elemente.find((x) => x.id === 'events');
  assert.deepStrictEqual([evS.deckkraft, evS.kachel], [60, 0]);
  await page.getByRole('button', { name: 'Darstellung auf alle Elemente übertragen' }).click();
  await page.waitForTimeout(400);
  assert.ok((await layout()).elemente.every((x) => x.kachel === 0 && x.deckkraft === 60), 'Darstellung auf alle übertragen');
  await page.keyboard.press('Control+z');
  await flaeche.focus();
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  assert.strictEqual((await layout()).elemente.find((x) => x.id === 'spielstand').kachel, 92, 'Rückgängig nimmt das Übertragen zurück');

  // 12) LIVE-Anzeige: Text je Zustand ändern, Punkt aus
  await page.getByTestId('liste-live').click();
  await page.getByTestId('opt-textWartet').fill('GLEICH GEHT ES LOS');
  await page.getByText('Punkt zeigen').click();
  await page.waitForTimeout(400);
  const lv = (await layout()).elemente.find((x) => x.id === 'live');
  assert.deepStrictEqual([lv.textWartet, lv.punkt], ['GLEICH GEHT ES LOS', false]);

  // 13) Verlauf über dem Bild: Bild darunterlegen
  await page.mouse.click(box.x + 6, box.y + 6);
  const [wahl2] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Bild darunterlegen' }).click()]);
  await wahl2.setFiles(path.resolve(__dirname, '../../assets/app-icon/icon.png'));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('advancedlan_konfig')).regie.stats.screens[0].layout.hintergrund === 'bild');
  lay = await layout();
  assert.ok(lay.hg.verlaufLage === 'vor' && lay.hg.bild && lay.bilder[lay.hg.bild], 'Bild mit Verlauf darüber');
  assert.ok(lay.hg.verlauf.stopps.some((x) => x.alpha < 100), 'Verlauf scheint durch');
  await page.screenshot({ path: BILDER + '/editor-8-verlauf-bild.png' });
  // Verlauf hinter das Bild legen
  await page.getByTestId('hg-verlauf-lage-hinter').click();
  await page.waitForTimeout(300);
  assert.strictEqual((await layout()).hg.verlaufLage, 'hinter', 'Verlauf hinter dem Bild');
  await page.getByTestId('hg-verlauf-lage-vor').click();
  await page.waitForTimeout(300);
  assert.strictEqual((await layout()).hg.verlaufLage, 'vor');

  // 14) Stats-Screen zeigt das gespeicherte Layout mit dem Text
  const stats = await ctx.newPage();
  await stats.setViewportSize({ width: 1920, height: 1080 });
  await stats.goto(URL + '#stats');
  await stats.waitForTimeout(800);
  const inhalt = await stats.textContent('body');
  assert.ok(inhalt.includes('Finale · LAN-Party'), 'Text mit ersetztem Platzhalter auf dem Stats-Screen');
  assert.ok(await stats.locator('img[src^="data:image/webp"]').count() > 0, 'Bild-Block auf dem Stats-Screen');
  const hg = await stats.evaluate(() => [...document.querySelectorAll('div')].map((d) => d.style.background).find((b) => b.includes('linear-gradient(160deg') && b.includes('url(')));
  assert.ok(hg, 'eigener Verlauf über dem Bild auf dem Stats-Screen');
  assert.ok(inhalt.includes('GLEICH GEHT ES LOS'), 'eigener Text der LIVE-Anzeige');
  assert.ok(await stats.evaluate(() => [...document.querySelectorAll('div')].some((d) => d.style.opacity === '0.6')), 'Deckkraft auf dem Stats-Screen');
  await stats.screenshot({ path: BILDER + '/editor-4-stats.png' });

  assert.deepStrictEqual(fehler, [], 'keine Fehler auf der Seite');
  console.log('Screen-Editor ok');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
