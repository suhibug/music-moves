# Music Moves

**We've always moved to the music. What if the music moved to us?**

A free web app that watches how you move through your camera and (soon) shapes the music to match: slow and composed gets calm music, bouncing gets a groove locked to your bounce, jumping gets a rave.

**Try it:** https://suhibug.github.io/music-moves/

## How it works

1. **The camera finds your body.** [MediaPipe Pose](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) finds 33 points on your body (wrists, knees, hips...) about 30 times a second, right in the browser.
2. **The app reads your moves** from those points and picks a style:

| You | Music |
|---|---|
| Move slow and easy | **Flow**: soft pads and wandering bell notes, like plant music (72 BPM) |
| Bounce | **Hip hop**: boom bap kick, snare, swung hi-hats, deep bass (80 to 105 BPM) |
| Bounce faster and steady | **House**: four on the floor, off-beat hats and bass (115 to 130 BPM) |
| Jump and go big | **Rave**: house with chord stabs and busier drums |

While you bounce, the tempo follows your bounce. On top of the style, single moves play sounds:

| Move | Sound |
|---|---|
| Fast hand move | A bell note on the beat. Higher hand, higher note (A minor pentatonic, so it never clashes) |
| Step or stomp | A drum hit |
| Jump | A crash and a deep boom |
| Both arms up | A rising whoosh that builds while they stay up |
| Freeze | The music fades to a muffled hum until you move again |

Styles only switch after a new style lasts 2.5 seconds, and always on the first beat of a bar, like a DJ mix.

3. **All sound is generated live** with [Tone.js](https://tonejs.github.io/). No recordings, so nothing is copyrighted and nothing costs money.

## Seeing your whole body

On a phone, start the camera, open the side panel and pick the back **Ultra Wide** camera (the 0.5x lens). Prop the phone at about knee height, tilted up a little, a few steps away. On Android, the app zooms out as far as the camera allows. You can also tap **Use a video** to dance from a saved clip.

## Privacy

Your video never leaves your device. Nothing is recorded or uploaded. The only thing counted is anonymous usage (camera or video started, which styles were reached) through Google Analytics.

## Roadmap

- [x] Step 1: camera, body tracking, energy meter
- [x] Step 2: generated music that follows your style, bounce and moves
- [ ] Step 3: tune the readings with real dance videos (**Save readings** downloads the numbers, never the video)
- [ ] Step 4: share a clip, plus usage data in my [personal analytics dashboard](https://github.com/suhibug/personal-analytics)

## Run it yourself

No build step. From this folder run `python3 -m http.server 8000` and open http://localhost:8000. The camera needs `localhost` or `https`.

Built by [Suhitha Lakkunda Rathnakara](https://suhibug.github.io/).
