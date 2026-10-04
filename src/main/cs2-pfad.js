// Sucht den cfg-Ordner von CS2 über die Steam-Bibliotheken (libraryfolders.vdf).
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const CS2_CFG = ['steamapps', 'common', 'Counter-Strike Global Offensive', 'game', 'csgo', 'cfg'];
const DOTA_CFG = ['steamapps', 'common', 'dota 2 beta', 'game', 'dota', 'cfg'];

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

async function steamOrdner() {
  const steams = [await steamPfadAusRegistry()];
  if (process.platform === 'win32') steams.push('C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam');
  else if (process.platform === 'darwin') steams.push(path.join(os.homedir(), 'Library', 'Application Support', 'Steam'));
  else steams.push(path.join(os.homedir(), '.steam', 'steam'), path.join(os.homedir(), '.local', 'share', 'Steam'));
  return steams.filter(Boolean);
}

async function findeInSteam(teile) {
  for (const steam of await steamOrdner())
    for (const lib of bibliotheken(steam)) {
      const p = path.join(lib, ...teile);
      if (fs.existsSync(p)) return p;
    }
  return null;
}

const findeCs2CfgOrdner = () => findeInSteam(CS2_CFG);

// Dota 2: <Dota>\game\dota\cfg\gamestate_integration (den letzten Ordner legt die App bei Bedarf an)
async function findeDotaCfgOrdner() {
  const cfg = await findeInSteam(DOTA_CFG);
  return cfg ? path.join(cfg, 'gamestate_integration') : null;
}

// Inhalte aller localconfig.vdf (eine je Steam-Konto): dort stehen die Startoptionen der Spiele
async function steamLocalConfigs() {
  const out = [];
  for (const steam of await steamOrdner()) {
    let konten = [];
    try { konten = fs.readdirSync(path.join(steam, 'userdata')); } catch { continue; }
    for (const k of konten) { try { out.push(fs.readFileSync(path.join(steam, 'userdata', k, 'config', 'localconfig.vdf'), 'utf8')); } catch {} }
    if (out.length) break;
  }
  return out;
}

// Rocket League: Epic Games (Manifeste des Launchers) oder Steam. Gibt <RL>\TAGame\Config zurück.
async function findeRlConfigOrdner() {
  const kandidaten = [];
  if (process.platform === 'win32') {
    const manifeste = 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests';
    try {
      for (const f of fs.readdirSync(manifeste).filter((x) => x.endsWith('.item'))) {
        try { const m = JSON.parse(fs.readFileSync(path.join(manifeste, f), 'utf8')); if (/rocket league/i.test(m.DisplayName || '')) kandidaten.push(m.InstallLocation); } catch {}
      }
    } catch {}
    kandidaten.push('C:\\Program Files\\Epic Games\\rocketleague');
  }
  for (const steam of await steamOrdner()) for (const lib of bibliotheken(steam)) kandidaten.push(path.join(lib, 'steamapps', 'common', 'rocketleague'));
  for (const k of kandidaten.filter(Boolean)) {
    const p = path.join(k, 'TAGame', 'Config');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

module.exports = { findeCs2CfgOrdner, findeRlConfigOrdner, findeDotaCfgOrdner, steamLocalConfigs };
