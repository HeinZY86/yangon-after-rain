# Yangon After Rain

[Play the game](https://heinzy86.github.io/yangon-after-rain/)

**Enter World** opens a world hosted by your browser. Choose **Invite → Copy link** and send it to a friend. Opening the link joins the active session. The host must keep the tab open. A world supports one host and up to 19 guests. Settings controls your display name, sound and graphics.

**Play Offline** starts a solo sandbox. A saved copy of index.html includes the original downtown district, characters and vehicles and can be opened without a connection. The geographic map is streamed when served over HTTP. The full city map needs a connection to the static map files or a locally built copy.

## Controls

| Action | Desktop |
| --- | --- |
| Walk or drive | WASD |
| Run | Shift |
| Look | Drag, or double-click for mouse look |
| Enter or leave a stopped car | E |
| Jump or handbrake | Space |
| Swing | F |
| Chat | T |
| Change view | V |
| Map and travel stops | M |
| Menu | Esc |

Touch controls appear on touchscreen devices. The first player entering a vehicle drives and a second can ride as a passenger. Cars, crates and streetlights return after 15 seconds. Players respawn after 2.4 seconds.

## This release

- Reused the existing WebGL meshes, materials, camera and input system. Added momentum, speed-sensitive steering, tire grip and braking.
- Added peer-hosted worlds, direct invitations, shared vehicle seats, chat, player names, health, respawn and temporary destruction.
- Built the Yangon road network from OpenStreetMap. The rendering uses 320-metre cells, a simplified city overview and 12 travel destinations. Local facades, heights, road widths and landmark models are approximate. Some building footprints are sampled away from travel stops.
- Reduced work for distant buildings and groups of idle players. The game automatically lowers render resolution on slow devices.

## Hosting and networking

GitHub Pages serves static files. PeerJS Cloud provides signaling and WebRTC data channels carry gameplay. The host coordinates world state at 8 Hz. This release uses STUN and has no configured TURN relay. Some mobile, corporate and symmetric-NAT networks may prevent direct connections. A world ends when its host leaves.

## Map data and local development

Map data © OpenStreetMap contributors, distributed under the Open Database License. [Attribution and licence](https://www.openstreetmap.org/copyright). The build uses the [Geofabrik Myanmar extract](https://download.geofabrik.de/asia/myanmar.html). Compiled map cells are derived data under the same licence.

To build the geographic map locally, run `sh build-city.sh` with Python 3.10+ and curl, then serve this directory using `python3 -m http.server 8000`. Open http://localhost:8000. For embedded offline play, open index.html directly. The production site uses GitHub Actions to build and host the geographic dataset. The only online gameplay library is PeerJS 1.5.4.

## Verification

Run `node rules-test.cjs` for world-state regression checks. The Browser QA workflow runs Chrome and a temporary local PeerServer to exercise two game clients, admission, replication and disconnection. Additional capacity peers are genuine RTC connections without game renderers. The QA environment does not measure gameplay on twenty physical devices. [Browser QA runs](https://github.com/HeinZY86/yangon-after-rain/actions/workflows/verify.yml)
