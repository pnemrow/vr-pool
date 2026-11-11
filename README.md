# Corner Pocket VR

A VR pool hall for the Meta Quest 3 browser, built with Three.js and WebXR. It is a static site with no build step.

## Play

Open the hosted page in the Meta Quest browser and choose **Enter VR**. On a computer, choose **Play on this screen** to play with the mouse.

To run it locally: `python3 -m http.server 8000` in this folder, then open `http://localhost:8000`. VR needs HTTPS, so use the hosted page on the headset.

### VR controls

The game is built to be played standing still in front of a real table or desk. Stand where you will play, facing your table, when you enter VR. In the menu under Setup, rest your front controller on the real table and choose "Match table to my front hand" so the cloth sits at that height.

| Control | What it does |
| --- | --- |
| Back hand | Holds the cue. The cue follows the handle of the controller. Stroke through the cue ball to shoot. |
| Front hand trigger | Drops an anchor where that hand is. The cue pivots on it, so the back hand sets aim and spin. Pull again to move it. |
| Front hand grip | Lifts the anchor. Hold it to bridge freely with the hand instead. |
| B | Stands you behind the cue ball on the best shot. Press again for the next best. |
| Either stick, left and right | Turns you around the cue ball for fine aim and bank shots. |
| Either stick, up and down | Steps you closer to or further from the ball. |
| A | Opens and closes the menu. Point with the back hand and pull its trigger to choose. |

Hit low and hard to make the cue ball hop, or raise the back hand and strike down for a jump shot.

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
