// Sucht den cfg-Ordner von CS2 über die Steam-Bibliotheken (libraryfolders.vdf).
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const CS2_CFG = ['steamapps', 'common', 'Counter-Strike Global Offensive', 'game', 'csgo', 'cfg'];

function steamPfadAusRegistry() {
  if (process.platform !== 'win32') return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { windowsHide: true, timeout: 3000 }, (err, out) => {
      const m = !err && /SteamPath\s+REG_SZ\s+(.+)/i.exec(out || '');
      resolve(m ? m[1].trim().replace(/\//g, '\\') : null);
    });
  });
}

function bibliotheken(steam) {
  const libs = [steam];
  try {
    const vdf = fs.readFileSync(path.join(steam, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) libs.push(m[1].replace(/\\\\/g, '\\'));
  } catch {}
  return libs;
}

async function findeCs2CfgOrdner() {
  const steams = [await steamPfadAusRegistry()];
  if (process.platform === 'win32') steams.push('C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam');
  else steams.push(path.join(os.homedir(), '.steam', 'steam'), path.join(os.homedir(), '.local', 'share', 'Steam'));
  for (const steam of steams.filter(Boolean))
    for (const lib of bibliotheken(steam)) {
      const p = path.join(lib, ...CS2_CFG);
      if (fs.existsSync(p)) return p;
    }
  return null;
}

module.exports = { findeCs2CfgOrdner };
