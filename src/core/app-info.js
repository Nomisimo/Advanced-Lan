"use strict";
// Allgemeines zur App: Links (Nutzungsbedingungen, Datenschutz, Feedback) und das Tastenkürzel zum Ein- und Ausblenden.

const REPO_URL = "https://github.com/Nomisimo/Advanced-Lan";
const LINKS = {
  terms: `${REPO_URL}/blob/main/docs/TERMS.md`,
  privacy: `${REPO_URL}/blob/main/docs/PRIVACY.md`,
  issues: `${REPO_URL}/issues`,
};

// Overwolf verlangt ein Tastenkürzel, das die App ein- und ausblendet, und eine Erinnerung daran in den Einstellungen
const STANDARD_HOTKEY = "CommandOrControl+Shift+A";

const MODIFIER = ["CommandOrControl", "Control", "Command", "Alt", "Shift"];
// Taste ohne Modifier aus KeyboardEvent.code; nur Tasten, die Electrons globalShortcut kennt
function tasteAusCode(code) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  if (/^Numpad[0-9]$/.test(code)) return "num" + code.slice(6);
  const weitere = { Space: "Space", Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown", Insert: "Insert", Delete: "Delete", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right" };
  return weitere[code] || "";
}

// Tastendruck → Electron-Accelerator („CommandOrControl+Shift+A“). Leer, solange nur Modifier gedrückt sind
// oder kein Modifier dabei ist (ein einzelnes „A“ würde im Spiel jede Eingabe abfangen). F-Tasten gehen allein.
function hotkeyAusTaste(e, plattform) {
  const taste = tasteAusCode(e.code || "");
  if (!taste) return "";
  const mac = plattform === "darwin";
  const teile = [];
  if (mac ? e.metaKey : e.ctrlKey) teile.push("CommandOrControl");
  if (mac && e.ctrlKey) teile.push("Control");
  if (e.altKey) teile.push("Alt");
  if (e.shiftKey) teile.push("Shift");
  if (!teile.length && !/^F\d+$/.test(taste)) return "";
  return [...teile, taste].join("+");
}

function gueltigerHotkey(h) {
  if (typeof h !== "string" || !h) return false;
  const teile = h.split("+");
  const taste = teile.pop();
  if (!teile.every((t) => MODIFIER.includes(t))) return false;
  if (!/^([A-Z0-9]|F([1-9]|1[0-9]|2[0-4])|num[0-9]|Space|Home|End|PageUp|PageDown|Insert|Delete|Up|Down|Left|Right)$/.test(taste)) return false;
  return teile.length > 0 || /^F\d+$/.test(taste);
}

// Anzeige: „Strg+Umschalt+A“ unter Windows, „⌘⇧A“ auf dem Mac
function hotkeyText(h, plattform) {
  if (!h) return "–";
  const mac = plattform === "darwin";
  const namen = mac
    ? { CommandOrControl: "⌘", Command: "⌘", Control: "⌃", Alt: "⌥", Shift: "⇧" }
    : { CommandOrControl: "Strg", Command: "Strg", Control: "Strg", Alt: "Alt", Shift: "Umschalt" };
  const teile = h.split("+").map((t) => namen[t] || t.replace(/^num/, "Num "));
  return teile.join(mac ? "" : "+");
}

// Neues GitHub-Issue mit Version, System und Modus schon ausgefüllt
function feedbackUrl({ version, plattform, system, modus }) {
  const body = [
    "**Was ist passiert?**", "", "", "**Was hast du erwartet?**", "", "",
    "---", `Version: ${version || "?"}`, `System: ${system || plattform || "?"}`, `Modus: ${modus || "–"}`,
  ].join("\n");
  return `${LINKS.issues}/new?body=${encodeURIComponent(body)}`;
}

module.exports = { REPO_URL, LINKS, STANDARD_HOTKEY, hotkeyAusTaste, gueltigerHotkey, hotkeyText, feedbackUrl };
