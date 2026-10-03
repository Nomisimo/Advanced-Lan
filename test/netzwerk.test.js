const test = require("node:test");
const assert = require("node:assert/strict");
const { kartenListe, imSubnetz, lokaleIp, waehleAdresse, zielHinweis } = require("../src/core/netzwerk.js");

const ifaces = {
  lo: [{ family: "IPv4", address: "127.0.0.1", netmask: "255.0.0.0", internal: true, mac: "00:00:00:00:00:00" }],
  "Ethernet": [{ family: "IPv4", address: "10.0.0.5", netmask: "255.255.255.0", internal: false, mac: "aa:bb:cc:00:00:01" }, { family: "IPv6", address: "fe80::1", internal: false }],
  "Licht": [{ family: "IPv4", address: "2.0.0.10", netmask: "255.0.0.0", internal: false, mac: "aa:bb:cc:00:00:02" }],
};
const karten = kartenListe(ifaces);

test("Netzwerk: Karten ohne Loopback und IPv6", () => {
  assert.deepEqual(karten.map((k) => k.name), ["Ethernet", "Licht"]);
  assert.equal(karten[1].mac, "aa:bb:cc:00:00:02");
});

test("Netzwerk: Subnetz und lokale IP", () => {
  assert.ok(imSubnetz("2.1.2.3", karten[1]));
  assert.ok(!imSubnetz("10.0.1.3", karten[0]));
  assert.deepEqual(lokaleIp(karten, ""), { ip: "" });
  assert.deepEqual(lokaleIp(karten, "Licht"), { ip: "2.0.0.10" });
  assert.match(lokaleIp(karten, "WLAN").fehler, /WLAN/);
});

test("Netzwerk: Adresse der Regie im eigenen Netz wählen", () => {
  assert.equal(waehleAdresse(["192.168.1.2", "10.0.0.20"], karten, ""), "10.0.0.20");
  assert.equal(waehleAdresse(["10.0.0.20", "2.0.0.1"], karten, "Licht"), "2.0.0.1");
  assert.equal(waehleAdresse(["172.16.0.1"], karten, ""), "172.16.0.1");
});

test("Netzwerk: Hinweis, wenn das Ziel nicht im Netz der Karte liegt", () => {
  assert.equal(zielHinweis("2.0.0.50", karten[1]), "");
  assert.match(zielHinweis("10.0.0.50", karten[1]), /nicht im Netz/);
});
