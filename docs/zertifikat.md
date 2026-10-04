# Code-Signing-Zertifikat: Schritt für Schritt

Overwolf lädt GEP, Overlay und Recorder in einer verteilten Windows-Version nur, wenn die `.exe` mit **deinem eigenen** Code-Signing-Zertifikat signiert ist (zusätzlich zur Overwolf-Signatur mit `OW_BUILD_KEY`). Ohne Zertifikat läuft die App, aber ohne Overwolf-Spieldaten, und Windows zeigt „Unbekannter Herausgeber“.

Stand der Preise und Abläufe: 4. Oktober 2026.

## Welches Zertifikat?

**Empfehlung: Certum „Open Source Code Signing in the Cloud“ für 49 € im Jahr.**

| Option | Kosten | Passt? |
|---|---|---|
| **Certum Open Source Code Signing in the Cloud** (SimplySign) | 49 € / Jahr | **Ja.** Für Einzelpersonen mit Open-Source-Projekt, kein Kartenleser nötig, Schlüssel liegt in der Cloud |
| Certum Open Source Code Signing Set (Karte + Leser) | ca. 69 € + Versand, Verlängerung ca. 29 € | Ja, aber Hardware und Treiber-Gefummel |
| SignPath Foundation | kostenlos | **Nein.** Verlangt ein Projekt ganz ohne proprietäre Teile (ow-electron und NDI sind proprietär), und Herausgeber wäre „SignPath Foundation“ statt du. Overwolf verlangt ein eigenes Zertifikat |
| Certum Standard / Sectigo / DigiCert | 139 bis 300 € / Jahr | Geht, aber unnötig teuer |

Wichtig zu wissen:
- Im Zertifikat steht dein **echter Name**: „Open Source Developer, Vorname Nachname“. Genau das zeigt Windows als Herausgeber an, nicht „Momo“.
- Es gilt **ein Jahr**. Signaturen mit Zeitstempel bleiben auch nach Ablauf gültig, neue Versionen brauchen ein verlängertes Zertifikat.
- Höchstens 5000 Signaturen im Monat (reicht weit).
- SmartScreen warnt anfangs trotzdem noch, bis genug Leute die signierte Datei geladen haben. Das baut sich mit der Zeit ab.

## 1. Vorbereiten (einmal, ca. 15 Minuten)

Du brauchst:
- [ ] **Personalausweis oder Führerschein** (beide Seiten)
- [ ] **Rechnung für Strom, Gas, Wasser oder Telefon** auf deinen Namen und deine aktuelle Adresse (PDF oder Foto, nicht älter als ein paar Monate)
- [ ] **Smartphone** (für die Identitätsprüfung und die App SimplySign)
- [ ] **Windows-PC**, auf dem später signiert wird
- [ ] Die **Projektseite** muss öffentlich zeigen, dass das Projekt dir gehört: https://github.com/Nomisimo/Advanced-Lan

Damit Certum dich mit dem Projekt verbinden kann, sollte dein echter Name dort auftauchen. Am einfachsten eins von beiden:
- GitHub → Settings → Public profile → **Name** auf deinen echten Namen setzen, oder
- in `LICENSE` die Zeile `Copyright (c) 2026 Momo (Nomisimo)` um deinen echten Namen ergänzen.

Tipp: Lege ein PDF an mit Projektname, Link zum Repo, Link zur Lizenz (`LICENSE`, MIT) und einem Satz, dass du der Autor bist. Das kannst du bei der Aktivierung hochladen.

## 2. Bestellen (ca. 10 Minuten)

1. https://shop.certum.eu/open-source-code-signing-on-simplysign.html öffnen.
2. **In den Warenkorb**, dann Konto anlegen (E-Mail, Passwort, Rechnungsadresse als Privatperson).
3. Bezahlen (Karte oder PayPal). Du bekommst eine Bestätigung per E-Mail.

## 3. Daten prüfen lassen (ca. 30 Minuten, dann 1 bis 3 Werktage warten)

1. Im Certum-Shop einloggen → **My account** (Bereich „Data security products“) → im Dashboard **Data verification** (oder in der Zertifikatsliste beim Zertifikat **Provide the data**).
2. **Provide new data** wählen und ausfüllen:
   - Name und Adresse genau wie im Ausweis
   - **Projekt-URL**: `https://github.com/Nomisimo/Advanced-Lan`
3. Rechnung als Adressnachweis hochladen, optional das PDF zum Projekt.
4. Prüfweg **Automatic identity verification** wählen (empfohlen). Du bekommst einen Link per E-Mail. Auf dem Handy: Ausweis vorne und hinten fotografieren, dann ein kurzes Selfie-Video, bei dem du den Kopf drehst.
5. Zusammenfassung prüfen, die Pflicht-Erklärungen ankreuzen, absenden. Certum prüft meist in 1 bis 3 Werktagen und meldet sich per E-Mail, auch bei Rückfragen.

## 4. Zertifikat aktivieren und SimplySign einrichten (ca. 20 Minuten)

1. Nach der Freigabe: im Dashboard **Certificate activation** (oder in der Liste **Activate certificate**).
2. Felder fürs Zertifikat wählen (Pflichtfelder sind vorgegeben), Schlüssel: **Certificate stored in the cloud**, Algorithmus und Schlüssellänge so lassen, wie vorgeschlagen.
3. SimplySign-Konto: **neues Konto automatisch anlegen** lassen und deine E-Mail angeben. Abschließen. Das Zertifikat wird ausgestellt und auf dieses SimplySign-Konto gelegt.
4. Auf dem Handy die App **SimplySign** installieren (Android oder iOS) und mit dem Link oder QR-Code aus der Certum-E-Mail koppeln. Die App zeigt ab dann alle paar Sekunden einen neuen **Token-Code**.
5. Auf dem Windows-PC **SimplySign Desktop** installieren (Download-Link steht in der Certum-E-Mail und auf certum.eu).
6. SimplySign Desktop starten → Rechtsklick aufs Symbol unten rechts in der Taskleiste → verbinden → E-Mail und den aktuellen Token-Code aus der App eingeben.
7. Jetzt erscheint eine virtuelle Smartcard, und das Zertifikat liegt im Windows-Zertifikatsspeicher.

Prüfen in PowerShell:

```powershell
certutil -user -store My
```

Dort steht ein Eintrag „Open Source Developer, Vorname Nachname“. Die Zeile **Zertifikathash (SHA1)** ist der **Fingerabdruck**, den brauchst du gleich. Schreib ihn auf (40 Zeichen, ohne Leerzeichen).

## 5. Overwolf-Schlüssel holen (geht erst nach der Freigabe der App)

Im Overwolf Developers Console (https://console.overwolf.com):
1. **Release management → App Keys** → `OW_BUILD_KEY` kopieren.
2. **Profil → API Keys** → einen API-Key anlegen → das ist `OW_CLI_API_KEY`. `OW_CLI_EMAIL` ist die E-Mail deines Overwolf-Kontos.

Diese Werte sind geheim: nie ins Repo schreiben, nicht in Chats posten.

## 6. Signiert bauen (bei jedem Release, auf deinem Windows-PC)

Signiert wird auf deinem PC, nicht in GitHub Actions: SimplySign will bei jeder Anmeldung einen frischen Code aus der Handy-App.

Einmalig: Windows SDK installieren (enthält `signtool.exe`): https://developer.microsoft.com/windows/downloads/windows-sdk/ (beim Installieren reicht „Windows SDK Signing Tools for Desktop Apps“).

Wenn das Zertifikat da ist, stelle ich `package.json` auf Signieren um (das brauchst du nicht selbst zu machen). Es kommt dann etwa so hinein:

```json
"overwolf": { "requireSigning": true },
"win": {
  "signAndEditExecutable": true,
  "signtoolOptions": {
    "certificateSha1": "DEIN_FINGERABDRUCK",
    "rfc3161TimeStampServer": "http://time.certum.pl",
    "signingHashAlgorithms": ["sha256"]
  }
}
```

`requireSigning` steht bis dahin auf `false`, damit die unsignierten Betas in GitHub Actions bauen. Mit `true` bricht der Build ab, wenn die Overwolf-Schlüssel fehlen, so rutscht keine unsignierte Version in den Store.

Dann bei jedem Release:

```powershell
# 1. SimplySign Desktop verbinden (Token-Code aus der App)
# 2. Im Projektordner:
$env:OW_CLI_EMAIL = "deine@overwolf-mail"
$env:OW_CLI_API_KEY = "…"
$env:OW_BUILD_KEY = "…"
npm ci
npm run dist:win
```

Ergebnis: `dist\Advanced LAN-<Version>-win-x64.exe`, signiert von dir und von Overwolf.

## 7. Prüfen und hochladen

```powershell
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe" verify /pa /v "dist\Advanced LAN-0.1.0-win-x64.exe"
```

Oder: Rechtsklick auf die `.exe` → **Eigenschaften** → Reiter **Digitale Signaturen** → dein Name steht dort.

Danach die `.exe` im Overwolf Developers Console unter **Release management** hochladen.

## Jedes Jahr

Certum schickt vor Ablauf eine E-Mail. Verlängern im Shop (Open Source, wieder ca. 49 €), meist ohne neue Identitätsprüfung. Danach den neuen Fingerabdruck in `package.json` eintragen lassen.

## Quellen

- Certum Shop, Open Source Code Signing in the Cloud: https://shop.certum.eu/open-source-code-signing-on-simplysign.html
- Certum, benötigte Dokumente: https://support.certum.eu/en/code-signing-required-documents/
- Certum, Aktivierung (PDF): https://www.files.certum.eu/documents/manual_en/CS-Open_Source_Code_Signing_in_the_cloud_Certificate_activation.pdf
- Erfahrungsbericht mit Ablauf und signtool: https://piers.rocks/2025/10/30/certum-open-source-code-sign.html
- SignPath Foundation, Bedingungen: https://signpath.org/terms
- Overwolf, App Signing: https://dev.overwolf.com/ow-electron/guides/dev-tools/app-signing/
