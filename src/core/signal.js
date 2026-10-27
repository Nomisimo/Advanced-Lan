"use strict";
// Macht aus einem Ereignis die Befehle, die im Tab „Signale“ eingestellt sind.
// Jede Zuweisung sagt: dieses Event (optional nur von PC X oder Team Y) → an Ziel Z → Befehl B mit Werten.
//
//   cfg.signale = { [spiel]: { [event]: [ { id, ziel, befehl, werte: { cue: "3" }, pc: "", team: "" } ] } }
//
// Werte dürfen Platzhalter aus dem Ereignis enthalten: {spieler} {team} {pc} {runde} {spiel} {event},
// aus dem Plan {nr} {nr2} {plan} (core/plan.js) und Rechnungen wie {100+nr} (core/platzhalter.js).
// Allgemeine Befehle (cfg.signale.allgemein, core/aktionen.js) gelten zusätzlich für jedes passende Spiel-Event.

const { zielTyp, befehlVon } = require("./ziel-typen");
const { einsetzen, nutzt, zaehlen } = require("./platzhalter");
const { planVars, PLAN_VARS } = require("./plan");
const { geerbt } = require("./aktionen");

const EVENT_VARS = (ev) => ({
  spieler: ev.player || "",
  team: ev.team || "",
  pc: ev.pcId || ev.pc || "",
  runde: ev.round ?? "",
  spiel: ev.spiel || "",
  event: ev.type || "",
});


const zahl = (v, typ) => {
  const n = typ === "i" ? parseInt(String(v).trim(), 10) : parseFloat(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// Freie Argumente: "i:1 f:0.5 s:Hallo \"zwei Worte\" 7 0.25"
// Ohne Typ wird geraten: ganze Zahl → i, Kommazahl → f, sonst s
function parseArgs(text) {
  const out = [];
  const re = /(?:([ifsTF]):)?(?:"([^"]*)"|(\S+))/g;
  let m;
  while ((m = re.exec(String(text || "")))) {
    const typ = m[1], wert = m[2] ?? m[3] ?? "";
    if (typ === "T" || typ === "F") { out.push({ type: typ, value: typ === "T" }); continue; }
    if (wert === "T" && !typ && m[2] == null) { out.push({ type: "T", value: true }); continue; }
    if (wert === "F" && !typ && m[2] == null) { out.push({ type: "F", value: false }); continue; }
    const t = typ || (m[2] != null ? "s" : /^-?\d+$/.test(wert) ? "i" : /^-?\d*[.,]\d+$/.test(wert) ? "f" : "s");
    out.push({ type: t, value: t === "s" ? wert : zahl(wert, t) });
  }
  return out;
}

const normAdresse = (a) => "/" + String(a || "").split("/").filter(Boolean).join("/");

// Eine Zuweisung → OSC-Nachrichten. Reihenfolge der Platzhalter: Befehlswerte, Ziel-Optionen, Ereignis.
// plan: cfg.plan der Regie für {nr} {nr2} {plan}. Ohne Plan bleiben sie leer.
function baueNachrichten(ziel, zuweisung, ev = {}, plan = null) {
  const befehl = befehlVon(ziel.typ, zuweisung.befehl);
  if (!befehl) throw new Error(`Befehl „${zuweisung.befehl}“ gibt es bei ${zielTyp(ziel.typ).name} nicht`);
  return baue(ziel, befehl, zuweisung.werte, ev, plan);
}

// Nutzt der Befehl mit diesen Werten einen Platzhalter aus dem Plan?
function nutztPlan(befehl, eingaben = {}) {
  const texte = [...(befehl.params || []).map((p) => eingaben?.[p.key] ?? p.standard ?? ""), ...(befehl.osc || []).flatMap((n) => [n.address, n.argsFrei, ...(n.args || []).map((a) => a.value)])];
  return texte.some((t) => nutzt(t, PLAN_VARS));
}

function baue(ziel, befehl, eingaben = {}, ev = {}, plan = null) {
  const typ = zielTyp(ziel.typ);
  const pv = planVars(plan, ev.pcId || ev.pc, ziel.id);
  if (!pv && nutztPlan(befehl, eingaben)) throw new Error(`${ev.pcId || ev.pc || "Dieser PC"} steht nicht im Plan ({nr}, {plan})`);
  const evVars = { ...EVENT_VARS(ev), ...(pv || {}) };
  const optionen = {};
  for (const o of typ.optionen || []) optionen[o.key] = ziel.optionen?.[o.key] ?? o.standard ?? "";
  const werte = {};
  for (const p of befehl.params || []) werte[p.key] = einsetzen(zaehlen(eingaben?.[p.key] ?? p.standard ?? ""), evVars);
  const vars = { ...evVars, ...optionen, ...werte };
  const vorab = (typ.vorab || []).filter((n) => String(optionen[n.nurWenn] ?? "").trim());
  return [...vorab, ...befehl.osc].map((n) => {
    const address = normAdresse(einsetzen(n.address, vars));
    const args = n.argsFrei
      ? parseArgs(einsetzen(n.argsFrei, vars))
      : (n.args || []).map((a) => {
        if (a.type === "T" || a.type === "F") return { type: a.type, value: a.type === "T" };
        const v = einsetzen(a.value, vars);
        return { type: a.type, value: a.type === "s" ? v : zahl(v, a.type) };
      });
    return { address, args };
  });
}

// Test-Knopf im Tab „Ziele“: harmlose Nachricht, die das Ziel kennt (z. B. /thump bei QLab)
function testNachricht(ziel) {
  const t = zielTyp(ziel.typ).test || { address: "/advancedlan/test", args: [{ type: "s", value: "Advanced LAN" }] };
  return baue(ziel, { osc: [t] })[0];
}

// Alle Zuweisungen eines Events: allgemeine (wenn nicht ersetzt), dann die des Spiels
function zuweisungen(cfg, spiel, type) {
  const l = cfg.signale?.[spiel]?.[type];
  return [...geerbt(cfg, spiel, type), ...(Array.isArray(l) ? l : [])];
}

const passt = (z, ev) => (!z.pc || z.pc === (ev.pcId || ev.pc)) && (!z.team || z.team === ev.team) && z.aus !== true;

// Ereignis → [{ zuweisung, ziel, nachrichten, fehler }]
function befehleFuer(cfg, ev) {
  const out = [];
  for (const z of zuweisungen(cfg, ev.spiel, ev.type)) {
    if (!passt(z, ev)) continue;
    const ziel = (cfg.targets || []).find((t) => t.id === z.ziel);
    if (!ziel) { out.push({ zuweisung: z, ziel: null, nachrichten: [], fehler: "Ziel fehlt" }); continue; }
    try { out.push({ zuweisung: z, ziel, nachrichten: baueNachrichten(ziel, z, ev, cfg.plan), fehler: "" }); }
    catch (e) { out.push({ zuweisung: z, ziel, nachrichten: [], fehler: e.message }); }
  }
  return out;
}

// Kurzform für Log und Vorschau: /gma3/cmd "Go+ Sequence 101 Cue 3"
const zeigeArg = (a) => (a.type === "s" ? JSON.stringify(a.value) : a.type === "T" || a.type === "F" ? a.type : String(a.value));
const zeigeNachricht = (n) => [n.address, ...n.args.map(zeigeArg)].join(" ");

const slug = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "") || "x";

module.exports = { baueNachrichten, nutztPlan, testNachricht, befehleFuer, zuweisungen, passt, parseArgs, einsetzen, zeigeNachricht, EVENT_VARS, slug };
