// Tastatur-Fokus zurück an die Seite. Unter Windows bleibt er nach nativen Dialogen (Speichern, Öffnen, Meldung)
// oder nach dem Schließen eines anderen Fensters manchmal hängen: Textfelder nehmen dann bis zum Neustart
// keine Eingabe mehr an (electron/electron#35872, #41602). Blur + Focus setzt den Fokus im Fenster und im Renderer neu.
const FOKUS_VERZOEGERUNG = 50;

function restoreFocus(win, verzoegerung = FOKUS_VERZOEGERUNG) {
  setTimeout(() => {
    if (!win || win.isDestroyed()) return;
    // Minimiert oder versteckt (z. B. Game-PC im Spiel): nicht nach vorne holen
    if (win.isMinimized() || !win.isVisible()) return;
    if (win.isFocused()) win.blur();
    win.focus();
    win.webContents.focus();
  }, verzoegerung);
}

// Nativen Dialog aufrufen und danach immer den Fokus zurückgeben, auch bei Fehlern
async function mitFokus(win, fn) {
  try { return await fn(); }
  finally { restoreFocus(win); }
}

module.exports = { restoreFocus, mitFokus, FOKUS_VERZOEGERUNG };
