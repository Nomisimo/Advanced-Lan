"use strict";
// Ordnet ein Spielereignis den Cue-Regeln zu und baut daraus OSC-Nachrichten.

const PLATZHALTER = ["event", "spiel", "team", "player", "pc", "round", "map", "kills", "score_ct", "score_t"];

const fuellen = (text, ev) =>
  String(text ?? "").replace(/\{(\w+)\}/g, (m, k) => (k === "event" ? ev.type : PLATZHALTER.includes(k) ? String(ev[k] ?? "") : m));

function argumente(regel, ev) {
  if (!regel.argTyp) return [];
  const v = fuellen(regel.argWert, ev);
  if (regel.argTyp === "s") return [{ type: "s", value: v }];
  return [{ type: regel.argTyp, value: Number(v) || 0 }];
}

// Eine Regel ohne Rücksicht auf Filter und Cooldown in eine Nachricht übersetzen (für „Test“).
function nachricht(cfg, regel, ev) {
  const ziel = cfg.targets.find((t) => t.id === regel.target);
  if (!ziel) return { regel: regel.id, fehler: "Ziel fehlt" };
  return { regel: regel.id, ziel, address: fuellen(regel.address, ev), args: argumente(regel, ev) };
}

class Router {
  constructor() { this.zuletzt = new Map(); }
  route(cfg, ev, now) {
    const out = [];
    for (const r of cfg.rules || []) {
      if (!r.aktiv || r.event !== ev.type || (r.spiel || "cs2") !== (ev.spiel || "cs2")) continue;
      if (r.team && r.team !== ev.team) continue;
      if (r.pc && r.pc !== ev.pcId) continue;
      const cd = Number(r.cooldown) || 0;
      if (cd > 0 && now - (this.zuletzt.get(r.id) ?? -Infinity) < cd) { out.push({ regel: r.id, uebersprungen: "Cooldown" }); continue; }
      this.zuletzt.set(r.id, now);
      out.push(nachricht(cfg, r, ev));
    }
    return out;
  }
}

module.exports = { Router, nachricht, fuellen, PLATZHALTER };
