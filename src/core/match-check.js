"use strict";
// Prüft, ob die Game-PCs im selben Match sind. Verglichen wird der Spielstand, den jeder PC meldet:
// Rocket League hat eine eindeutige MatchGuid, CS2 liefert keine Match-ID, dort zählen Map und Spielstand.
// Dota 2 meldet eine Match-ID (sonst zählt die Map). Valorant bekommt die MatchID vom Riot Client (main/riot-client.js),
// ohne ihn und bei The Finals gibt es weder Match noch Map: kein Vergleich, die Events zählen immer.

// CS2: gleiche Map und höchstens zwei Runden Unterschied (Meldungen kommen gedrosselt, am Rundenende kurz versetzt)
const csGleich = (a, b) => a.map === b.map && Math.abs(a.ct - b.ct) + Math.abs(a.tt - b.tt) <= 2;
const rlGleich = (a, b) => (a.match || b.match ? a.match === b.match : a.arena === b.arena);
const idGleich = (a, b) => (a.match || b.match ? a.match === b.match : a.map === b.map);
const hatStand = (spiel, s) => (spiel === "rl" ? s.match || s.arena : spiel === "cs2" ? s.map : s.match || s.map);
const vergleich = (aktiv) => (aktiv === "rl" ? rlGleich : aktiv === "cs2" ? csGleich : idGleich);
const mitStand = (pcs, aktiv) => pcs.filter((p) => p.verbunden && p.spiel === aktiv && p.stand && hatStand(aktiv, p.stand));

// pcs: [{ pcId, spiel, stand, verbunden }]. Gibt pcId → "gleich" | "anders" | "" (kein Spielstand) zurück
// und die Referenz: der Spielstand, den die meisten PCs teilen.
function matchCheck(pcs, aktiv) {
  const gleich = vergleich(aktiv), mit = mitStand(pcs, aktiv);
  let ref = null, best = 0;
  for (const p of mit) {
    const n = mit.filter((q) => gleich(p.stand, q.stand)).length;
    if (n > best) { best = n; ref = p.stand; }
  }
  const ergebnis = {};
  for (const p of pcs) ergebnis[p.pcId] = !mit.includes(p) ? "" : gleich(p.stand, ref) ? "gleich" : "anders";
  return { ergebnis, ref, anzahl: best, gesamt: mit.length };
}

// Alle Matches des aktiven Spiels, größtes zuerst: [{ id, pcs: [pcId], anzahl, stand }].
// Jeder PC gehört zu höchstens einem Match. Die ID ist das Match selbst (MatchGuid, Match-ID, sonst Map/Arena);
// CS2 hat keine, dort Map und der erste PC der Gruppe: Sie ändert sich, wenn dieser PC geht (matchWahl folgt dann den PCs).
function matchGruppen(pcs, aktiv) {
  const gleich = vergleich(aktiv);
  let frei = mitStand(pcs, aktiv);
  const gruppen = [];
  while (frei.length) {
    // Anker: der PC, der mit den meisten anderen übereinstimmt
    let anker = frei[0], best = 0;
    for (const p of frei) {
      const n = frei.filter((q) => gleich(p.stand, q.stand)).length;
      if (n > best) { best = n; anker = p; }
    }
    const drin = frei.filter((q) => gleich(anker.stand, q.stand));
    frei = frei.filter((q) => !drin.includes(q));
    const ids = drin.map((p) => p.pcId).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const s = anker.stand;
    const id = aktiv === "cs2" ? `cs2:${s.map}:${ids[0]}` : aktiv === "rl" ? `rl:${s.match || s.arena}` : `${aktiv}:${s.match || s.map}`;
    gruppen.push({ id, pcs: ids, anzahl: ids.length, stand: s });
  }
  return gruppen.sort((a, b) => b.anzahl - a.anzahl);
}

// Welches Match zählt? einstellung: { auto, wahl } aus cfg.regie.match, vorher: { id, pcs } des bisher gewählten.
// auto: das Match mit den meisten PCs; gewechselt wird nur, wenn ein anderes wirklich mehr hat (kein Hin und Her bei Gleichstand).
// fest: das Match mit der ID wahl. Ist es weg (neues Match, CS2-ID geändert), zählt das Match, in dem die meisten seiner PCs jetzt sind.
function matchWahl(gruppen, einstellung = {}, vorher = { id: "", pcs: [] }) {
  if (!gruppen.length) return null;
  const folgen = () => {
    let best = null, n = 0;
    for (const g of gruppen) {
      const k = g.pcs.filter((p) => vorher.pcs.includes(p)).length;
      if (k > n) { n = k; best = g; }
    }
    return best;
  };
  const bisher = gruppen.find((g) => g.id === vorher.id) || folgen();
  if (einstellung.auto !== false) return bisher && bisher.anzahl >= gruppen[0].anzahl ? bisher : gruppen[0];
  return gruppen.find((g) => g.id === einstellung.wahl) || (vorher.id === einstellung.wahl || vorher.folgt === einstellung.wahl ? bisher : null);
}

module.exports = { matchCheck, matchGruppen, matchWahl };
