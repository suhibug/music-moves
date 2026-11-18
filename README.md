# Music Moves

**We've always moved to the music. What if the music moved to us?**

Objects float in the air around you on camera. Grab them, stretch them, throw them, catch them, smash them, and every move makes a sound. Keep playing and a beat grows underneath. Stop, and it goes quiet.

**Try it:** https://suhibug.github.io/music-moves/

## How it works

1. **Your hands are tracked** right in the browser with Google's free [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker): 21 points per hand, so it can tell an open hand from a grab or a pinch.
2. **The objects match where you are.** The camera picture is checked every 20 seconds: a room gets room things (cups, books, pillows, socks...), and real objects it spots, like a cup or a plant, come up more often. A beach gets shells, rocks and cans; outdoors gets leaves and flowers. Their colors lean toward the colors behind you.
3. **Pick an art style anytime:** Pixel, ASCII, Watercolor or 3D. All four are drawn from the same small pixel drawings.
4. **Every action is a sound**, generated live with [Tone.js](https://tonejs.github.io/) (no recordings, nothing copyrighted). Each object's material has its own voice: glass, metal, soft, bouncy, wood, stone.

| You do | It sounds like |
|---|---|
| Grab (close your hand or pinch) | A note in the object's material. Higher on screen, higher note |
| Wave it around | Notes on the beat as it moves |
| Throw (let go mid-flick) | A whoosh |
| Catch it | A bright accent |
| Swipe an open hand through it | A hit |
| It bounces | A knock: low on the floor, high on the ceiling |
| Both hands on one object | A held chord that opens as you pull it wider and closes as you squeeze |
| Squeeze it tiny, or throw it hard at an edge | It shatters into pieces with a crunch and falling notes |

Every sound lands on a beat grid, so it always stays musical.

## Why it changed

The first versions read the whole body and played music in a style you picked. Testing showed two problems: the music played by itself, and picking a genre missed the point. This version starts silent, and every sound comes from you. The idea comes from a freestyle drill: imagine holding a piece of paper in the air, let it go, catch it with the other hand, throw it, and play with it.

## Privacy

Your camera never leaves your device. Nothing is recorded or uploaded. Only anonymous usage is counted with Google Analytics (started, art style, place type, first catch or smash). Never video, hands or places.

## Next

- [ ] Kick objects with your feet (full body, when you're further from the screen)
- [ ] "Teach it your styles": record yourself dancing chill, hip hop, house and afro, and the beat underneath follows the style you're dancing

## Run it yourself

No build step. From this folder run `python3 -m http.server 8000` and open http://localhost:8000. The camera needs `localhost` or `https`.

Built by [Suhitha Lakkunda Rathnakara](https://suhibug.github.io/).
