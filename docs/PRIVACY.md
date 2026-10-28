# Advanced LAN – Privacy Policy

_Last updated: 28 October 2026_

Advanced LAN ("the app") is a free, open-source desktop app published by Momo (GitHub: [Nomisimo](https://github.com/Nomisimo)). It turns in-game events into OSC commands for stage lighting, audio and video. This policy explains which data the app processes.

## Summary

- The app shows **no ads** and has **no user accounts**.
- The publisher **does not collect, store or sell personal data**. There is no server operated by the publisher.
- Game events stay in your local network and go only to the devices you configure.
- For Valorant and The Finals the app captures the screen of the game PC. The image is analysed on that PC only and never leaves it.
- The app runs on plain Electron and sends no analytics or usage data.

## Data processed on your computer and in your local network

| Data | Purpose | Where it goes |
|---|---|---|
| In-game events (for example kills, rounds, goals, match results, player names shown in the game, team) | Trigger lighting, audio and video cues; show the Game Stats Screen | From the game PC to the control PC ("Regie") in your local network, and as OSC/NDI to the devices you add. Never to the publisher. |
| PC name you enter, host name, local IP address, MAC address, app version, ping | Show which game PCs are connected | Sent from game PCs to the control PC in the same local network |
| Session name and password | Protect a session in your local network | Stored locally; the password itself is never sent, only an HMAC challenge-response |
| Screen image of the game PC (Valorant, The Finals) | Recognise game actions such as round won or spike planted, including text recognition (English, German) that runs offline on the PC | Analysed in memory on the game PC. Only the recognised event goes to the control PC. A recording made in the editor stays in memory until you delete it or close the app; only small cut-outs you pick as frames are saved in your settings and in files you export yourself. |
| Settings (targets, signals, hotkey, consent date) | Remember your configuration | Stored locally in your user profile (`advanced-lan.json`) |

Game data is read only from official interfaces: Valve Game State Integration (Counter-Strike 2, Dota 2), and the Psyonix Rocket League Stats API. For Valorant and The Finals the app only looks at the screen image, like a viewer would. The app does not read game memory, does not inject into games and does not modify them.

## Data sent to third parties

- **Automation Overdrive (optional)**: If you install the third-party Overwolf app Automation Overdrive for Valorant, it sends game events to Advanced LAN on the same PC (`localhost`). That app and the Overwolf client are not part of Advanced LAN; their own privacy policies apply ([legal.overwolf.com](https://legal.overwolf.com/)).
- **GitHub**: To check for updates, the app requests the public release list from `api.github.com` and downloads updates from `github.com`. GitHub receives your IP address as part of these requests ([GitHub Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement)).
- **Feedback**: If you click **Report** in the app, your browser opens a new GitHub issue that already contains the app version, your operating system and the selected mode. Nothing is sent unless you submit the issue yourself.

## Children

The app is not directed at children under 16 and does not knowingly process their personal data.

## Your rights

Because the publisher stores no personal data, there is nothing to access, correct or delete on the publisher's side. You can delete all local data by uninstalling the app and removing the `advanced-lan` folder in your application data (Windows: `%APPDATA%\advanced-lan`, macOS: `~/Library/Application Support/advanced-lan`). For data processed by GitHub (or by Overwolf, if you installed it yourself), please contact them directly.

## Contact

Questions about this policy: open an issue at <https://github.com/Nomisimo/Advanced-Lan/issues>.

## Changes

Changes to this policy are published in this file. The date at the top shows the latest version.
