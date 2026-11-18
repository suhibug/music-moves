# Music Moves

**We've always moved to the music. What if the music moved to us?**

A free web app that watches how you move through your camera and (soon) shapes the music to match: slow and composed gets calm music, bouncing gets a groove locked to your bounce, jumping gets a rave.

**Try it:** https://suhibug.github.io/music-moves/

## How it works

1. **The camera finds your body.** [MediaPipe Pose](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) finds 33 points on your body (wrists, knees, hips...) about 30 times a second, right in the browser.
2. **The app reads your movement** from those points:

| Reading | How it's measured |
|---|---|
| Energy | How fast your body moves, in torso lengths per second, so it works at any distance from the camera |
| Bounce | How often your hips dip and come back up, in bounces per minute |
| Jump | Both ankles lifted well above where they usually rest |
| Arms up | A wrist above your head |
| Mood | Calm, Groove or Rave, from your energy and jumps |

3. **The music follows** (coming next): generated live in the browser, so it can change the moment you do. No recorded songs, so nothing is copyrighted.

## Privacy

Your video never leaves your device. Nothing is recorded or uploaded. The only thing counted is anonymous usage (camera started, which moods were reached) through Google Analytics.

## Roadmap

- [x] Step 1: camera, body tracking, energy meter
- [ ] Step 2: generated music that follows your energy and bounce rate, changing on the beat
- [ ] Step 3: tune the readings with real dance videos
- [ ] Step 4: share a clip, plus usage data in my [personal analytics dashboard](https://github.com/suhibug/personal-analytics)

## Run it yourself

No build step. From this folder run `python3 -m http.server 8000` and open http://localhost:8000. The camera needs `localhost` or `https`.

Built by [Suhitha Lakkunda Rathnakara](https://suhibug.github.io/).
