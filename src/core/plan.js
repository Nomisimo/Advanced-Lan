"use strict";
// Plan (Regie, Tab „Plan“): die Plätze der Game-PCs, auch solange noch kein Rechner verbunden ist (virtuelle PCs).
//
//   cfg.regie.plan = {
//     pcs: [{ id, pcId, rechner, werte: { [zielId]: "" } }],  Reihenfolge = Platznummer {nr} (1, 2, 3 …)
//     regeln: { [zielId]: "{100+nr}" },                       je Ziel eine Spalte: Regel für alle Plätze, eine Zelle überschreibt sie
//     auto: false,                                            unbekannte Game-PCs bekommen den nächsten freien Platz
//     vorlage: null | { name, daten, stand },                 Game-PC-Einstellungen, die die Regie an alle Plätze verteilt
//     vorlageAuto: true,                                      Vorlage beim Verbinden schicken
//   }
//
// rechner: Hostname oder MAC. Meldet sich ein Game-PC von diesem Rechner, bekommt er die PC-ID des Platzes, egal was er eingetragen hat.
// In den Signalen: {nr} Platznummer, {nr2} mit führender Null, {plan} Wert der Spalte des Ziels für den auslösenden PC.
// Simulierte PCs („SIM 03“) spielen Platz 3, damit sich der Plan ohne echte PCs testen lässt.

const { einsetzen, zaehlen } = require("./platzhalter");

const uid = () => Math.random().toString(36).slice(2, 10);
const STANDARD_REGEL = "{nr}";
const PLAN_VARS = ["nr", "nr2", "plan"];
const MAX_PLAETZE = 64;

const standardPlan = () => ({ pcs: [], regeln: {}, auto: false, vorlage: null, vorlageAuto: true });
const text = (x, n = 80) => (typeof x === "string" || typeof x === "number" ? String(x).trim().slice(0, n) : "");

function migrateVorlage(v) {
  if (!v || typeof v !== "object" || !v.daten || typeof v.daten !== "object") return null;
  return { name: text(v.name, 60), daten: v.daten, stand: text(v.stand, 40) };
}

function migratePlan(p) {
  const d = standardPlan();
  if (!p || typeof p !== "object") return d;
  const werte = (w) => Object.fromEntries(Object.entries(w && typeof w === "object" ? w : {}).map(([k, v]) => [k, text(v, 200)]).filter(([, v]) => v !== ""));
  return {
    pcs: (Array.isArray(p.pcs) ? p.pcs : []).filter((x) => x && typeof x === "object").slice(0, MAX_PLAETZE)
      .map((x) => ({ id: text(x.id, 20) || uid(), pcId: text(x.pcId, 40), rechner: text(x.rechner, 253), werte: werte(x.werte) })),
    regeln: Object.fromEntries(Object.entries(p.regeln && typeof p.regeln === "object" ? p.regeln : {}).map(([k, v]) => [k, text(v, 200)])),
    auto: !!p.auto,
    vorlage: migrateVorlage(p.vorlage),
    vorlageAuto: p.vorlageAuto !== false,
  };
}

const istLeer = (p) => !p || (!p.pcs?.length && !p.vorlage && !Object.values(p.regeln || {}).some(Boolean) && !p.auto);

const pcIdFuer = (nr) => `PC ${String(nr).padStart(2, "0")}`;

// Plätze bis zur Anzahl auffüllen (vorhandene bleiben), zu viele fallen hinten weg
function plaetzeAnlegen(plan, anzahl) {
  const n = Math.max(0, Math.min(MAX_PLAETZE, Math.round(Number(anzahl) || 0)));
  const pcs = plan.pcs.slice(0, n);
  const vergeben = new Set(pcs.map((p) => p.pcId));
  for (let i = pcs.length; i < n; i++) {
    let id = pcIdFuer(i + 1);
    for (let k = i + 2; vergeben.has(id); k++) id = pcIdFuer(k);
    vergeben.add(id);
    pcs.push({ id: uid(), pcId: id, rechner: "", werte: {} });
  }
  return { ...plan, pcs };
}

const simNr = (pcId) => { const m = /^SIM (\d+)$/.exec(String(pcId || "")); return m ? Number(m[1]) : 0; };

// Platz eines PCs: { nr, platz } oder null
function platzVon(plan, pcId) {
  const pcs = plan?.pcs || [];
  const id = String(pcId || "").trim();
  if (!id) return null;
  let i = pcs.findIndex((p) => p.pcId === id);
  if (i < 0) i = pcs.findIndex((p) => p.pcId.toLowerCase() === id.toLowerCase());
  if (i < 0 && simNr(id) && simNr(id) <= pcs.length) i = simNr(id) - 1;
  return i < 0 ? null : { nr: i + 1, platz: pcs[i] };
}

const nrVars = (nr) => ({ nr: String(nr), nr2: String(nr).padStart(2, "0") });

// Wert der Ziel-Spalte für Platz nr: eigene Zelle, sonst die Regel der Spalte
function planWert(plan, nr, zielId) {
  const platz = plan?.pcs?.[nr - 1];
  if (!platz) return "";
  const eigen = platz.werte?.[zielId];
  const regel = eigen != null && eigen !== "" ? eigen : plan.regeln?.[zielId] || STANDARD_REGEL;
  return einsetzen(zaehlen(regel), { ...nrVars(nr), pc: platz.pcId });
}

// Platzhalter eines Ereignisses für ein Ziel: {nr} {nr2} {plan}. Leer, wenn der PC nicht im Plan steht.
function planVars(plan, pcId, zielId) {
  const p = platzVon(plan, pcId);
  return p ? { ...nrVars(p.nr), plan: planWert(plan, p.nr, zielId) } : null;
}

const normMac = (x) => String(x || "").toLowerCase().replace(/[^0-9a-f]/g, "");
// Passt der eingetragene Rechner (Hostname oder MAC) zu diesem Game-PC?
function rechnerPasst(rechner, geraet = {}) {
  const r = String(rechner || "").trim().toLowerCase();
  if (!r) return false;
  if (r === String(geraet.hostname || "").trim().toLowerCase()) return true;
  return normMac(r).length === 12 && normMac(r) === normMac(geraet.mac);
}

// Welche PC-ID bekommt ein Game-PC, der sich anmeldet? belegt: PC-IDs, die gerade verbunden sind.
// Reihenfolge: eingetragener Rechner, gleiche PC-ID, nächster freier Platz (nur mit plan.auto), sonst die eigene PC-ID.
// merken: Rechner, der beim Platz eingetragen werden soll (beim nächsten Mal sofort erkannt).
function zuordnen(plan, { pcId = "", geraet = {} } = {}, belegt = new Set()) {
  const pcs = plan?.pcs || [];
  const eigen = String(pcId || "").trim();
  const name = String(geraet.hostname || "").trim() || String(geraet.mac || "").trim();
  const perRechner = pcs.find((p) => rechnerPasst(p.rechner, geraet));
  if (perRechner) return { pcId: perRechner.pcId, platz: perRechner, grund: "rechner" };
  const perId = eigen && pcs.find((p) => p.pcId.toLowerCase() === eigen.toLowerCase());
  if (perId) return { pcId: perId.pcId, platz: perId, grund: "pcId", merken: !perId.rechner && name ? name : "" };
  if (plan?.auto && name) {
    const frei = pcs.find((p) => !p.rechner && !belegt.has(p.pcId));
    if (frei) return { pcId: frei.pcId, platz: frei, grund: "auto", merken: name };
  }
  return { pcId: eigen, platz: null, grund: eigen ? "eigen" : "" };
}

// Plätze ohne verbundenen PC, für Control, Session und Signale
const virtuellePcs = (plan, pcs = []) => (plan?.pcs || []).filter((p) => !pcs.some((x) => x.pcId === p.pcId && x.verbunden && !x.sim));

module.exports = { standardPlan, migratePlan, istLeer, pcIdFuer, plaetzeAnlegen, platzVon, planWert, planVars, rechnerPasst, zuordnen, virtuellePcs, PLAN_VARS, STANDARD_REGEL, MAX_PLAETZE };
