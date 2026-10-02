"use strict";
// OSC 1.0 kodieren (nur Nachrichten, keine Bundles). Nutzt Buffer, läuft deshalb nur in Node/Electron-Main.

const pad4 = (n) => (n + 3) & ~3;

function ostr(s) {
  const b = Buffer.from(String(s), "utf8");
  const out = Buffer.alloc(pad4(b.length + 1));
  b.copy(out);
  return out;
}

// args: [{ type: "s" | "i" | "f" | "T" | "F", value }]
function encodeMessage(address, args = []) {
  if (!address || address[0] !== "/") throw new Error(`OSC-Adresse muss mit / beginnen: „${address}“`);
  const teile = [ostr(address), ostr("," + args.map((a) => a.type).join(""))];
  for (const a of args) {
    if (a.type === "s") teile.push(ostr(a.value ?? ""));
    else if (a.type === "i") { const b = Buffer.alloc(4); b.writeInt32BE(Math.trunc(Number(a.value) || 0)); teile.push(b); }
    else if (a.type === "f") { const b = Buffer.alloc(4); b.writeFloatBE(Number(a.value) || 0); teile.push(b); }
    else if (a.type !== "T" && a.type !== "F") throw new Error(`Unbekannter OSC-Typ ${a.type}`);
  }
  return Buffer.concat(teile);
}

module.exports = { encodeMessage };
