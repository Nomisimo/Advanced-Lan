"use strict";
// Regie: nimmt Ereignisse der Game-PCs an, lässt nur das aktive Spiel durch, entdoppelt und führt die eingestellten OSC-Befehle aus.
// Ohne Netzwerk: Senden und Melden kommen von außen (Main-Prozess oder Browser-Vorschau).

const { Dedupe, mehrfachModus } = require("./events");
const { befehleFuer, zuweisungen, zeigeNachricht } = require("./signal");
const { Statistik } = require("./statistik");
const { SPIEL_BY_ID } = require("./spiele");
const { leseSpieler } = require("./protokoll");
const { matchGruppen, matchWahl } = require("./match-check");
const { mvpAusloeser } = require("./aktionen");
const { ranking } = require("./stats-screen");

// Verzögerung eines Befehls in ms (Feld „Verzögerung“ im Tab „Signale“), 0 bis 10 Minuten
const verzoegerung = (z) => Math.min(600000, Math.max(0, Math.round(Number(z?.verzoegerung) || 0)));

const LOG_MAX = 300;
// Zählen dasselbe wie die Filter im Event-Log, nur ohne dessen Grenze von LOG_MAX Einträgen.
// fehler = Ereignisse mit mindestens einem Fehler, gesendet = einzelne OSC-Nachrichten.
// Dasselbe Match? CS2: gleiche Map und gemeinsame PCs, auch wenn sich die ID geändert hat (sie hängt am ersten PC)
const gleichesMatch = (a, b) => a.id === b.id || (b.id.startsWith("cs2:") && a.id.split(":")[1] === b.id.split(":")[1] && a.pcs.some((p) => b.pcs.includes(p)));
const neueZaehler = () => ({ ereignisse: 0, eingerichtet: 0, verworfen: 0, gesendet: 0, fehler: 0 });

class Regie {
  constructor({ getConfig, send, emit, now = Date.now, timer = setTimeout }) {
    this.timer = timer;
    this.testNr = 0;
    this.getConfig = getConfig;
    this.send = send; // ({ ziel, address, args }) → Promise
    this.emit = emit || (() => {}); // (typ, daten)
    this.now = now;
    this.pcs = new Map(); // pcId → { pcId, spieler, spiele, spiel (zuletzt gemeldet), verbunden, remote, sim, t, status, stand }
    this.stand = null; // letzter Spielstand des aktiven Spiels
    this.log = [];
    this.verworfenLog = [];
    this.dedupe = new Dedupe();
    this.zaehler = neueZaehler();
    this.nr = 0;
    this.statistik = new Statistik();
    // Matches des aktiven Spiels (match-check.js) und das gewählte: nur dessen Events lösen Signale aus und zählen in der Statistik
    this.gruppen = [];
    this.match = null;
    this.matchVorher = { id: "", pcs: [], folgt: "" };
  }

  // Matches neu bestimmen (nach Status, Verbindung, Event oder geänderter Einstellung). Wechselt das gewählte Match,
  // fängt die Statistik neu an und der Spielstand kommt vom neuen Match.
  matchAktualisieren() {
    const aktiv = this.aktiv(), einstellung = this.getConfig().match || { auto: true, wahl: "" };
    this.gruppen = matchGruppen([...this.pcs.values()], aktiv);
    const vorher = this.matchVorher.id.startsWith(`${aktiv}:`) ? this.matchVorher : { id: "", pcs: [], folgt: "" };
    const g = matchWahl(this.gruppen, einstellung, vorher);
    const alt = this.match;
    this.match = g;
    if (!g) return;
    this.matchVorher = { id: g.id, pcs: g.pcs, folgt: einstellung.auto === false ? einstellung.wahl : "" };
    if (alt && !gleichesMatch(alt, g)) this.statistik.reset(aktiv);
    this.stand = { ...g.stand, spiel: aktiv, t: this.now() };
  }

  // Ist dieser PC in einem anderen als dem gewählten Match? Ohne Matchdaten (kein Spielstand, The Finals) nie.
  imAnderenMatch(pcId) {
    if (!this.match) return false;
    const g = this.gruppen.find((x) => x.pcs.includes(pcId));
    return !!g && g.id !== this.match.id;
  }

  aktiv() { return this.getConfig().aktivesSpiel; }

  // vorlage: Stand der Game-PC-Vorlage auf diesem PC (Fingerabdruck), "eigene" = PC nimmt keine Vorlage an, "" = unbekannt
  pcVerbunden(pcId, { spiele = [], remote = "", sim = false, geraet = {}, spieler = "", vorlage = "" } = {}) {
    const alt = this.pcs.get(pcId) || {};
    this.pcs.set(pcId, { ...alt, pcId, spiele, remote, sim, geraet, spieler: leseSpieler(spieler), vorlage: String(vorlage || ""), hinweis: null, verbunden: true, t: this.now() });
    this.emit("status");
  }

  // Antwort eines Game-PCs auf die verteilte Vorlage
  pcVorlage(pcId, stand) {
    const p = this.pcs.get(pcId);
    if (p) { p.vorlage = String(stand || ""); this.emit("status"); }
  }

  // Hinweis des Game-PCs: vollbild = "exklusiv" (Overlay und Namens-Popup dort unsichtbar), "vollbild" oder ""
  // nameOffen = das Namens-Popup wartet, bis das Spiel das exklusive Vollbild verlässt
  pcHinweis(pcId, h) {
    const p = this.pcs.get(pcId);
    if (!p) return;
    const v = String(h?.vollbild || "");
    p.hinweis = { vollbild: ["exklusiv", "vollbild"].includes(v) ? v : "", nameOffen: !!h?.nameOffen };
    this.emit("status");
  }

  // Spielername aus dem Namens-Popup des Game-PCs, leer = PC-ID zeigen
  pcSpieler(pcId, name) {
    const p = this.pcs.get(pcId);
    if (p) { p.spieler = leseSpieler(name); this.emit("status"); }
  }

  // Namen für den Game-Stats-Screen: { Name im Spiel oder PC-ID → Spielername, sonst PC-ID }.
  // Nur der eigene Spieler eines PCs (sein Status nennt ihn) bekommt dessen Namen. Wen ein PC nicht als sich selbst meldet
  // (Rocket League meldet alle Spieler des Matches), der behält den Namen aus dem Spiel.
  namen() {
    const out = {};
    for (const p of this.pcs.values()) {
      const name = p.spieler || p.pcId;
      if (p.status?.spieler && !(p.status.spieler in out)) out[p.status.spieler] = name;
      out[p.pcId] = name;
    }
    return out;
  }

  pcGetrennt(pcId) {
    const p = this.pcs.get(pcId);
    if (p) { p.verbunden = false; this.matchAktualisieren(); this.emit("status"); }
  }

  pcPing(pcId, ms) {
    const p = this.pcs.get(pcId);
    if (p) { p.ping = ms; p.pingT = this.now(); this.emit("status"); }
  }

  pcEntfernen(pcId) { this.pcs.delete(pcId); this.matchAktualisieren(); this.emit("status"); }

  // Status-Meldung eines Game-PCs (Spieler, Leben, Spielstand)
  pcStatus(pcId, { spiel, status, stand }) {
    const p = this.pcs.get(pcId);
    if (!p) return;
    Object.assign(p, { spiel: spiel || p.spiel, status: status || p.status, t: this.now() });
    if (stand) p.stand = stand;
    this.matchAktualisieren();
    // Spielstand kommt vom gewählten Match; ohne Matches (z. B. The Finals) vom letzten PC
    if (stand && p.spiel === this.aktiv() && !this.match) this.stand = { ...stand, spiel: p.spiel, t: this.now() };
    this.emit("status");
  }

  // Ereignis eines Game-PCs. Nur das aktive Spiel erzeugt Signale, alles andere wird verworfen.
  // sim: vom Simulator der Regie im Namen dieses PCs erzeugt
  pcEvent(pcId, spiel, ev, { sim = false } = {}) {
    const p = this.pcs.get(pcId);
    if (p) { p.t = this.now(); p.spiel = spiel; }
    const e = { ...ev, spiel, pc: pcId, pcId }, quelle = sim || p?.sim ? "sim" : "pc";
    if (spiel !== this.aktiv()) return this.verwerfen(e, "anderes Spiel", quelle);
    this.matchAktualisieren();
    if (this.imAnderenMatch(pcId)) return this.verwerfen(e, "anderes Match", quelle);
    // Mehrere PCs melden dieselbe Runde: einmal zählen. Je Event einstellbar (Setup → Mehrfach gemeldete Events)
    const modus = mehrfachModus(this.getConfig(), spiel, e.type);
    if (modus === "team") {
      // Nur PCs im Team des Events (Team des PCs aus seinem Status), jeder einmal
      const pcTeam = p?.status?.team || p?.stand?.sf?.team || "";
      if (!e.team) return this.verwerfen(e, "ohne Team", quelle);
      if (!pcTeam) return this.verwerfen(e, "Team des PCs unbekannt", quelle);
      if (pcTeam !== e.team) return this.verwerfen(e, "PC im anderen Team", quelle);
    }
    const proPc = modus === "pc" || modus === "team";
    if (modus !== "alle" && !this.dedupe.accept(e, this.now(), { proPc })) return this.verwerfen(e, proPc ? "doppelt (selber PC)" : "doppelt", quelle);
    return this.fire(e, quelle);
  }

  // Verworfene Ereignisse kommen in ein eigenes Log, damit sie die echten nicht verdrängen
  verwerfen(ev, grund, quelle) {
    this.zaehler.verworfen++;
    const eintrag = { id: ++this.nr, t: this.now(), ev, quelle, verworfen: grund, scharf: false, gesperrt: true, befehle: [], fehler: [] };
    this.verworfenLog.unshift(eintrag);
    if (this.verworfenLog.length > LOG_MAX) this.verworfenLog.length = LOG_MAX;
    this.emit("event", eintrag);
    this.emit("status");
    return null;
  }

  // Beide Logs, neueste zuerst
  alleLogs() { return [...this.log, ...this.verworfenLog].sort((a, b) => b.id - a.id); }

  // Führt die Befehle aus, die im Tab „Signale“ für dieses Event eingestellt sind.
  // Ohne passende Zuweisung erscheint das Ereignis nur im Log.
  fire(ev, quelle = "pc") {
    const cfg = this.getConfig(), now = this.now();
    this.zaehler.ereignisse++;
    const befehle = befehleFuer(cfg, ev);
    if (befehle.length) this.zaehler.eingerichtet++;
    const eintrag = {
      id: ++this.nr, t: now, ev, quelle, scharf: !!cfg.armed, gesperrt: befehle.length === 0,
      befehle: befehle.map((b) => ({ ziel: b.ziel?.name || "?", typ: b.ziel?.typ || "", nachrichten: b.nachrichten.map(zeigeNachricht), fehler: b.fehler, ...(verzoegerung(b.zuweisung) ? { ms: verzoegerung(b.zuweisung) } : {}) })),
      fehler: befehle.filter((b) => b.fehler).map((b) => `${b.ziel?.name || "?"}: ${b.fehler}`),
    };
    if (eintrag.fehler.length) this.fehlerZaehlen(eintrag);
    if (cfg.armed) for (const b of befehle) {
      const ms = verzoegerung(b.zuweisung);
      // Verzögert: nur senden, wenn die Ausgabe dann noch an ist
      if (ms) this.timer(() => { if (this.getConfig().armed) this.ausgeben(b, eintrag); }, ms);
      else this.ausgeben(b, eintrag);
    }
    if (ev.spiel === this.aktiv()) this.statistik.add(ev);
    this.log.unshift(eintrag);
    if (this.log.length > LOG_MAX) this.log.length = LOG_MAX;
    this.emit("event", eintrag);
    this.emit("status");
    if (ev.type !== "match_mvp" && ev.type === mvpAusloeser(cfg, ev.spiel)) this.matchMvp(ev);
    return eintrag;
  }

  // Match-MVP: bester Spieler im Ranking des MVP-Endscreens, sobald das Auslöser-Event da ist
  matchMvp(ausloeser) {
    const [mvp] = ranking(this.snapshot(), SPIEL_BY_ID[ausloeser.spiel]);
    if (!mvp) return null;
    const pc = mvp.pcId || ausloeser.pc || "";
    return this.fire({ type: "match_mvp", spiel: ausloeser.spiel, player: mvp.name, team: mvp.team || "", pc, pcId: pc, round: ausloeser.round, match: ausloeser.match, aktion: `nach ${ausloeser.type}` }, "regie");
  }

  // Befehl einer Zuweisung mit einem Test-Ereignis, das zu ihren Filtern passt
  testBefehl(cfg, spiel, type, zuweisung) {
    // Ohne PC-Filter spielt der erste Platz aus dem Plan den Auslöser, damit {nr} und {plan} einen Wert haben
    const pc = zuweisung.pc || cfg.plan?.pcs?.[0]?.pcId || "Regie";
    const ev = { type, spiel, team: zuweisung.team || SPIEL_BY_ID[spiel]?.teams?.[0] || "", player: "Testspieler", pc, pcId: pc, round: 1, ...(zuweisung.seite ? { seiteTeam: zuweisung.seite } : {}) };
    return befehleFuer({ ...cfg, signale: { [spiel]: { [type]: [{ ...zuweisung, aus: false }] } } }, ev)[0];
  }

  // Test-Knopf einer Zuweisung im Tab „Signale“: sendet sofort, auch wenn die Ausgabe aus ist
  testeZuweisung(spiel, type, zuweisung) {
    const b = this.testBefehl(this.getConfig(), spiel, type, zuweisung);
    const k = { nachrichten: b ? b.nachrichten.map(zeigeNachricht) : [], ziel: b?.ziel?.name || "", fehler: b?.fehler ? [b.fehler] : b ? [] : ["Filter passt nicht zum Test-Event"] };
    if (b && !b.fehler) this.ausgeben(b, k);
    return k;
  }

  // Knopf „Alle testen“ eines Events im Tab „Signale“: alle Befehle des Events (auch die von „Allgemein“ geerbten)
  // wie beim echten Event, jeder mit seiner Verzögerung, auch wenn die Ausgabe aus ist. Abgeschaltete Befehle bleiben aus.
  testeEvent(spiel, type) {
    const cfg = this.getConfig();
    const k = { befehle: [], fehler: [], gesendet: 0, verzoegert: 0, maxMs: 0, ereignis: `test:${++this.testNr}` }; // Sounds des Tests laufen zusammen
    for (const z of zuweisungen(cfg, spiel, type)) {
      if (z.aus === true) continue;
      const b = this.testBefehl(cfg, spiel, type, z);
      if (!b) continue;
      const name = b.ziel?.name || "?";
      if (b.fehler) { k.fehler.push(`${name}: ${b.fehler}`); continue; }
      const ms = verzoegerung(z);
      k.befehle.push({ ziel: name, nachrichten: b.nachrichten.map(zeigeNachricht), ...(ms ? { ms } : {}) });
      k.gesendet++;
      if (ms) { k.verzoegert++; k.maxMs = Math.max(k.maxMs, ms); this.timer(() => this.ausgeben(b, k), ms); }
      else this.ausgeben(b, k);
    }
    return k;
  }

  ausgeben(b, k) {
    const ziel = b.ziel;
    for (const n of b.nachrichten) {
      this.zaehler.gesendet++;
      Promise.resolve(this.send({ ziel, address: n.address, args: n.args, ...(k.ereignis || k.id ? { ereignis: k.ereignis || k.id } : {}) })).catch((e) => {
        if (k.id) this.fehlerZaehlen(k);
        k.fehler.push(`${ziel.name || ziel.host}: ${e.message}`);
        this.emit("fehler", `${ziel.name || ziel.host}: ${e.message}`);
        if (k.id) this.emit("event", k); // Log-Eintrag mit dem Fehler erneut melden (gleiche ID)
      });
    }
  }

  // Jedes Ereignis zählt höchstens einmal als Fehler, egal wie viele Nachrichten scheitern
  fehlerZaehlen(k) {
    if (k.fehlerGezaehlt) return;
    k.fehlerGezaehlt = true;
    this.zaehler.fehler++;
    this.emit("status");
  }

  // Knopf „Zurücksetzen“ im Control-Tab: Zähler auf null, Event-Log leer
  zuruecksetzen() {
    this.zaehler = neueZaehler();
    this.log = [];
    this.verworfenLog = [];
    this.emit("status");
  }

  snapshot() {
    const namen = this.namen();
    // matches: alle Matches des aktiven Spiels, match: das gewählte (Tab „Control“)
    const matches = this.gruppen.map(({ id, pcs, anzahl, stand }) => ({ id, pcs, anzahl, stand }));
    return { pcs: [...this.pcs.values()], stand: this.stand, matches, match: this.match?.id || "", zaehler: { ...this.zaehler }, aktivesSpiel: this.aktiv(), statistik: this.statistik.json((n) => namen[n]), namen };
  }
}

module.exports = { Regie };
