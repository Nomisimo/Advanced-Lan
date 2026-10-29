"use strict";
// Läuft ein Spiel im exklusiven Vollbild? Unter Windows meldet SHQueryUserNotificationState (shell32), was gerade
// im Vordergrund läuft. Im exklusiven Vollbild (Direct3D) schreibt das Spiel direkt auf den Monitor, Windows zeichnet
// dann keine anderen Fenster darüber: Mini-Overlay und Namens-Popup sind unsichtbar, egal wie weit oben sie stehen.
// Im randlosen Fenster oder „Vollbild (Fenster)“ setzt Windows sie wie jedes andere Fenster obendrauf.
//
// Werte von QUERY_USER_NOTIFICATION_STATE:
//   1 NOT_PRESENT (Sperrbildschirm, Bildschirmschoner)   2 BUSY (Vollbild-App, z. B. randloses Spiel oder Video)
//   3 RUNNING_D3D_FULL_SCREEN (exklusives Vollbild)      4 PRESENTATION_MODE   5 ACCEPTS_NOTIFICATIONS (normal)
//   6 QUIET_TIME   7 APP (Store-App im Vollbild)

const QUNS_D3D = 3;
const PRUEF_MS = 1500;

// → "exklusiv" (Overlay unsichtbar), "vollbild" (Vollbild-Fenster, Overlay sichtbar) oder "" (normal oder unbekannt)
function vollbildArt(code) {
  const n = Number(code);
  if (n === QUNS_D3D) return "exklusiv";
  if (n === 2 || n === 4 || n === 7) return "vollbild";
  return "";
}

// PowerShell-Skript: fragt alle PRUEF_MS den Zustand ab und schreibt ihn als Zahl in eine Zeile.
// Beendet sich selbst, wenn die App (elternPid) nicht mehr läuft, damit nach einem Absturz nichts übrig bleibt.
function vollbildSkript(elternPid, ms = PRUEF_MS) {
  const pid = Math.max(0, Math.floor(Number(elternPid) || 0));
  return [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class AlQuns { [DllImport(\"shell32.dll\")] public static extern int SHQueryUserNotificationState(out int s); }'",
    "while ($true) {",
    `  if (${pid} -and -not (Get-Process -Id ${pid} -ErrorAction SilentlyContinue)) { exit 0 }`,
    "  $s = 0",
    "  if ([AlQuns]::SHQueryUserNotificationState([ref]$s) -ne 0) { $s = 0 }",
    "  [Console]::Out.WriteLine($s); [Console]::Out.Flush()",
    `  Start-Sleep -Milliseconds ${Math.max(200, Math.floor(ms))}`,
    "}",
  ].join("\n");
}

// Spieleinstellung, in der Overlay, Popup und Bilderkennung funktionieren
const RANDLOS_HINWEIS = {
  valorant: "Valorant: Einstellungen → Video → Allgemein → Anzeigemodus „Vollbild im Fenster“ (Windowed Fullscreen)",
  cs2: "CS2: Einstellungen → Video → Anzeigemodus „Vollbild (Fenster)“ (Fullscreen Windowed)",
  rl: "Rocket League: Einstellungen → Video → Anzeigemodus „Randlos“ (Borderless)",
};

module.exports = { vollbildArt, vollbildSkript, RANDLOS_HINWEIS, PRUEF_MS };
