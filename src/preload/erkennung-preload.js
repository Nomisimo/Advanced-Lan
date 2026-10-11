// Unsichtbares Erkennungsfenster (Bilderkennung): Aufträge empfangen, Signaturen und Texte an den Hauptprozess
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('erkennungAPI', {
  onStart: (cb) => ipcRenderer.on('erkennung-start', (_, s) => cb(s)),
  frame: (d) => ipcRenderer.send('erkennung-frame', d),
  text: (id, png) => ipcRenderer.send('erkennung-text', id, png),
  status: (s) => ipcRenderer.send('erkennung-status', s),
});
