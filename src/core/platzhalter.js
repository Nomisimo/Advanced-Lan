"use strict";
// Platzhalter in Befehlswerten, OSC-Adressen und Argumenten: {name} setzt einen Wert ein, {100+nr} rechnet.
// Rechnen kann + − × ÷ und Klammern mit Zahlen und Platzhaltern, z. B. {100+nr}, {nr*10}, {(nr-1)*4+1}.
// Unbekannte Platzhalter bleiben leer, ebenso eine Rechnung mit einem Wert, der keine Zahl ist. Andere geschweifte
// Klammern (Leerzeichen, Anführungszeichen …) bleiben unverändert stehen.

const zahlVon = (v) => {
  const n = Number(String(v ?? "").trim().replace(",", "."));
  return String(v ?? "").trim() !== "" && Number.isFinite(n) ? n : NaN;
};

// Kleine Rechnung ohne eval: Zahlen, Namen, + - * / und Klammern
function rechne(text, vars) {
  const t = String(text).match(/\d+(?:[.,]\d+)?|[A-Za-z_]\w*|[-+*/()]/g) || [];
  if (t.join("") !== String(text).replace(/\s+/g, "")) return NaN;
  let i = 0;
  const wert = () => {
    const x = t[i++];
    if (x === "(") { const v = summe(); if (t[i++] !== ")") return NaN; return v; }
    if (x === "-") return -wert();
    if (x === "+") return wert();
    if (x == null) return NaN;
    if (/^\d/.test(x)) return Number(x.replace(",", "."));
    return zahlVon(vars[x]);
  };
  const produkt = () => {
    let v = wert();
    while (t[i] === "*" || t[i] === "/") { const op = t[i++], r = wert(); v = op === "*" ? v * r : r === 0 ? NaN : v / r; }
    return v;
  };
  const summe = () => {
    let v = produkt();
    while (t[i] === "+" || t[i] === "-") { const op = t[i++], r = produkt(); v = op === "+" ? v + r : v - r; }
    return v;
  };
  const v = summe();
  return i === t.length ? v : NaN;
}

const zahlText = (n) => (Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6) : "");

// "{seq}" → Wert, "{100+nr}" → Ergebnis
const einsetzen = (s, vars = {}) => String(s ?? "").replace(/\{([^{}]+)\}/g, (ganz, innen) => {
  const k = innen.trim();
  if (/^\w+$/.test(k)) return String(vars[k] ?? "");
  if (/^[\w\s.,+\-*/()]+$/.test(k)) return zahlText(rechne(k, vars));
  return ganz;
});

// Kommt einer dieser Platzhalter im Text vor (auch in einer Rechnung)?
const nutzt = (s, namen) => {
  const re = new RegExp(`\\b(${namen.join("|")})\\b`);
  return (String(s ?? "").match(/\{([^{}]+)\}/g) || []).some((p) => re.test(p));
};

module.exports = { einsetzen, rechne, nutzt, zahlText };
