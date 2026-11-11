# Corner Pocket VR

A VR pool hall for the Meta Quest 3 browser, built with Three.js and WebXR. It is a static site with no build step.

## Play

Open the hosted page in the Meta Quest browser and choose **Enter VR**. On a computer, choose **Play on this screen** to play with the mouse.

To run it locally: `python3 -m http.server 8000` in this folder, then open `http://localhost:8000`. VR needs HTTPS, so use the hosted page on the headset.

### VR controls

| Control | What it does |
| --- | --- |
| Cue hand | Holds the cue. Stroke through the cue ball to shoot. |
| Bridge hand grip | Makes that hand the bridge, so the cue pivots on it. |
| Bridge hand trigger | Locks the aim line so the cue only slides forward and back. |
| Cue hand trigger | Selects menu items and places the cue ball. |
| A | Opens and closes the menu. |
| B | Lines you up behind the cue ball, facing the best shot. |
| Cue hand stick | Turns you in 30 degree steps. |
| Bridge hand stick | Glides around the cue ball (stay put) or walks (walk mode). |

### Desktop controls

Move the mouse to aim, hold the left button to build power and release to shoot. W A S D set spin, right drag looks around, the wheel zooms, and M opens the menu.

## Code map

| File | Purpose |
| --- | --- |
| `src/main.js` | Scene setup, game flow, VR and desktop input, menus |
| `src/physics.js` | Ball motion, spin, cushions, pockets, assist prediction |
| `src/rules.js` | Eight ball rules |
| `src/ai.js` | Computer opponent |
| `src/table.js`, `src/room.js`, `src/balls.js`, `src/cue.js` | Procedural models and textures |
| `src/ui.js`, `src/audio.js` | In-world menu and scoreboard, synthesised sound |

Test hooks: `?demo` plays the computer against itself, `?demo&fast` speeds that up, and `?mode=practice` skips the landing screen.

Three.js is vendored in `vendor/` under the MIT licence.
