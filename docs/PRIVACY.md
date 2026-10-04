# Advanced LAN – Privacy Policy

_Last updated: 4 October 2026_

Advanced LAN ("the app") is a free, open-source desktop app published by Momo (GitHub: [Nomisimo](https://github.com/Nomisimo)). It turns in-game events into OSC commands for stage lighting, audio and video. This policy explains which data the app processes.

## Summary

- The app shows **no ads** and has **no user accounts**.
- The publisher **does not collect, store or sell personal data**. There is no server operated by the publisher.
- Game events stay in your local network and go only to the devices you configure.
- The Overwolf runtime that the app is built on sends anonymous usage data to Overwolf (see below).

## Data processed on your computer and in your local network

| Data | Purpose | Where it goes |
|---|---|---|
| In-game events (for example kills, rounds, goals, match results, player names shown in the game, team) | Trigger lighting, audio and video cues; show the Game Stats Screen | From the game PC to the control PC ("Regie") in your local network, and as OSC/NDI to the devices you add. Never to the publisher. |
| PC name you enter, host name, local IP address, MAC address, app version, ping | Show which game PCs are connected | Sent from game PCs to the control PC in the same local network |
| Session name and password | Protect a session in your local network | Stored locally; the password itself is never sent, only an HMAC challenge-response |
| Settings (targets, signals, hotkey, consent date) | Remember your configuration | Stored locally in your user profile (`advanced-lan.json`) |

Game data is read only from official interfaces: Valve Game State Integration (Counter-Strike 2, Dota 2), the Psyonix Rocket League Stats API, and Overwolf Game Events (GEP). The app does not read game memory and does not modify games.

## Data sent to third parties

- **Overwolf**: The app runs on Overwolf's ow-electron runtime. Overwolf collects anonymous analytics (for example a machine identifier, app version, crash and performance data) and loads its game-event packages. This processing is covered by the [Overwolf Privacy Policy](https://www.overwolf.com/legal/privacy/). You can review your choices in the app under **Setup → App → Privacy settings**.
- **GitHub**: To check for updates, the app requests the public release list from `api.github.com` and downloads updates from `github.com`. GitHub receives your IP address as part of these requests ([GitHub Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement)).
- **Feedback**: If you click **Report** in the app, your browser opens a new GitHub issue that already contains the app version, your operating system and the selected mode. Nothing is sent unless you submit the issue yourself.

## Children

The app is not directed at children under 16 and does not knowingly process their personal data.

## Your rights

Because the publisher stores no personal data, there is nothing to access, correct or delete on the publisher's side. You can delete all local data by uninstalling the app and removing the `advanced-lan` folder in your application data (Windows: `%APPDATA%\advanced-lan`, macOS: `~/Library/Application Support/advanced-lan`). For data processed by Overwolf or GitHub, please contact them directly.

## Contact

Questions about this policy: open an issue at <https://github.com/Nomisimo/Advanced-Lan/issues>.

## Changes

Changes to this policy are published in this file. The date at the top shows the latest version.
