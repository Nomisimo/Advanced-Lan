// Mini-Overlay des Game-PCs: Status empfangen, verschieben, App öffnen
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  onStatus: (cb) => ipcRenderer.on('overlay-status', (_, s) => cb(s)),
  ziehen: (dx, dy) => ipcRenderer.send('overlay-ziehen', dx, dy),
  abgelegt: () => ipcRenderer.send('overlay-abgelegt'),
  oeffnen: () => ipcRenderer.send('overlay-oeffnen'),
});
