const test = require("node:test");
const assert = require("node:assert/strict");
const { STANDARD_HOTKEY, hotkeyAusTaste, gueltigerHotkey, hotkeyText, feedbackUrl, LINKS } = require("../src/core/app-info");
const { migrateKonfig, standardKonfig } = require("../src/core/defaults");
const pkg = require("../package.json");

const taste = (code, mods = {}) => ({ code, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });

test("Tastendruck wird zum Electron-Tastenkürzel", () => {
  assert.equal(hotkeyAusTaste(taste("KeyA", { ctrlKey: true, shiftKey: true }), "win32"), "CommandOrControl+Shift+A");
  assert.equal(hotkeyAusTaste(taste("KeyA", { metaKey: true, shiftKey: true }), "darwin"), "CommandOrControl+Shift+A");
  assert.equal(hotkeyAusTaste(taste("Digit5", { altKey: true }), "win32"), "Alt+5");
  assert.equal(hotkeyAusTaste(taste("F9"), "win32"), "F9", "F-Tasten gehen allein");
  assert.equal(hotkeyAusTaste(taste("KeyA"), "win32"), "", "einzelne Buchstaben würden jede Eingabe im Spiel abfangen");
  assert.equal(hotkeyAusTaste(taste("ShiftLeft", { shiftKey: true }), "win32"), "", "nur Modifier: weiter warten");
});

test("Gültige und ungültige Tastenkürzel", () => {
  assert.ok(gueltigerHotkey(STANDARD_HOTKEY));
  assert.ok(gueltigerHotkey("Alt+F12"));
  assert.ok(gueltigerHotkey("F9"));
  assert.ok(!gueltigerHotkey("A"));
  assert.ok(!gueltigerHotkey("Ctrl+Shift+A"), "Electron-Namen, keine freien Texte");
  assert.ok(!gueltigerHotkey(""));
  assert.ok(!gueltigerHotkey(42));
});

test("Anzeige des Tastenkürzels je System", () => {
  assert.equal(hotkeyText(STANDARD_HOTKEY, "win32"), "Strg+Umschalt+A");
  assert.equal(hotkeyText(STANDARD_HOTKEY, "darwin"), "⌘⇧A");
  assert.equal(hotkeyText("", "win32"), "–");
});

test("Einstellungen: Einführung, Zustimmung und Tastenkürzel", () => {
  const neu = standardKonfig();
  assert.deepEqual(neu.app, { einfuehrung: false, bedingungen: "", hotkey: STANDARD_HOTKEY });
  // Ältere Einstellungen ohne „app“: Einführung erscheint einmal
  const alt = migrateKonfig({ version: 5, modus: "regie" });
  assert.equal(alt.app.einfuehrung, false);
  assert.equal(alt.app.hotkey, STANDARD_HOTKEY);
  const k = migrateKonfig({ version: 5, app: { einfuehrung: true, bedingungen: "2026-10-04T10:00:00.000Z", hotkey: "Alt+F12" } });
  assert.deepEqual(k.app, { einfuehrung: true, bedingungen: "2026-10-04T10:00:00.000Z", hotkey: "Alt+F12" });
  assert.equal(migrateKonfig({ version: 5, app: { hotkey: "" } }).app.hotkey, "", "bewusst ausgeschaltet bleibt aus");
  assert.equal(migrateKonfig({ version: 5, app: { hotkey: "Unsinn" } }).app.hotkey, STANDARD_HOTKEY);
});

test("Feedback-Link enthält Version, System und Modus", () => {
  const url = feedbackUrl({ version: "0.1.0", system: "Windows_NT 10.0", modus: "gamepc" });
  assert.ok(url.startsWith(`${LINKS.issues}/new?body=`));
  const body = decodeURIComponent(url.split("body=")[1]);
  assert.match(body, /Version: 0\.1\.0/);
  assert.match(body, /System: Windows_NT 10\.0/);
  assert.match(body, /Modus: gamepc/);
});

test("Overwolf-Release: Lizenz, Zustimmung im Installer, Links zu Terms und Privacy", () => {
  const fs = require("node:fs");
  assert.equal(pkg.license, "MIT");
  assert.ok(fs.existsSync("LICENSE"));
  assert.equal(pkg.build.nsis.oneClick, false, "nur der geführte Installer zeigt die Zustimmung");
  assert.ok(fs.existsSync(pkg.build.nsis.license));
  const terms = fs.readFileSync(pkg.build.nsis.license, "utf8");
  assert.ok(terms.includes(LINKS.terms) && terms.includes(LINKS.privacy));
  assert.ok(fs.existsSync("docs/TERMS.md") && fs.existsSync("docs/PRIVACY.md"));
  assert.ok(LINKS.terms.endsWith("docs/TERMS.md") && LINKS.privacy.endsWith("docs/PRIVACY.md"));
});
