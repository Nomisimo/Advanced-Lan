// Game-PC: Automation Overdrive mit einem Klick öffnen. Sucht die installierte Overwolf-App unter
// %LOCALAPPDATA%\Overwolf\Extensions\<App-ID>\<Version>\manifest.json und startet sie über den Overwolf-Launcher
// (wie die Desktop-Verknüpfung: OverwolfLauncher.exe -launchapp <App-ID>). Fehlt etwas, öffnet sich die Download-Seite.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { overdriveAusManifest, OVERDRIVE_STORE_URL, OVERWOLF_URL } = require('../core/overdrive');

function overwolfLauncher(env = process.env) {
  const ordner = [env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', env.ProgramFiles || 'C:\\Program Files'];
  for (const o of ordner) {
    const exe = path.join(o, 'Overwolf', 'OverwolfLauncher.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

const ordnerIn = (dir) => { try { return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; } };

// → { uid, name, version } oder null. Ordner als Parameter für die Tests.
function findeOverdrive(extensions = path.join(process.env.LOCALAPPDATA || '', 'Overwolf', 'Extensions')) {
  for (const uid of ordnerIn(extensions)) {
    for (const ver of ordnerIn(path.join(extensions, uid)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))) {
      let text;
      try { text = fs.readFileSync(path.join(extensions, uid, ver, 'manifest.json'), 'utf8'); } catch { continue; }
      const app = overdriveAusManifest(text);
      if (app) return { uid, ...app, version: app.version || ver };
    }
  }
  return null;
}

// Stand für den Setup-Check (nur Windows)
function overdriveInstalliert() {
  if (process.platform !== 'win32') return null;
  return { overwolf: !!overwolfLauncher(), app: findeOverdrive() };
}

// Knopf „Automation Overdrive öffnen“ → { art, text }
async function overdriveOeffnen(shell) {
  if (process.platform !== 'win32') {
    await shell.openExternal(OVERDRIVE_STORE_URL);
    return { art: 'store', text: 'Overwolf und Automation Overdrive gibt es nur für Windows. Die Store-Seite ist im Browser offen.' };
  }
  const launcher = overwolfLauncher();
  if (!launcher) {
    await shell.openExternal(OVERWOLF_URL);
    return { art: 'overwolf', text: 'Overwolf ist nicht installiert. Die Download-Seite ist im Browser offen, danach Automation Overdrive aus dem Store holen.' };
  }
  const app = findeOverdrive();
  if (!app) {
    await shell.openExternal(OVERDRIVE_STORE_URL);
    return { art: 'store', text: 'Automation Overdrive ist nicht installiert. Die Seite im Overwolf-Store ist im Browser offen.' };
  }
  try {
    const p = spawn(launcher, ['-launchapp', app.uid], { detached: true, stdio: 'ignore' });
    p.on('error', () => {});
    p.unref();
  } catch (e) {
    return { art: 'fehler', text: `Overwolf ließ sich nicht starten: ${e.message}` };
  }
  return { art: 'gestartet', text: `Automation Overdrive ${app.version} wird über Overwolf gestartet. Im Fenster muss „Connected to TP“ stehen.` };
}

module.exports = { overwolfLauncher, findeOverdrive, overdriveInstalliert, overdriveOeffnen };
