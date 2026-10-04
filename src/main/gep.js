// Overwolf Game Events (GEP) im Hauptprozess von ow-electron.
// package.json → "overwolf": { "packages": ["gep"] } lässt ow-electron das Paket laden; danach meldet es erkannte Spiele
// und deren Events. Overwolf liefert GEP nur an freigegebene (whitelisted) Apps und in verteilten Builds nur mit
// Code-Signatur. Zum Entwickeln: Spiele, die noch nicht in PROD sind, mit
//   --owepm-package-channel (ersetzt --owepm-packages-url, siehe Overwolf-Changelog „Package Channels“)
// Doku: https://dev.overwolf.com/ow-electron/live-game-data-gep/live-game-data-gep-intro/
const { GEP_BY_OWID } = require('../core/gep-spiele');

class GepAnbindung {
  // onNachricht(spielId, { gep, art, feature, key, value }), onChange()
  constructor({ app, onNachricht, onChange }) {
    this.app = app;
    this.onNachricht = onNachricht;
    this.onChange = onChange || (() => {});
    this.gep = null;
    this.version = '';
    this.fehler = '';
    this.laedt = false;
    this.spiel = null; // { id, name, owId } das gerade laufende Spiel
    this.admin = false; // Spiel läuft als Administrator: App muss es auch
  }

  start() {
    const pk = this.app.overwolf?.packages;
    if (!pk) { this.fehler = 'Overwolf-Pakete fehlen (App läuft nicht in ow-electron)'; return; }
    pk.on('loading', (_e, name) => { if (name === 'gep') { this.laedt = true; this.onChange(); } });
    pk.on('ready', (_e, name, version) => { if (name === 'gep') this.bereit(pk.gep, version); });
    pk.on('failed-to-initialize', (_e, name) => { if (name === 'gep') { this.laedt = false; this.fehler = 'GEP konnte nicht geladen werden (Overwolf-Freigabe oder Signatur fehlt?)'; this.onChange(); } });
    pk.on('crashed', () => { this.fehler = 'Overwolf-Pakete abgestürzt, starten neu'; this.onChange(); });
    if (pk.gep) this.bereit(pk.gep, '');
  }

  bereit(gep, version) {
    if (!gep) return;
    this.gep = gep;
    this.version = version || this.version;
    this.laedt = false;
    this.fehler = '';
    gep.removeAllListeners();
    gep.on('game-detected', async (event, gameId, name) => {
      const def = GEP_BY_OWID[gameId];
      if (!def) return; // Dota 2 läuft über Valve GSI, andere Spiele nutzt die App nicht
      event.enable();
      this.spiel = { id: def.id, name: def.name, owId: gameId };
      this.admin = false;
      this.onChange();
      // null = alle Features, wie im Beispiel von Overwolf
      try { await gep.setRequiredFeatures(gameId, null); }
      catch (e) { this.fehler = `${def.name}: Features nicht gesetzt (${e?.message || e})`; this.onChange(); }
    });
    gep.on('game-exit', (_e, gameId) => { if (this.spiel?.owId === gameId) { this.spiel = null; this.onChange(); } });
    gep.on('elevated-privileges-required', (_e, gameId) => { if (GEP_BY_OWID[gameId]) { this.admin = true; this.onChange(); } });
    gep.on('error', (_e, gameId, fehler) => { if (GEP_BY_OWID[gameId]) { this.fehler = `${GEP_BY_OWID[gameId].name}: ${fehler}`; this.onChange(); } });
    const weiter = (art) => (_e, gameId, d) => {
      const def = GEP_BY_OWID[gameId];
      if (def && d) this.onNachricht(def.id, { gep: true, art, feature: d.feature, category: d.category, key: d.key, value: d.value });
    };
    gep.on('new-game-event', weiter('event'));
    gep.on('new-info-update', weiter('info'));
    this.onChange();
  }

  status() {
    return { geladen: !!this.gep, laedt: this.laedt, version: this.version, fehler: this.fehler, spiel: this.spiel, admin: this.admin };
  }
}

module.exports = { GepAnbindung };
