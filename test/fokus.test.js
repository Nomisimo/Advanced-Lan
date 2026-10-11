const test = require('node:test');
const assert = require('node:assert');
const { restoreFocus, mitFokus } = require('../src/main/fokus');

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
function fenster({ fokus = true, minimiert = false, sichtbar = true, zerstoert = false } = {}) {
  const log = [];
  return {
    log,
    isDestroyed: () => zerstoert, isMinimized: () => minimiert, isVisible: () => sichtbar, isFocused: () => fokus,
    blur: () => log.push('blur'), focus: () => log.push('focus'),
    webContents: { focus: () => log.push('webContents.focus') },
  };
}

test('restoreFocus: blur, focus, webContents.focus nach kurzer Pause', async () => {
  const w = fenster();
  restoreFocus(w, 5);
  assert.deepStrictEqual(w.log, []);
  await warte(20);
  assert.deepStrictEqual(w.log, ['blur', 'focus', 'webContents.focus']);
});

test('restoreFocus: ohne Fokus kein blur', async () => {
  const w = fenster({ fokus: false });
  restoreFocus(w, 1);
  await warte(10);
  assert.deepStrictEqual(w.log, ['focus', 'webContents.focus']);
});

test('restoreFocus: minimiert, versteckt oder zerstört bleibt unberührt', async () => {
  const ws = [fenster({ minimiert: true }), fenster({ sichtbar: false }), fenster({ zerstoert: true })];
  ws.forEach((w) => restoreFocus(w, 1));
  restoreFocus(null, 1);
  await warte(10);
  ws.forEach((w) => assert.deepStrictEqual(w.log, []));
});

test('mitFokus: gibt das Ergebnis zurück und den Fokus auch bei Fehlern', async () => {
  const w = fenster();
  assert.deepStrictEqual(await mitFokus(w, async () => ({ canceled: true })), { canceled: true });
  await warte(80);
  assert.deepStrictEqual(w.log, ['blur', 'focus', 'webContents.focus']);
  const w2 = fenster();
  await assert.rejects(mitFokus(w2, async () => { throw new Error('kaputt'); }), /kaputt/);
  await warte(80);
  assert.deepStrictEqual(w2.log, ['blur', 'focus', 'webContents.focus']);
});
