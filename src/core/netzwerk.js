"use strict";
// Netzwerkkarten wählen: Empfang (Session), Senden (OSC) und je Ziel. Gespeichert wird der Name der Karte,
// die IP wird bei jeder Nutzung neu gelesen (DHCP kann sie ändern).

const ipZahl = (ip) => String(ip).split(".").reduce((n, t) => ((n << 8) | (Number(t) & 255)) >>> 0, 0);
const istIpv4 = (ip) => /^\d{1,3}(\.\d{1,3}){3}$/.test(String(ip || ""));

// Alle aktiven IPv4-Karten aus os.networkInterfaces()
function kartenListe(ifaces) {
  const out = [];
  for (const [name, list] of Object.entries(ifaces || {}))
    for (const a of list || []) if (a.family === "IPv4" || a.family === 4) if (!a.internal) out.push({ name, ip: a.address, maske: a.netmask, mac: a.mac });
  return out;
}

function imSubnetz(ip, karte) {
  if (!karte || !istIpv4(ip) || !istIpv4(karte.ip) || !istIpv4(karte.maske)) return false;
  const m = ipZahl(karte.maske);
  return ((ipZahl(ip) & m) >>> 0) === ((ipZahl(karte.ip) & m) >>> 0);
}

// Name → Karte. Leerer Name = automatisch (Betriebssystem entscheidet).
const karteFuer = (karten, name) => (name ? karten.find((k) => k.name === name) || null : null);

// Wie eine gewählte Karte gerade aussieht: { ip } oder { fehler }. Leer = automatisch.
function lokaleIp(karten, name) {
  if (!name) return { ip: "" };
  const k = karteFuer(karten, name);
  return k ? { ip: k.ip } : { fehler: `Netzwerkkarte „${name}“ nicht verbunden` };
}

// Von mehreren Adressen der Regie die nehmen, die im Netz einer eigenen Karte liegt (gewählte Karte zuerst)
function waehleAdresse(adressen, karten, bevorzugt) {
  const ips = (adressen || []).filter(istIpv4);
  const reihe = [karteFuer(karten, bevorzugt), ...karten].filter(Boolean);
  for (const k of reihe) { const ip = ips.find((a) => imSubnetz(a, k)); if (ip) return ip; }
  return ips[0] || "";
}

// Hinweis, wenn ein Ziel nicht im Netz der gewählten Karte liegt
function zielHinweis(host, karte) {
  if (!karte || !istIpv4(host)) return "";
  return imSubnetz(host, karte) ? "" : `${host} liegt nicht im Netz von „${karte.name}“ (${karte.ip}/${karte.maske}). Das Betriebssystem leitet dann nach seiner Routing-Tabelle.`;
}

module.exports = { kartenListe, imSubnetz, karteFuer, lokaleIp, waehleAdresse, zielHinweis, istIpv4 };
