# OSC-Ziele: Recherche

Grundlage der Ziel-Datenbank in `src/core/ziel-typen.js`. Stand 2026-10-03. Die Recherche ist auf Englisch; die Markierungen [V] (offizielle Doku), [C] (Community/mitgelieferte Datei) und [I] (abgeleitet, vor der Show testen) zeigen, wie sicher eine Angabe ist.


Status: 2026-10-03. Legend:
- **[V]** verified from official docs (URL in the Sources line)
- **[C]** taken from a community or forum source, or a file shipped with the product (mirrored on GitHub)
- **[I]** inferred or common practice, so test it on the target before relying on it

Arg types use OSC type tags: `i` int32, `f` float32, `s` string, and none (no arguments). Placeholders appear as `{name}`.

---

## 1. QLab 5 (Figure 53), id `qlab5`
- **Port:** 53000 UDP and TCP [V]. Replies go to UDP 53001, configurable via `/udpReplyPort` [V]. Plain-text OSC is on UDP 53535 [V].
  - The task brief said "53". That is wrong: the port is **53000**.
- **Setup:**
  - In Workspace Settings → Network, enable OSC access and optionally set a passcode [I, menu path].
  - If *every* open workspace has a passcode, the client must first send `/workspace/{id}/connect {passcode}` (or `/connect {passcode}`) before QLab accepts messages [V].
- **Workspace prefix:** without the `/workspace/{id}` prefix, a message goes to **all open workspaces** on that port. In QLab 4 it went only to the front workspace [V].

| id | label | address | args |
|---|---|---|---|
| go | GO (current cue list) | `/go` | none, or `s` cue_number (jump to the cue and GO) [V] |
| cue_start | Start cue | `/cue/{cueNumber}/start` | none [V] |
| cue_stop | Stop cue | `/cue/{cueNumber}/stop` | none [V] |
| cue_load | Load cue | `/cue/{cueNumber}/load` | none [V] |
| stop | Stop all | `/stop` | none [V] |
| hardstop | Hard stop | `/hardStop` | none [V] |
| panic | Panic (fade out, then hard stop) | `/panic` | none [V] |
| pause / resume | Pause / resume all | `/pause`, `/resume` | none [V] |
| playhead | Set playhead | `/playhead/{cueNumber}` | none [V] |
| connect | Connect with passcode | `/connect` | `s` passcode [V] (`/workspace/{id}/connect`) |

Sources: https://qlab.app/docs/v5/scripting/osc-dictionary-v5/

---

## 2. grandMA3 (MA Lighting), id `gma3`
- **Port:** default **8000** [V, QLab use-case page]. UDP or TCP can be chosen per OSC line [V].
- **Setup:**
  - Go to Menu → In & Out → OSC, add a line, then set Destination IP, Port and Mode (UDP/TCP).
  - Enable Input, and set **Receive = Yes** for executor or fader data. Set **Receive Command = Yes** for `/cmd`. This setting is independent of Receive [V].
- **Prefix:** optional and must not contain "/". With prefix `gma3`, the address becomes `/gma3/cmd` [V].
- **Data types:** i, f, s, T, F [V].

| id | label | address | args |
|---|---|---|---|
| cmd | Command line | `/cmd` (or `/{prefix}/cmd`) | `s` command, e.g. `Go+ Exec 402` [V] |
| seq_goto_cue | Sequence X: go to cue Y | `/cmd` | `s` `Goto Sequence {seq} Cue {cue}` [I] (see note) |
| seq_go | Sequence: Go+ | `/cmd` | `s` `Go+ Sequence {seq}` [I] (the doc shows `Go Sequence 2`) |
| seq_off | Sequence off | `/cmd` | `s` `Off Sequence {seq}` [I] |
| macro | Run macro | `/cmd` | `s` `Go+ Macro {n}` [I] |
| fader | Executor fader | `/Page{page}/Fader{exec}` | `i` 0..100 [V] (doc example `/gma3/Page1/Fader201,i,100`) |
| key | Sequence key press/release | `/13.13.1.6.{seq}` | `s` keyFunction, `i` 1 = press / 0 = release [V] |

Note on cue syntax: the manual's Goto examples are `Goto Cue 105 Executor 104` and `Goto Sequence 42 Cue Previous` [V]. So `Goto Sequence 101 Cue 3` should work [I].

Sources:
- https://help.malighting.com/grandMA3/2.3/HTML/remote_inputs_osc.html
- https://help.malighting.com/grandMA3/2.2/HTML/osc_qlab.html
- https://help.malighting.com/grandMA3/2.3/HTML/keyword_goto.html

---

## 3. REAPER (Cockos), id `reaper`
- **Port:** UDP, set by the user. The OSC dialog's default "Local listen port" is **8000** (device port 9000) [I].
- **Setup:**
  - Go to Options → Preferences → Control/OSC/web → Add → OSC (Open Sound Control).
  - Choose the pattern config "Default", Mode "Local port" (or Device IP + local port), and set the listen port [V general / I details].
- **Pattern file:** `Default.ReaperOSC`. The lines below are quoted from the file shipped with REAPER [C, GitHub mirror]:
  - `ACTION i/action s/action/str t/action/@ f/action/@/cc`
  - `PLAY t/play`, `STOP t/stop`, `RECORD t/record`, `PAUSE t/pause`
  - `GOTO_MARKER i/marker t/marker/@`, `GOTO_REGION i/region t/region/@`
  - `TRACK_MUTE b/track/mute b/track/@/mute t/track/mute/toggle t/track/@/mute/toggle`
  - `TIME f/time s/time/str`
  - In the file, `t/` means trigger, `b/` means a 0/1 binary value and `@` is a numeric wildcard. The file's own example reads: "The device sends /action 40757 or /action/40757".
- **Playing a specific sound:**
  - Option (a): put each sound at a marker or region, then send `/marker/{n}` followed by `/play`.
  - Option (b): write a custom action or ReaScript and trigger it with `/action/str "_RS…"` (named command ID) or `/action/{id}`.

| id | label | address | args |
|---|---|---|---|
| play | Play | `/play` | none or `i` 1 [C] |
| stop | Stop | `/stop` | none or `i` 1 [C] |
| pause | Pause | `/pause` | none or `i` 1 [C] |
| record | Record | `/record` | none or `i` 1 [C] |
| action | Run action (numeric ID) | `/action/{id}` (or `/action` + `i` id) | none [C] |
| action_str | Run action (named ID, e.g. `_RS123…`, SWS) | `/action/str` | `s` commandId [C] |
| marker | Go to marker | `/marker/{n}` (or `/marker` + `i` n) | none [C] |
| region | Go to region | `/region/{n}` | none [C] |
| track_mute | Mute track | `/track/{n}/mute` | `i` 0/1 [C] (`/track/{n}/mute/toggle` toggles) |
| time | Seek to time | `/time` | `f` seconds [C] |

Sources:
- https://www.reaper.fm/sdk/osc/osc.php
- `Default.ReaperOSC` (shipped with REAPER), mirrored e.g. at github.com/attaccapublishing/TouchOSC (Reaper/Default.ReaperOSC)

---

## 4a. ETC Eos family (Eos, Ion, Element, Nomad), id `eos`
- **Port:**
  - UDP: user-defined. The ETC article uses **RX 8000** (and TX 8001) [V].
  - TCP: 3032 (OSC 1.0, packet length) [V]. TCP 3037 is OSC 1.1 SLIP, enabled via "Third Party OSC" (v3.1+) [V].
- **Setup:**
  - Go to Setup → System Settings → Show Control → OSC: **OSC RX = On**, OSC UDP RX Port = 8000.
  - Go to Setup → Device Settings → Network and enable "UDP Strings & OSC" on the interface [V].
- **Address prefix:** every address must begin with `/eos/` [V]. `/fire` fires a cue regardless of sequence, while `/go` advances like the physical Go key [V]. Button values are 1.0 for press and 0.0 for release [V].

| id | label | address | args |
|---|---|---|---|
| cue_fire | Fire cue (list, cue) | `/eos/cue/{list}/{cue}/fire` | none [V] |
| cue_fire_cur | Fire cue (current list) | `/eos/cue/{cue}/fire` | none [V] |
| go | GO key | `/eos/key/go_0` | none, or `f` 1.0 / 0.0 [V] |
| stop_back | Stop/Back key | `/eos/key/stop` | `f` 1.0 [I] |
| sub_full | Submaster full | `/eos/sub/{n}/full` | none [V] |
| macro | Fire macro | `/eos/macro/{n}/fire` | none [C] |
| cmd | Command line (append) | `/eos/cmd` | `s` e.g. `Go_To_Cue 3/9#` [I] |
| newcmd | Command line (clear, then send) | `/eos/newcmd` | `s` command [I] |

Sources:
- https://support.etcconnect.com/ETC/Consoles/Eos_Family/Software_and_Programming/Triggering_Eos_from_QLab_using_OSC
- https://support.etcconnect.com/ETC/Consoles/Eos_Family/Software_and_Programming/TCP_port_for_OSC_communication_with_Eos_Software
- https://www.etcconnect.com/WebDocs/Controls/EosFamilyOnlineHelp/en/Content/23_Show_Control/08_OSC/Using_OSC_with_Eos/Eos_OSC_Conventions.htm

## 4b. ChamSys MagicQ, id `magicq`
- **Port:** UDP. The docs say "A good default is 9000 transmit and **8000 receive**" [V]. Use a port above 1024.
- **Setup:** Setup → View Settings → Network: set the OSC mode plus the TX and RX ports. The TX IP can be 0.0.0.0 for broadcast [V].
- **Limit:** `<playback>` is 1 to 10 in the `/pb` addresses. `<cue>` may be decimal, e.g. 2.5 [V].

| id | label | address | args |
|---|---|---|---|
| pb_go | Playback Go | `/pb/{pb}/go` | none or `i` 1 [V] |
| pb_cue | Playback jump to cue | `/pb/{pb}/{cue}` | none or `i` 1 [V] |
| pb_release | Release | `/pb/{pb}/release` | none or `i` 1 [V] |
| pb_flash | Flash | `/pb/{pb}/flash` | `i` 0 = off, non-zero = 100 % [V] |
| pb_level | Fader level | `/pb/{pb}` | `f` 0.0..1.0 or `i` 0..100 [V] |
| exec | Execute window item | `/exec/{page}/{item}` | `i`/`f` value [V] |
| rpc | Remote command string | `/rpc` | `s` (MagicQ remote protocol string) [V] |

Sources: https://secure.chamsys.co.uk/help/documentation/magicq/osc.html (current docs: https://docs.chamsys.co.uk/magicq/manual/OSC.html)

## 4c. Hog 4 OS (ETC/HES), id `hog4`
- **Port:** UDP, user-defined. No default is documented; 7001 or 8000 is commonly used [I].
- **Setup:** Setup → Network, right-click the console number → Settings → Open Sound Control pane: enable **OSC In** and set the input port [V].

| id | label | address | args |
|---|---|---|---|
| list_go | Go cuelist | `/hog/playback/go/0` | `f`/`i` cuelist # [V] |
| list_go_cue | Go cue in cuelist | `/hog/playback/go/0` | `f` "cuelist.cue", e.g. 1.5 [V format / I type] |
| list_halt | Halt cuelist | `/hog/playback/halt/0` | `i` cuelist # [V] |
| list_release | Release cuelist | `/hog/playback/release/0` | `i` cuelist # [V] |
| scene_go | Go scene | `/hog/playback/go/1` | `i` scene # [V] |
| hw_go | Master Go button | `/hog/hardware/go/{master}` | `i` 1 press / 0 release [V addr / I args] |
| hw_flash | Master Flash | `/hog/hardware/flash/{master}` | `i` 1 / 0 [V addr / I args] |

Sources:
- https://www.etcconnect.com/webdocs/Controls/HOG/HTML/en/sect-osc_mappings.htm
- https://www.etcconnect.com/webdocs/Controls/HOG/HTML/en/sect-connecting_osc.htm

## 4d. grandMA2, id `gma2`: no native OSC
- The grandMA2 manual's remote section lists Remote Input, MSC, Web Remote and **Telnet** only [V].
- **Alternative:** Telnet on TCP port 30000 [I]. Enable it via Setup → Global Settings → Telnet. Log in with `login "user" "pass"`, then send plain command lines such as `Goto Executor 1.101 Cue 3`.
  - The app should treat this as a separate "telnet" target type, or use MIDI Show Control.

Sources: https://help.malighting.com/grandMA2/en/help/key_remote_control_telnet.html

## 4e. Avolites Titan, id `titan`: no native OSC found
- The Titan v15 release notes do not mention OSC [V].
- **Alternative:** the Titan WebAPI (HTTP on port **4430**) [V]. Example: `http://{ip}:4430/titan/script/Playbacks/FirePlaybackAtLevel?userNumber=1&level=1&bool=false` [V].
  - The app should use an HTTP target type for this.

Sources:
- https://www.avosupport.de/wiki/webapi/start
- https://api.avolites.com/

---

## 5. Resolume Arena / Avenue, id `resolume`
- **Port:** UDP **7000** for input [V port / I that it is UDP]. Resolume advertises itself via Bonjour [V].
- **Setup:** enable OSC input in Preferences → OSC. Shortcuts → Edit OSC shows the address of any control [V].

| id | label | address | args |
|---|---|---|---|
| clip_connect | Trigger clip | `/composition/layers/{layer}/clips/{clip}/connect` | `i` 1 [V] |
| column_connect | Trigger column | `/composition/columns/{col}/connect` | `i` 1 [I, same pattern] |
| layer_clear | Clear layer | `/composition/layers/{layer}/clear` | `i` 1 [V addr] |
| bpm | Set BPM | `/composition/tempocontroller/tempo` | `f` [I] (doc lists `/composition/bpm` `f`) |
| master_bypass | Master bypass | `/composition/video/master/bypass` | `i` 0/1 [V] |
| layer_opacity | Layer opacity | `/composition/layers/{layer}/video/opacity` | `f` 0..1 [I] (doc example uses `selectedlayer`) |

Sources: https://resolume.com/support/en/osc

---

## 6. Bitfocus Companion (v3/v4), id `companion`
- **Port:** **12321** (configurable) [V]. UDP [I].
- **Setup:** enable OSC listener in Settings → Protocols → OSC [V roughly].

| id | label | address | args |
|---|---|---|---|
| press | Press button (down + up) | `/location/{page}/{row}/{column}/press` | none [V] |
| down | Button down | `/location/{page}/{row}/{column}/down` | none [V] |
| up | Button up | `/location/{page}/{row}/{column}/up` | none [V] |
| rotate_l / rotate_r | Encoder rotate | `/location/{page}/{row}/{column}/rotate-left` and `/rotate-right` | none [V] |
| text | Set button text | `/location/{page}/{row}/{column}/style/text` | `s` [V] |
| bgcolor | Set background color | `/location/{page}/{row}/{column}/style/bgcolor` | `i` R, `i` G, `i` B [V] |
| custom_var | Set custom variable | `/custom-variable/{name}/value` | `s` value [V] |
| legacy_press | Legacy (deprecated) | `/press/bank/{page}/{bank}` | none [V, must be enabled] |

Sources: https://companion.free/user-guide/v4.2/remote-control/osc-control

---

## 7. Others

### Ableton Live via AbletonOSC (third-party remote script), id `ableton`
- **Port:** UDP **11000** (replies on 11001) [V].
- **Setup:** copy AbletonOSC into User Library/Remote Scripts, then go to Preferences → Link/Tempo/MIDI → Control Surface = AbletonOSC [V].
- Indexes are 0-based [I, per the Live Object Model].

| id | label | address | args |
|---|---|---|---|
| start | Start playing | `/live/song/start_playing` | none [V] |
| stop | Stop playing | `/live/song/stop_playing` | none [V] |
| continue | Continue playing | `/live/song/continue_playing` | none [V] |
| stop_all | Stop all clips | `/live/song/stop_all_clips` | none [V] |
| clip_fire | Fire clip | `/live/clip/fire` | `i` track, `i` clip [V] |
| scene_fire | Fire scene | `/live/scene/fire` | `i` scene [V] |
| tempo | Set tempo | `/live/song/set/tempo` | `f` bpm [V] |
| mute | Mute track | `/live/track/set/mute` | `i` track, `i` 0/1 [V] |

Sources: https://github.com/ideoforms/AbletonOSC

### Millumin (v4/v5), id `millumin`
- **Port:** UDP input **5000** [V]. Input and output must use different ports.
- **Setup:** in Millumin, open the Device Manager (Interactions) and enable OSC input on port 5000 [I menu path].
- The `/millumin` prefix is optional on input. Feedback messages always carry it [V].

| id | label | address | args |
|---|---|---|---|
| launch_col | Launch column | `/millumin/action/launchColumn` | `i` index or `s` name [V] |
| launch_stop_col | Launch or stop column | `/millumin/action/launchOrStopColumn` | `i`/`s` [V] |
| stop_col | Stop column | `/millumin/action/stopColumn` | none [V] |
| next_col | Next column | `/millumin/action/launchNextColumn` | none [V] |
| play / pause | Timeline play/pause | `/millumin/action/play`, `/millumin/action/pause` | none [V] |
| goto_time | Go to time | `/millumin/action/goToTime` | `f` seconds or `s` "hh:mm:ss.mmm" [V] |
| layer_start | Start media on layer | `/millumin/layer:{layerName}/startMedia` | none or `s` media name [V] |
| layer_opacity | Layer opacity | `/millumin/layer:{layerName}/opacity` | `f` 0..1 [V pattern] |

Sources: https://github.com/anome/millumin-dev-kit/wiki/OSC-documentation

### Behringer X32 / M32 (and XAir), id `x32`
- **Port:** UDP **10023** for X32/M32 and **10024** for XAir [C, unofficial protocol doc by P.-G. Maillot].
- **Setup:** none; the mixer needs only a network IP. Feedback requires renewing `/xremote` every less than 10 s [C].
- The two-digit channel number is zero-padded (`01`..`32`). For `mix/on`, **1 = channel on (unmuted)** and 0 = muted.

| id | label | address | args |
|---|---|---|---|
| ch_on | Channel on/mute | `/ch/{ch:02}/mix/on` | `i` 1 on / 0 mute [C] |
| ch_fader | Channel fader | `/ch/{ch:02}/mix/fader` | `f` 0..1 [C] |
| bus_on | Bus on/mute | `/bus/{bus:02}/mix/on` | `i` [C] |
| main_fader | Main LR fader | `/main/st/mix/fader` | `f` 0..1 [C] |
| scene | Load scene | `/-action/goscene` | `i` scene [C] |
| mute_group | Mute group | `/config/mute/{1-6}` | `i` 0/1 [C] |

Sources: https://sites.google.com/site/patrickmaillot/x32 (unofficial X32 OSC protocol PDF)

### Dataton WATCHOUT 7, id `watchout`
- **Port:** UDP **8000** and TCP 8001 (length-prefixed). The ports are fixed [V].
- **Setup:** in Producer, turn on the **OSC** toggle in the Network window [V].
- Only `f` and `i` arguments are accepted [V]. Other addresses map to variables `osc.addr({address}/{argIndex})` [V].

| id | label | address | args |
|---|---|---|---|
| play | Play timeline | `/wo/play/{timelineId}` | none [V] |
| pause | Pause timeline | `/wo/pause/{timelineId}` | none [V] |
| stop | Stop timeline | `/wo/stop/{timelineId}` | none [V] |
| play_cue | Jump to cue and play | `/wo/play/{timelineId}/{cueId}` | none [V] |
| play_time | Jump to time and play | `/wo/play/{timelineId}` | `f` seconds or `i` ms [V] |

- **WATCHOUT 6 and older** use a TCP/UDP text protocol instead, on port 3040 [I].

Sources: https://docs.dataton.com/watchout-7-new/watchout/external-control/osc-protocol.html

### disguise (d3 / Designer), id `disguise`
- **Port:** UDP, user-defined in the OSC device [V].
- **Setup:** create an OSC Device (port) and an OSC transport on the track/transport [V].

| id | label | address | args |
|---|---|---|---|
| play | Play | `/d3/showcontrol/play` | none [V] |
| stop | Stop | `/d3/showcontrol/stop` | none [V] |
| cue | Go to cue (tag) | `/d3/showcontrol/cue` | up to 3 `i`, e.g. 7 8 9 → cue 7.8.9 [V] |
| playsection | Play section | `/d3/showcontrol/playsection` | none [I] |
| next/prev section | Next/previous section | `/d3/showcontrol/nextsection`, `/previoussection` | none [I] |
| returntostart | Return to start | `/d3/showcontrol/returntostart` | none [I] |

Sources:
- https://help.disguise.one/designer/timeline-tracks-transports/osc/controlling
- https://legacy-help.disguise.one/en/Content/Configuring/Transports/OSC/Triggering-cues-with-OSC.html

### Lightkey (macOS), id `lightkey`
- **Port:** UDP **21600** [V, help center].
- **Setup:** right-click (Control-click) a cue in Live view, then choose External Control → Copy OSC Address [V].

| id | label | address | args |
|---|---|---|---|
| cue_toggle | Toggle cue | `/live/{Panel_Name}/cue/{Cue_Name}/toggle` | none [V] (spaces become `_`) |
| cue_on / cue_off | Activate/deactivate cue | `/live/{Panel}/cue/{Cue}/activate` / `deactivate` | none [I] |

Sources: https://lightkeyapp.com/en/help

### MadMapper, id `madmapper`
- **Port:** UDP **8010** [I, commonly used]. The port is set in Preferences → OSC (input and feedback port) [V].
- Use right-click → "Copy OSC Address" on any control [V]. Addresses are named, e.g. `/surfaces/{name}/opacity` `f` [V]. Cues use `/cues/selected/scenes/by_name/{name}` [V pattern, args I: `i` 1].

Sources: https://docs.madmapper.com/madmapper/6/11.-live-performance-and-control

### TouchDesigner, id `touchdesigner`
- **Port:** freely chosen by the user. There is no fixed default; an OSC In DAT/CHOP must be added [V]. Protocol: UDP, multicast UDP, or reliable UDT [V].
- Addresses are freely defined. The app should let the user enter any address and arguments (generic target).

Sources: https://docs.derivative.ca/OSC_In_DAT

### No native OSC (handle as other target types)
- **vMix:** no native OSC input. OSC is an open feature request on the forum [C]. Use the HTTP API on port 8088 (`/api/?Function=…`) or the TCP API on port 8099 [I].
- **OBS Studio:** no OSC. Use obs-websocket v5 (WebSocket, default port **4455**, auth) [I].
- **Allen & Heath (SQ/dLive/Avantis/Qu):** the official external-control whitepaper does not mention OSC. They use MIDI over TCP and a proprietary TCP protocol (dLive/Avantis TCP 51325, SQ 51326) [V no-OSC / I ports].

Sources:
- https://forums.vmix.com/posts/m98805-Add-Open-Sound-Control-to-Activator-System
- https://www.allen-heath.com/content/uploads/2023/11/AH-External-control.pdf

---

## Recommendations for the app
1. Add a **generic OSC target** with free address and args. Many products (TouchDesigner, MadMapper, Resolume) generate addresses per project.
2. Make UDP the default transport. Offer TCP only for QLab, grandMA3, Eos and WATCHOUT; Eos TCP needs OSC 1.0 length-prefix or 1.1 SLIP framing.
3. Support `s` args with templates (`Goto Sequence {seq} Cue {cue}`) for grandMA3 `/cmd` and Eos `/eos/cmd`.
4. Support the QLab passcode by sending `/connect` before commands if a passcode is set.
5. Pad with leading zeros for X32 (`{ch:02}`).
