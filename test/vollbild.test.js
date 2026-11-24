const test = require("node:test");
const assert = require("node:assert/strict");
const { vollbildArt, vollbildSkript, RANDLOS_HINWEIS } = require("../src/core/vollbild");
const { Regie } = require("../src/core/regie");
const { standardRegie } = require("../src/core/defaults");

test("Vollbild-Zustand aus SHQueryUserNotificationState", () => {
  assert.equal(vollbildArt(3), "exklusiv");
  assert.equal(vollbildArt("3"), "exklusiv");
  assert.equal(vollbildArt(2), "vollbild", "randloses Vollbild-Spiel");
  assert.equal(vollbildArt(5), "", "normaler Desktop");
  assert.equal(vollbildArt(1), "");
  assert.equal(vollbildArt("x"), "");
});

test("PowerShell-Skript fragt den Zustand ab und endet mit der App", () => {
  const s = vollbildSkript(4242, 1500);
  assert.match(s, /SHQueryUserNotificationState/);
  assert.match(s, /Get-Process -Id 4242/);
  assert.match(s, /Start-Sleep -Milliseconds 1500/);
  assert.match(vollbildSkript("; rm -rf /"), /Get-Process -Id 0/, "nur Zahlen kommen ins Skript");
  assert.ok(RANDLOS_HINWEIS.valorant && RANDLOS_HINWEIS.cs2 && RANDLOS_HINWEIS.rl);
});

test("Regie merkt sich den Vollbild-Hinweis je PC, neu verbinden setzt ihn zurück", () => {
  const cfg = standardRegie();
  const r = new Regie({ getConfig: () => cfg });
  r.pcVerbunden("PC 01", {});
  r.pcHinweis("PC 01", { vollbild: "exklusiv", nameOffen: 1 });
  assert.deepEqual(r.pcs.get("PC 01").hinweis, { vollbild: "exklusiv", nameOffen: true });
  r.pcHinweis("PC 01", { vollbild: "<script>" });
  assert.deepEqual(r.pcs.get("PC 01").hinweis, { vollbild: "", nameOffen: false });
  r.pcHinweis("PC 99", { vollbild: "exklusiv" });
  assert.equal(r.pcs.has("PC 99"), false);
  r.pcHinweis("PC 01", { vollbild: "exklusiv" });
  r.pcVerbunden("PC 01", {});
  assert.equal(r.pcs.get("PC 01").hinweis, null);
});

test("Session: Hinweis vom Game-PC, Name und Popup von der Regie", async (t) => {
  const { SessionServer } = require("../src/main/session-server");
  const { SessionClient } = require("../src/main/session-client");
  const warte = (bed, ms = 3000) => new Promise((res, rej) => {
    const t0 = Date.now();
    const i = setInterval(() => { if (bed()) { clearInterval(i); res(); } else if (Date.now() - t0 > ms) { clearInterval(i); rej(new Error("Zeitüberschreitung")); } }, 20);
  });
  const cfg = { ...standardRegie(), session: { name: "Vollbild-Test", passwort: "pw", port: 0, offen: true } };
  const regie = new Regie({ getConfig: () => cfg, send: () => Promise.resolve() });
  const server = new SessionServer({ regie, getConfig: () => cfg });
  let spieler = "", gefragt = 0;
  const client = new SessionClient({
    spieler: () => spieler,
    onSpielerSetzen: (name) => { spieler = name; client.spieler(name); },
    onNameFragen: () => { gefragt++; },
  });
  t.after(async () => { client.trennen(); await server.schliessen(); });
  assert.equal(await server.oeffnen(), true);
  // Hinweis vor dem Verbinden: kommt nach der Anmeldung an
  client.hinweis({ vollbild: "exklusiv", nameOffen: true });
  client.verbinden({ host: "127.0.0.1", port: server.port, passwort: "pw", pcId: "PC 07", spiele: ["valorant"] });
  await warte(() => regie.pcs.get("PC 07")?.hinweis?.nameOffen);
  assert.equal(regie.pcs.get("PC 07").hinweis.vollbild, "exklusiv");
  assert.equal(server.spielerSetzen("PC 07", "Momo"), true);
  await warte(() => regie.pcs.get("PC 07").spieler === "Momo");
  assert.equal(spieler, "Momo");
  assert.equal(server.nameFragen("PC 07"), true);
  await warte(() => gefragt === 1);
  assert.equal(server.spielerSetzen("PC 99", "x"), false, "nicht verbunden");
});
