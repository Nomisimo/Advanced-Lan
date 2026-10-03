const test = require("node:test");
const assert = require("node:assert/strict");
const { overlayStatus, FRISCH } = require("../src/core/overlay-status.js");

const jetzt = 1_000_000;
const verbunden = { zustand: "verbunden", session: "LAN", gesendet: 12 };

test("Overlay: rot ohne Session, bei Ablehnung und bei GSI-Fehler", () => {
  assert.equal(overlayStatus({ jetzt }).farbe, "err");
  assert.equal(overlayStatus({ client: { zustand: "abgelehnt", grund: "Passwort" }, jetzt }).text, "Session abgelehnt: Passwort");
  assert.equal(overlayStatus({ client: verbunden, gsi: { fehler: "Port belegt" }, letzteCs2: jetzt, jetzt }).farbe, "err");
});

test("Overlay: orange beim Verbinden und ohne frische Spieldaten", () => {
  assert.equal(overlayStatus({ client: { zustand: "verbinde" }, jetzt }).farbe, "warn");
  assert.equal(overlayStatus({ client: verbunden, jetzt }).farbe, "warn");
  assert.equal(overlayStatus({ client: verbunden, letzteCs2: jetzt - FRISCH - 1, jetzt }).farbe, "warn");
});

test("Overlay: grün mit Session und Daten", () => {
  const s = overlayStatus({ client: verbunden, letzteCs2: jetzt - 1000, letzteRl: jetzt - 2000, jetzt });
  assert.equal(s.farbe, "ok");
  assert.match(s.text, /CS2 \+ Rocket League → Session „LAN“, 12 Events/);
});
