// Namens-Popup des Game-PCs: Daten empfangen, Name übernehmen oder wegklicken
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nameAPI', {
  onDaten: (cb) => ipcRenderer.on('name-daten', (_, d) => cb(d)),
  antwort: (name) => ipcRenderer.send('name-antwort', String(name || '')),
  schliessen: () => ipcRenderer.send('name-schliessen'),
});
